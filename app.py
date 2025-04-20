import os
import logging
import re # Import regex module
from flask import Flask, render_template, request, jsonify, Response, current_app
import pandas as pd
import io
import math
from datetime import datetime
from analytics import (
    fetch_portfolio_data,
    calculate_metrics,
    fetch_benchmark_data,
)
from flask_wtf import CSRFProtect   #  ← NEW
# Import db object from models.py
from models import db, CacheEntry
from flask.cli import with_appcontext
import click

# --- Helper Function for Input Validation ---
# Define a regex for typical ticker symbols (adjust as needed)
TICKER_REGEX = re.compile(r"^[A-Z0-9.-]+$")

def validate_portfolio_input(data):
    """Validates the input data for portfolio analysis.
    
    Args:
        data (dict): The input data dictionary.
        
    Returns:
        tuple: (validated_data, error_message) 
               validated_data is None if validation fails.
    """
    tickers = data.get("tickers", [])
    weights_str = data.get("weights", []) # Keep as strings initially for validation
    start_date_str = data.get("start_date")
    end_date_str = data.get("end_date")
    # Use current_app config within validation if needed (like here for default)
    benchmark_ticker = data.get("benchmark_ticker", current_app.config.get('BENCHMARK_TICKER', 'SPY')) 

    # 1. Presence checks
    if not tickers or not weights_str or not start_date_str or not end_date_str:
        return None, "Missing required parameters (tickers, weights, start_date, end_date)."
    
    # 2. Length Match
    if len(tickers) != len(weights_str):
         return None, "Number of tickers must match number of weights."

    # 3. Date Format and Range Validation
    try:
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        if start_date >= end_date:
             return None, "Start date must be before end date."
        # Optional: Add check for dates too far in the past/future if needed
    except ValueError:
        return None, "Invalid date format. Please use YYYY-MM-DD."

    # 4. Weight Validation (Type, Range, Sum)
    weights = []
    try:
        for w_str in weights_str:
            weight = float(w_str)
            if weight <= 0:
                return None, "Weights must be positive numbers."
            weights.append(weight)
    except (ValueError, TypeError):
        return None, "Invalid weight values. Please use numbers."
        
    weight_sum = sum(weights)
    if abs(weight_sum - 100) > 0.05:
        return None, f"Weights must sum to 100% - your total is {weight_sum:.1f}%."

    # 5. Ticker Validation (Stricter Format)
    validated_tickers = []
    for ticker in tickers:
        if not isinstance(ticker, str):
             return None, f"Invalid ticker type provided: '{ticker}'."
        
        cleaned_ticker = ticker.strip().upper()
        if not cleaned_ticker:
             return None, "Ticker symbols cannot be empty."
        
        # Apply regex check
        if not TICKER_REGEX.match(cleaned_ticker):
             return None, f"Invalid ticker format: '{ticker}'. Only A-Z, 0-9, ., - allowed."
        validated_tickers.append(cleaned_ticker)

    # 6. Benchmark Ticker Cleaning & Validation
    benchmark_ticker_raw = data.get("benchmark_ticker", current_app.config.get('BENCHMARK_TICKER', 'SPY'))
    benchmark_ticker_cleaned = benchmark_ticker_raw.split(" (")[0].strip().upper()
    if not benchmark_ticker_cleaned:
         return None, "Benchmark ticker cannot be empty."
    # Apply regex check to benchmark ticker
    if not TICKER_REGEX.match(benchmark_ticker_cleaned):
         return None, f"Invalid benchmark ticker format: '{benchmark_ticker_raw}'."

    validated_data = {
        "tickers": validated_tickers, # Use cleaned & validated tickers
        "weights": weights,
        "start_date": start_date_str, 
        "end_date": end_date_str,
        "benchmark_ticker": benchmark_ticker_cleaned, # Use cleaned & validated benchmark
        "weights_normalized": [w / 100.0 for w in weights]
    }
    
    return validated_data, None

# --- Application Factory ---
def create_app(test_config=None):
    """Create and configure an instance of the Flask application."""
    app = Flask(__name__, instance_relative_config=True)

    # --- Configuration ---
    # Default configuration (can be overridden by test_config or environment vars)
    app.config.from_mapping(
        BENCHMARK_TICKER=os.getenv("BENCHMARK_TICKER", "SPY"),
        SQLALCHEMY_DATABASE_URI=os.getenv("DATABASE_URL"),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
    )

    if test_config is None:
        # Load the instance config, if it exists, when not testing
        app.config.from_pyfile('config.py', silent=True)
        # Load secret key from environment variable if not testing
        secret = os.getenv("SESSION_SECRET")
        if not secret:
            raise RuntimeError(
                "SESSION_SECRET environment variable is required. "
                "Export it or add it to .env before starting the app."
            )
        app.config["SECRET_KEY"] = secret
    else:
        # Load the test config if passed in
        app.config.from_mapping(test_config)
        # Ensure SECRET_KEY is set for testing if provided in test_config
        if 'SECRET_KEY' not in app.config:
            raise RuntimeError('SECRET_KEY must be set in test_config')

    # --- CSRF ---
    csrf = CSRFProtect()            #  ← NEW
    csrf.init_app(app)              #  ← NEW

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

    # --- Initialize Extensions ---
    db.init_app(app) # Bind db object to the app

    # --- Create Database Tables ---
    # Check if DATABASE_URL is set before trying to create tables
    if app.config['SQLALCHEMY_DATABASE_URI']:
        with app.app_context():
            try:
                db.create_all() # Create tables based on models
                app.logger.info("Database tables checked/created successfully.")
            except Exception as e:
                app.logger.error(f"Error creating database tables: {str(e)}")
    else:
        app.logger.warning("DATABASE_URL not set. Skipping database table creation.")

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
            if not data:
                 return jsonify({"error": "Invalid JSON payload provided."}), 400

            # --- Use Validation Function --- 
            validated_data, error_message = validate_portfolio_input(data)
            if error_message:
                 return jsonify({"error": error_message}), 400
            
            # Extract validated data
            tickers = validated_data["tickers"]
            weights_normalized = validated_data["weights_normalized"]
            start_date = validated_data["start_date"]
            end_date = validated_data["end_date"]
            benchmark_ticker = validated_data["benchmark_ticker"]
            # --- End Validation ---

            # Check if benchmark is in the portfolio
            benchmark_in_portfolio = False
            benchmark_index = -1
            for i, ticker in enumerate(tickers):
                # Compare against already cleaned benchmark ticker
                if ticker.split(" (")[0] == benchmark_ticker: 
                    benchmark_in_portfolio = True
                    benchmark_index = i
                    break

            current_app.logger.debug(
                f"Analyzing portfolio: {tickers} with weights {weights_normalized} from {start_date} to {end_date}"
            )
            current_app.logger.debug(f"Using benchmark: {benchmark_ticker}")

            # Fetch portfolio data (use normalized weights)
            df_monthly, error_tickers, correlation_data = fetch_portfolio_data(
                tickers, weights_normalized, start_date, end_date
            )

            if error_tickers:
                # Error message format refined during validation/fetching
                return jsonify({"error": error_tickers}), 400 

            if df_monthly is None or df_monthly.empty:
                return jsonify({"error": "Could not retrieve portfolio data"}), 400

            # Fetch benchmark data if not already in the portfolio
            df_benchmark = None
            if not benchmark_in_portfolio:
                df_benchmark, benchmark_error = fetch_benchmark_data(
                    benchmark_ticker, start_date, end_date # Use cleaned benchmark ticker
                )
                if benchmark_error:
                    current_app.logger.warning(f"Could not fetch benchmark data: {benchmark_error}")
                    # Return specific error from fetch function
                    return jsonify({"error": benchmark_error}), 400
            
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
            if "annual_returns" in metrics: chart_data["annual_returns"] = metrics["annual_returns"]
            if df_benchmark is not None and not df_benchmark.empty:
                chart_data["benchmark_values"] = df_benchmark["Portfolio Value"].tolist()
                chart_data["benchmark_drawdowns"] = df_benchmark["Drawdown"].tolist()
                chart_data["benchmark_in_portfolio"] = False
                if benchmark_metrics and "annual_returns" in benchmark_metrics:
                    chart_data["benchmark_annual_returns"] = benchmark_metrics["annual_returns"]
            elif benchmark_in_portfolio:
                chart_data["benchmark_in_portfolio"] = True
                chart_data["benchmark_index"] = benchmark_index
                if benchmark_metrics and "annual_returns" in benchmark_metrics:
                    chart_data["benchmark_annual_returns"] = benchmark_metrics["annual_returns"]

            # -------- scrub NaN / Inf so JSON is valid --------
            def _clean(o):
                if isinstance(o, float) and (math.isnan(o) or math.isinf(o)):
                    return "0.00%"  # Replace NaN/Inf with a default formatted value
                if isinstance(o, str) and o.endswith("%"):
                    try:
                        # If it's a percentage string, try to parse and check for NaN
                        value = float(o.replace("%", ""))
                        if math.isnan(value) or math.isinf(value):
                            return "0.00%"
                    except ValueError:
                        # If it can't be parsed, return the original
                        pass
                # For lists, recursively clean each item
                if isinstance(o, list):
                    return [_clean(v) for v in o]
                # For dicts, recursively clean each value
                if isinstance(o, dict):
                    return {k: _clean(v) for k, v in o.items()}
                # Return the original value unmodified
                return o

            cleaned = _clean(
                {
                    "metrics": metrics,
                    "benchmark_metrics": benchmark_metrics,
                    "chart_data": chart_data,
                    "correlation_matrix": correlation_data,
                    "success": True,
                }
            )
            return jsonify(cleaned)

        except Exception as e:
            current_app.logger.exception("Error analyzing portfolio") # Log full error
            # Return generic message to user
            return jsonify({"error": "An unexpected error occurred during portfolio analysis."}), 500

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
            # --- Use Validation Function (adapting for request.args) --- 
            # Extract args into a dictionary matching validate_portfolio_input expectation
            input_data = {
                 "tickers": request.args.get("tickers", "").split(","),
                 "weights": request.args.get("weights", "").split(","),
                 "start_date": request.args.get("start_date"),
                 "end_date": request.args.get("end_date"),
                 "benchmark_ticker": request.args.get("benchmark_ticker") # Let default be handled inside
            }
             # Handle case where tickers/weights might be empty strings if args are missing
            if input_data["tickers"] == ['']: input_data["tickers"] = []
            if input_data["weights"] == ['']: input_data["weights"] = []
            
            validated_data, error_message = validate_portfolio_input(input_data)
            if error_message:
                 return jsonify({"error": error_message}), 400

            # Extract validated data
            tickers = validated_data["tickers"]
            weights_normalized = validated_data["weights_normalized"]
            start_date = validated_data["start_date"]
            end_date = validated_data["end_date"]
            benchmark_ticker = validated_data["benchmark_ticker"]
            # --- End Validation ---

            # Check if benchmark is in the portfolio
            benchmark_in_portfolio = any(
                t.split(" (")[0] == benchmark_ticker for t in tickers
            )

            # Fetch portfolio data
            df_portfolio, error_tickers, _ = fetch_portfolio_data(
                tickers, weights_normalized, start_date, end_date
            )

            if error_tickers:
                current_app.logger.warning(f"Could not fetch data for CSV: {error_tickers}")
                # Return error appropriately, maybe redirect or show message?
                # For now, returning JSON error, though it's a GET request.
                return jsonify({"error": error_tickers}), 400 

            if df_portfolio is None or df_portfolio.empty:
                if not error_tickers:
                     current_app.logger.warning("Could not retrieve portfolio data for CSV download.")
                return jsonify({"error": "Could not retrieve portfolio data"}), 400

            # Fetch benchmark data separately
            benchmark_data = None
            benchmark_error = None
            if benchmark_in_portfolio:
                 for i, ticker in enumerate(tickers):
                     clean_ticker = ticker.split(" (")[0]
                     if clean_ticker == benchmark_ticker:
                         benchmark_data, benchmark_error, _ = fetch_portfolio_data([clean_ticker], [1.0], start_date, end_date)
                         if benchmark_error: current_app.logger.warning(f"Could not fetch benchmark data (in portfolio) for CSV: {benchmark_error}")
                         break
            else:
                benchmark_data, benchmark_error = fetch_benchmark_data(benchmark_ticker, start_date, end_date)
                if benchmark_error: current_app.logger.warning(f"Could not fetch benchmark data for CSV: {benchmark_error}")

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
            filename = f"portfolio_vs_{benchmark_ticker}_returns.csv"

            # Return as downloadable file
            return Response(
                csv_buffer.getvalue(),
                mimetype="text/csv",
                headers={"Content-disposition": f"attachment; filename={filename}"},
            )

        except Exception as e:
            current_app.logger.exception("Error generating returns CSV") # Log full error
            # Return generic message to user
            return jsonify({"error": "An unexpected error occurred while generating the returns CSV."}), 500

    # Return the configured app instance
    return app

# --- Main Execution ---
if __name__ == "__main__":
    app = create_app()
    # Use debug=True only if FLASK_DEBUG env var is set
    is_debug = os.environ.get('FLASK_DEBUG') == '1'
    app.run(host="0.0.0.0", port=5000, debug=is_debug)
