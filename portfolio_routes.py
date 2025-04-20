import re
import math
import io
from datetime import datetime
from flask import (
    Blueprint, render_template, request, jsonify, Response, current_app
)
import pandas as pd

# Import analytics functions and db (assuming models.py and analytics.py are in the same directory or accessible)
from analytics import (
    fetch_portfolio_data,
    calculate_metrics,
    fetch_benchmark_data,
    generate_returns_csv
)
# Import constants from app - adjust path if needed
# Assuming constants remain in app.py for central access or move them here/to config
# from app import DATE_FORMAT, WEIGHT_TOLERANCE, TICKER_REGEX_PATTERN
# Constants are now accessed via current_app.config

# Define Blueprint
bp = Blueprint('portfolio', __name__)

# --- Helper Function for Input Validation ---
# Define a regex for typical ticker symbols (adjust as needed)
# Access pattern from config
TICKER_REGEX = None # Initialize as None

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

    # Compile regex here using config, ensures it happens within app context
    global TICKER_REGEX
    if TICKER_REGEX is None:
        pattern = current_app.config.get('TICKER_REGEX_PATTERN', r"^[A-Z0-9.-]+$") # Default fallback
        TICKER_REGEX = re.compile(pattern)

    # 3. Date Format and Range Validation
    try:
        date_format = current_app.config.get('DATE_FORMAT', '%Y-%m-%d') # Default fallback
        start_date = datetime.strptime(start_date_str, date_format).date()
        end_date = datetime.strptime(end_date_str, date_format).date()
        if start_date >= end_date:
             return None, "Start date must be before end date."
    except ValueError:
        date_format_display = current_app.config.get('DATE_FORMAT', '%Y-%m-%d').replace('%', '').upper()
        return None, f"Invalid date format. Please use {date_format_display}"

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
    # Use defined tolerance for comparison from config
    weight_tolerance = current_app.config.get('WEIGHT_TOLERANCE', 0.05) # Default fallback
    if abs(weight_sum - 100) > weight_tolerance:
        return None, f"Weights must sum to 100% (±{weight_tolerance}%) - your total is {weight_sum:.1f}%."

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

# -------- scrub NaN / Inf helper --------
# (Moved here as it's only used by analyze_portfolio route in this blueprint)
def _clean(o):
    # Replace float NaN/Inf with None (becomes null in JSON)
    if isinstance(o, float) and (math.isnan(o) or math.isinf(o)):
        return None
    # Keep existing logic for formatted percentage strings (if needed)
    # though ideally formatting happens client-side
    # if isinstance(o, str) and o.endswith("%"):
    #     try:
    #         value = float(o.replace("%", ""))
    #         if math.isnan(value) or math.isinf(value):
    #             return None # Also return None here?
    #     except ValueError:
    #         pass
    # For lists, recursively clean each item
    if isinstance(o, list):
        return [_clean(v) for v in o]
    # For dicts, recursively clean each value
    if isinstance(o, dict):
        return {k: _clean(v) for k, v in o.items()}
    # Return the original value unmodified
    return o


# --- Routes ---
@bp.route("/")
def index():
    """Render the main page of the application."""
    return render_template("index.html")

@bp.route("/analyze_portfolio", methods=["POST"])
def analyze_portfolio():
    """
    Process portfolio data and return analysis results.
    (Logic moved from app.py)
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
            # Ensure error_tickers is a list of strings before joining
            if isinstance(error_tickers, list):
                error_msg_detail = ", ".join(map(str, error_tickers))
                return jsonify({"error": f"Could not fetch data for: {error_msg_detail}"}), 400
            else:
                # Handle unexpected error format
                 return jsonify({"error": "Could not retrieve portfolio data due to invalid ticker(s)."}), 400

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
                return jsonify({"error": "Failed to fetch benchmark data. Please try again later."}), 400

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
        # Ensure metrics['annual_returns'] exists before accessing
        if metrics and "annual_returns" in metrics: 
            chart_data["annual_returns"] = metrics["annual_returns"]
            
        if df_benchmark is not None and not df_benchmark.empty:
            chart_data["benchmark_values"] = df_benchmark["Portfolio Value"].tolist()
            chart_data["benchmark_drawdowns"] = df_benchmark["Drawdown"].tolist()
            chart_data["benchmark_in_portfolio"] = False
            # Ensure benchmark_metrics and its 'annual_returns' exists
            if benchmark_metrics and "annual_returns" in benchmark_metrics: 
                chart_data["benchmark_annual_returns"] = benchmark_metrics["annual_returns"]
        elif benchmark_in_portfolio:
            chart_data["benchmark_in_portfolio"] = True
            chart_data["benchmark_index"] = benchmark_index
            # Ensure benchmark_metrics and its 'annual_returns' exists
            if benchmark_metrics and "annual_returns" in benchmark_metrics: 
                chart_data["benchmark_annual_returns"] = benchmark_metrics["annual_returns"]

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


@bp.route("/download_returns", methods=["GET"])
def download_returns():
    """
    Generate and download returns CSV.
    (Logic moved from app.py)
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

        # --- Data Fetching (will use cache if enabled and available) ---
        # Fetch portfolio data (required for CSV)
        df_portfolio, fetch_error_tickers, _ = fetch_portfolio_data(
            tickers, weights_normalized, start_date, end_date
        )

        # Handle errors during portfolio data fetch
        if fetch_error_tickers:
            # Combine error messages if necessary
            if isinstance(fetch_error_tickers, list):
                error_msg = f"Could not fetch data for: {', '.join(map(str, fetch_error_tickers))}"
            else: # Handle unexpected format
                error_msg = "Could not fetch data for one or more tickers."
            current_app.logger.warning(f"Error fetching data for CSV: {error_msg}")
            return jsonify({"error": error_msg}), 400

        if df_portfolio is None or df_portfolio.empty:
             current_app.logger.warning("Could not retrieve portfolio data for CSV download.")
             return jsonify({"error": "Could not retrieve portfolio data"}), 400

        # Fetch benchmark data (optional, but needed for comparison)
        df_benchmark = None
        benchmark_error = None
        benchmark_in_portfolio = any(t == benchmark_ticker for t in tickers)

        if not benchmark_in_portfolio:
            df_benchmark, benchmark_error = fetch_benchmark_data(
                benchmark_ticker, start_date, end_date
            )
            if benchmark_error:
                # Log warning but don't necessarily block download if only benchmark fails
                current_app.logger.warning(f"Could not fetch benchmark data for CSV: {benchmark_error}")
        else:
            # If benchmark is in portfolio, fetch its data separately for CSV comparison column
             df_benchmark, benchmark_error, _ = fetch_portfolio_data(
                 [benchmark_ticker], [1.0], start_date, end_date
             )
             if benchmark_error:
                current_app.logger.warning(f"Could not fetch benchmark data (in portfolio) for CSV: {benchmark_error}")

        # --- Generate CSV using refactored function ---
        # Handle potential None return from generate_returns_csv
        result = generate_returns_csv(df_portfolio, df_benchmark, benchmark_ticker)
        if result is None:
            current_app.logger.error("CSV generation failed unexpectedly (generate_returns_csv returned None).")
            return jsonify({"error": "Failed to generate CSV data."}), 500
        
        csv_buffer, filename = result

        # --- Return CSV Response ---
        return Response(
            csv_buffer.getvalue(),
            mimetype="text/csv",
            headers={"Content-disposition": f"attachment; filename={filename}"},
        )

    except Exception as e:
        current_app.logger.exception("Error generating returns CSV") # Log full error
        # Return generic message to user
        return jsonify({"error": "An unexpected error occurred while generating the returns CSV."}), 500 