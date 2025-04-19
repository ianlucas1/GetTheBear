import os
import logging
from flask import Flask, render_template, request, jsonify, Response, current_app
import pandas as pd
import io
from analytics import (
    fetch_portfolio_data,
    calculate_metrics,
    fetch_benchmark_data,
    setup_cache_table,
)


def create_app(test_config=None):
    """Create and configure an instance of the Flask application."""
    app = Flask(__name__, instance_relative_config=True)

    # --- Configuration ---
    # Default configuration
    app.config.from_mapping(
        SECRET_KEY=os.environ.get("SESSION_SECRET", "dev-secret-key"), # Use a default for dev
        BENCHMARK_TICKER=os.environ.get('BENCHMARK_TICKER', 'SPY'),
        # Add other default configs here if needed
        # e.g., DATABASE_URI=os.environ.get('DATABASE_URI')
    )

    if test_config is None:
        # Load the instance config, if it exists, when not testing
        # You could create an instance/config.py file
        app.config.from_pyfile('config.py', silent=True)
    else:
        # Load the test config if passed in
        app.config.from_mapping(test_config)

    # --- Logging ---
    # Use Flask's built-in logger
    # Configure logging level (can be done via config too)
    logging.basicConfig(level=logging.DEBUG)
    # Example: Use gunicorn's logger if available (common in production)
    gunicorn_logger = logging.getLogger('gunicorn.error')
    if gunicorn_logger:
        app.logger.handlers = gunicorn_logger.handlers
        app.logger.setLevel(gunicorn_logger.level)
    else:
         app.logger.setLevel(logging.DEBUG) # Default level

    app.logger.info('Flask app created')


    # --- Database / Cache Setup ---
    try:
        # Consider passing app context or config if setup_cache_table needs it
        setup_cache_table()
        app.logger.info("Cache table setup complete")
    except Exception as e:
        app.logger.error(f"Error setting up cache table: {str(e)}")

    # --- Register Error Handlers ---
    @app.errorhandler(400)
    def bad_request(error):
        # Log the error if desired, though 400s are often client errors
        # app.logger.warning(f"Bad Request: {error}")
        return jsonify(error=str(error)), 400

    @app.errorhandler(404)
    def not_found(error):
        return jsonify(error="Not Found: The requested URL was not found on the server."), 404

    @app.errorhandler(500)
    def internal_server_error(error):
        # Log the underlying error for debugging
        app.logger.error(f"Internal Server Error: {error}", exc_info=True)
        return jsonify(error="Internal Server Error: An unexpected error occurred."), 500

    # --- Register Routes ---
    @app.route("/")
    def index():
        """Render the main page of the application."""
        return render_template("index.html")

    @app.route("/analyze_portfolio", methods=["POST"])
    def analyze_portfolio():
        """
        Process portfolio data and return analysis results.

        Expects a JSON with:
        - tickers: List of stock tickers
        - weights: List of weights corresponding to tickers
        - start_date: Portfolio start date (YYYY-MM-DD)
        - end_date: Portfolio end date (YYYY-MM-DD)
        - benchmark_ticker: Custom benchmark ticker (optional, defaults to SPY)
        """
        try:
            data = request.get_json()

            tickers = data.get("tickers", [])
            weights = data.get("weights", [])
            start_date = data.get("start_date")
            end_date = data.get("end_date")
            # Use current_app for config within request context
            benchmark_ticker = data.get("benchmark_ticker", current_app.config['BENCHMARK_TICKER'])

            # Validate inputs
            if not tickers or not weights or not start_date or not end_date:
                return jsonify({"error": "Missing required parameters"}), 400

            if len(tickers) != len(weights):
                return (
                    jsonify({"error": "Number of tickers must match number of weights"}),
                    400,
                )

            # Convert weights to float
            try:
                weights = [float(w) for w in weights]
            except ValueError:
                 return jsonify({"error": "Invalid weight values provided."}), 400
            weight_sum = sum(weights)


            # Check if weights sum to exactly 100% (with a small tolerance of 0.05%)
            if abs(weight_sum - 100) > 0.05:
                return (
                    jsonify(
                        {
                            "error": f"Weights must sum to 100% - your total is {weight_sum:.1f}%"
                        }
                    ),
                    400,
                )

            # Normalize weights to sum to 1 for calculations
            weights = [w / 100.0 for w in weights]

            # Clean up benchmark ticker
            benchmark_ticker = benchmark_ticker.split(" (")[0].strip().upper()

            # Check if benchmark is in the portfolio
            benchmark_in_portfolio = False
            benchmark_index = -1

            for i, ticker in enumerate(tickers):
                clean_ticker = ticker.split(" (")[0].strip().upper()
                if clean_ticker == benchmark_ticker:
                    benchmark_in_portfolio = True
                    benchmark_index = i
                    break

            current_app.logger.debug(
                f"Analyzing portfolio: {tickers} with weights {weights} from {start_date} to {end_date}"
            )
            current_app.logger.debug(f"Using benchmark: {benchmark_ticker}")

            # Fetch portfolio data
            df_monthly, error_tickers, correlation_data = fetch_portfolio_data(
                tickers, weights, start_date, end_date
            )

            if error_tickers:
                return (
                    jsonify(
                        {
                            "error": f"Could not fetch data for the following tickers: {', '.join(error_tickers)}. Please verify they are valid."
                        }
                    ),
                    400,
                )

            if df_monthly is None or df_monthly.empty:
                return jsonify({"error": "Could not retrieve portfolio data"}), 400

            # Fetch benchmark data if not already in the portfolio
            df_benchmark = None
            if not benchmark_in_portfolio:
                df_benchmark, benchmark_error = fetch_benchmark_data(
                    benchmark_ticker, start_date, end_date
                )

                if benchmark_error:
                    current_app.logger.warning(f"Could not fetch benchmark data: {benchmark_error}")
                    return (
                        jsonify(
                            {
                                "error": f"Could not fetch benchmark data for {benchmark_ticker}: {benchmark_error}"
                            }
                        ),
                        400,
                    )

            # Calculate metrics for the portfolio
            metrics = calculate_metrics(df_monthly)

            # Calculate metrics for the benchmark
            benchmark_metrics = None
            if benchmark_in_portfolio:
                clean_ticker = tickers[benchmark_index].split(" (")[0]
                benchmark_only_data, _, _ = fetch_portfolio_data(
                    [clean_ticker], [1.0], start_date, end_date
                )
                if benchmark_only_data is not None and not benchmark_only_data.empty:
                    benchmark_metrics = calculate_metrics(benchmark_only_data)
            elif df_benchmark is not None and not df_benchmark.empty:
                benchmark_metrics = calculate_metrics(df_benchmark)

            # Prepare data for charts
            chart_data = {
                "dates": df_monthly.index.strftime("%Y-%m-%d").tolist(),
                "portfolio_values": df_monthly["Portfolio Value"].tolist(),
                "drawdowns": df_monthly["Drawdown"].tolist(),
                "monthly_returns": df_monthly["Monthly Return"].tolist(),
                "benchmark_ticker": benchmark_ticker,
            }

            # Add annual returns data
            if "annual_returns" in metrics:
                chart_data["annual_returns"] = metrics["annual_returns"]

            # Add benchmark data to chart data if available
            if df_benchmark is not None and not df_benchmark.empty:
                chart_data["benchmark_values"] = df_benchmark["Portfolio Value"].tolist()
                chart_data["benchmark_drawdowns"] = df_benchmark["Drawdown"].tolist()
                chart_data["benchmark_in_portfolio"] = False
                if benchmark_metrics and "annual_returns" in benchmark_metrics:
                    chart_data["benchmark_annual_returns"] = benchmark_metrics[
                        "annual_returns"
                    ]
            elif benchmark_in_portfolio:
                chart_data["benchmark_in_portfolio"] = True
                chart_data["benchmark_index"] = benchmark_index
                if benchmark_metrics and "annual_returns" in benchmark_metrics:
                    chart_data["benchmark_annual_returns"] = benchmark_metrics[
                        "annual_returns"
                    ]

            return jsonify(
                {
                    "metrics": metrics,
                    "benchmark_metrics": benchmark_metrics,
                    "chart_data": chart_data,
                    "correlation_matrix": correlation_data,
                    "success": True,
                }
            )

        except Exception as e:
            current_app.logger.exception("Error analyzing portfolio") # Use app logger
            return jsonify({"error": str(e)}), 500


    @app.route("/download_returns", methods=["GET"])
    def download_returns():
        """Generate and download returns CSV.

        Expected query parameters:
        - tickers: Comma-separated list of tickers
        - weights: Comma-separated list of weights
        - start_date: Portfolio start date (YYYY-MM-DD)
        - end_date: Portfolio end date (YYYY-MM-DD)
        - benchmark_ticker: The benchmark ticker to use
        """
        try:
            # Get query parameters
            tickers = request.args.get("tickers", "").split(",")
            weights_str = request.args.get("weights", "").split(",")
            start_date = request.args.get("start_date")
            end_date = request.args.get("end_date")
            # Use current_app for config within request context
            benchmark_ticker = request.args.get("benchmark_ticker", current_app.config['BENCHMARK_TICKER'])

            # Validate inputs
            if (
                not tickers
                or not weights_str
                or not start_date
                or not end_date
                or tickers[0] == ""
            ):
                return jsonify({"error": "Missing required parameters"}), 400

            try:
                weights = [float(w) for w in weights_str if w]
            except ValueError:
                return jsonify({"error": "Invalid weight values"}), 400

            if len(tickers) != len(weights):
                return jsonify({"error": "Number of tickers must match number of weights"}), 400

            weight_sum = sum(weights)
            if abs(weight_sum - 100) > 0.05:
                 return jsonify({"error": f"Weights must sum to 100% - your total is {weight_sum:.1f}%"}), 400

            # Normalize weights to sum to 1 for calculations
            weights_normalized = [w / 100.0 for w in weights]
            benchmark_ticker_cleaned = benchmark_ticker.split(" (")[0].strip().upper()

            benchmark_in_portfolio = any(
                t.split(" (")[0].strip().upper() == benchmark_ticker_cleaned for t in tickers
            )

            df_portfolio, error_tickers, _ = fetch_portfolio_data(
                tickers, weights_normalized, start_date, end_date
            )

            if error_tickers:
                current_app.logger.warning(f"Could not fetch data for: {error_tickers}") # Use app logger

            if df_portfolio is None or df_portfolio.empty:
                # Don't log warning if error_tickers already handled it
                if not error_tickers:
                     current_app.logger.warning("Could not retrieve portfolio data for CSV download.")
                return jsonify({"error": "Could not retrieve portfolio data"}), 400

            # Fetch benchmark data separately
            benchmark_data = None
            benchmark_error = None
            if benchmark_in_portfolio:
                 # Find the benchmark ticker in the original list to fetch it alone
                 for i, ticker in enumerate(tickers):
                     clean_ticker = ticker.split(" (")[0].strip().upper()
                     if clean_ticker == benchmark_ticker_cleaned:
                         # Fetch only the benchmark data
                         benchmark_data, benchmark_error, _ = fetch_portfolio_data(
                             [clean_ticker], [1.0], start_date, end_date
                         )
                         if benchmark_error:
                             current_app.logger.warning(f"Could not fetch benchmark data (in portfolio): {benchmark_error}")
                         break # Found it
            else:
                benchmark_data, benchmark_error = fetch_benchmark_data(
                    benchmark_ticker_cleaned, start_date, end_date
                )
                if benchmark_error:
                    current_app.logger.warning(f"Could not fetch benchmark data: {benchmark_error}")


            # Prepare CSV with monthly returns
            monthly_returns = pd.DataFrame(index=df_portfolio.index)
            monthly_returns["Portfolio_Return"] = df_portfolio["Monthly Return"]
            monthly_returns.index.name = "Date"

            # Add year and month columns for easier grouping
            monthly_returns["Year"] = monthly_returns.index.year
            monthly_returns["Month"] = monthly_returns.index.month

            # Reorder columns to Year | Month | Portfolio_Return | Benchmark_Return
            column_order = ["Year", "Month", "Portfolio_Return"]

            # Add benchmark monthly returns
            if benchmark_data is not None and not benchmark_data.empty:
                 monthly_returns["Benchmark_Return"] = (
                    benchmark_data["Monthly Return"]
                    .reindex(monthly_returns.index)
                    .fillna(0) # Fill missing benchmark returns with 0 for the period
                 )
                 column_order.append("Benchmark_Return")

            # Calculate annual returns
            # Helper function to calculate annual return from monthly data
            def calculate_annual_return(monthly_returns_series):
                # Compounded return: (1 + r1) * (1 + r2) * ... * (1 + rn) - 1
                return ((1 + monthly_returns_series).prod() - 1) * 100

            # Calculate annual returns for portfolio and benchmark
            annual_returns_list = []
            for year, group in monthly_returns.groupby("Year"):
                 year_data = {"Year": year}
                 year_data["Portfolio_Ann_Return"] = calculate_annual_return(group["Portfolio_Return"])
                 if "Benchmark_Return" in group:
                     year_data["Benchmark_Ann_Return"] = calculate_annual_return(group["Benchmark_Return"])
                 annual_returns_list.append(year_data)

            annual_returns = pd.DataFrame(annual_returns_list)

            # Convert monthly returns to percentage for output
            monthly_returns["Portfolio_Return"] = monthly_returns["Portfolio_Return"] * 100
            if "Benchmark_Return" in monthly_returns.columns:
                monthly_returns["Benchmark_Return"] = monthly_returns["Benchmark_Return"] * 100

            # Reorder columns to Year | Month | Portfolio_Return | Benchmark_Return
            monthly_returns = monthly_returns[column_order]

            # Reorder annual returns columns as well
            annual_column_order = ["Year", "Portfolio_Ann_Return"]
            if "Benchmark_Ann_Return" in annual_returns.columns:
                annual_column_order.append("Benchmark_Ann_Return")
            annual_returns = annual_returns[annual_column_order]

            # Create a combined CSV with both monthly and annual data
            # First, the monthly returns
            csv_buffer = io.StringIO()
            csv_buffer.write("MONTHLY RETURNS\n")
            monthly_returns.to_csv(csv_buffer, index=True, float_format="%.2f")

            # Then add a separator and the annual returns
            csv_buffer.write("\n\nANNUAL RETURNS\n")
            annual_returns.to_csv(csv_buffer, index=False, float_format="%.2f")

            csv_buffer.seek(0)

            # Return as downloadable file with the benchmark name in the filename
            filename = f"portfolio_vs_{benchmark_ticker_cleaned}_returns.csv"

            # Return as downloadable file
            return Response(
                csv_buffer.getvalue(),
                mimetype="text/csv",
                headers={"Content-disposition": f"attachment; filename={filename}"},
            )

        except Exception as e:
            current_app.logger.exception("Error generating returns CSV") # Use app logger
            return jsonify({"error": str(e)}), 500

    # Return the configured app instance
    return app

# --- Main Execution ---
if __name__ == "__main__":
    app = create_app()
    # Use debug=True only for development
    # In production, use a proper WSGI server like Gunicorn or Waitress
    app.run(host="0.0.0.0", port=5000, debug=True)
