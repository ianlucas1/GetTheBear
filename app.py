import os
import logging
from flask import Flask, render_template, request, jsonify, send_file, Response, url_for
import pandas as pd
import io
import psycopg2
from analytics import fetch_portfolio_data, calculate_metrics, fetch_benchmark_data, setup_cache_table

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "get-the-bear-default-secret")

# Define benchmark ticker
BENCHMARK_TICKER = "SPY"

# Setup cache table in PostgreSQL
try:
    setup_cache_table()
    logger.info("Cache table setup complete")
except Exception as e:
    logger.error(f"Error setting up cache table: {str(e)}")

@app.route('/')
def index():
    """Render the main page of the application."""
    return render_template('index.html')

@app.route('/analyze_portfolio', methods=['POST'])
def analyze_portfolio():
    """
    Process portfolio data and return analysis results.
    
    Expects a JSON with:
    - tickers: List of stock tickers
    - weights: List of weights corresponding to tickers
    - start_date: Portfolio start date (YYYY-MM-DD)
    - end_date: Portfolio end date (YYYY-MM-DD)
    """
    try:
        data = request.get_json()
        
        tickers = data.get('tickers', [])
        weights = data.get('weights', [])
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        
        # Validate inputs
        if not tickers or not weights or not start_date or not end_date:
            return jsonify({"error": "Missing required parameters"}), 400
        
        if len(tickers) != len(weights):
            return jsonify({"error": "Number of tickers must match number of weights"}), 400
            
        # Normalize weights to sum to 1
        weights = [float(w) for w in weights]
        weight_sum = sum(weights)
        if weight_sum <= 0:
            return jsonify({"error": "Sum of weights must be positive"}), 400
        weights = [w / weight_sum for w in weights]
        
        # Check if benchmark is in the portfolio
        benchmark_in_portfolio = BENCHMARK_TICKER in tickers
        benchmark_index = tickers.index(BENCHMARK_TICKER) if benchmark_in_portfolio else -1
        
        logger.debug(f"Analyzing portfolio: {tickers} with weights {weights} from {start_date} to {end_date}")
        
        # Fetch portfolio data
        df_monthly, error_tickers = fetch_portfolio_data(tickers, weights, start_date, end_date)
        
        if error_tickers:
            return jsonify({
                "error": f"Could not fetch data for the following tickers: {', '.join(error_tickers)}. Please verify they are valid."
            }), 400
        
        if df_monthly is None or df_monthly.empty:
            return jsonify({"error": "Could not retrieve portfolio data"}), 400
        
        # Fetch benchmark data if not already in the portfolio
        df_benchmark = None
        if not benchmark_in_portfolio:
            df_benchmark, benchmark_error = fetch_benchmark_data(BENCHMARK_TICKER, start_date, end_date)
            
            if benchmark_error:
                logger.warning(f"Could not fetch benchmark data: {benchmark_error}")
            
        # Calculate metrics for the portfolio
        metrics = calculate_metrics(df_monthly)
        
        # Calculate metrics for the benchmark
        benchmark_metrics = None
        if benchmark_in_portfolio:
            # Use portfolio data to calculate benchmark metrics
            benchmark_metrics = calculate_metrics(df_monthly, is_benchmark=True)
        elif df_benchmark is not None and not df_benchmark.empty:
            benchmark_metrics = calculate_metrics(df_benchmark)
        
        # Prepare data for charts
        chart_data = {
            'dates': df_monthly.index.strftime('%Y-%m-%d').tolist(),
            'portfolio_values': df_monthly['Portfolio Value'].tolist(),
            'drawdowns': df_monthly['Drawdown'].tolist(),
            'monthly_returns': df_monthly['Monthly Return'].tolist()
        }
        
        # Add annual returns data
        if 'annual_returns' in metrics:
            chart_data['annual_returns'] = metrics['annual_returns']
        
        # Add benchmark data to chart data if available
        if df_benchmark is not None and not df_benchmark.empty:
            chart_data['benchmark_values'] = df_benchmark['Portfolio Value'].tolist()
            chart_data['benchmark_drawdowns'] = df_benchmark['Drawdown'].tolist()
            chart_data['benchmark_in_portfolio'] = False
            
            # Add benchmark annual returns if available
            if benchmark_metrics and 'annual_returns' in benchmark_metrics:
                chart_data['benchmark_annual_returns'] = benchmark_metrics['annual_returns']
                
        elif benchmark_in_portfolio:
            chart_data['benchmark_in_portfolio'] = True
            chart_data['benchmark_index'] = benchmark_index
        
        return jsonify({
            "metrics": metrics,
            "benchmark_metrics": benchmark_metrics,
            "chart_data": chart_data,
            "success": True
        })
    
    except Exception as e:
        logger.exception("Error analyzing portfolio")
        return jsonify({"error": str(e)}), 500

@app.route('/download_returns', methods=['GET'])
def download_returns():
    """Generate and download monthly returns CSV.
    
    Expected query parameters:
    - tickers: Comma-separated list of tickers
    - weights: Comma-separated list of weights
    - start_date: Portfolio start date (YYYY-MM-DD)
    - end_date: Portfolio end date (YYYY-MM-DD)
    """
    try:
        # Get query parameters
        tickers = request.args.get('tickers', '').split(',')
        weights_str = request.args.get('weights', '').split(',')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Validate inputs
        if not tickers or not weights_str or not start_date or not end_date or tickers[0] == '':
            return jsonify({"error": "Missing required parameters"}), 400
        
        # Convert weights to float
        try:
            weights = [float(w) for w in weights_str if w]
        except ValueError:
            return jsonify({"error": "Invalid weight values"}), 400
        
        if len(tickers) != len(weights):
            return jsonify({"error": "Number of tickers must match number of weights"}), 400
        
        # Normalize weights to sum to 1
        weight_sum = sum(weights)
        if weight_sum <= 0:
            return jsonify({"error": "Sum of weights must be positive"}), 400
        weights = [w / weight_sum for w in weights]
        
        # Fetch portfolio data
        df_monthly, error_tickers = fetch_portfolio_data(tickers, weights, start_date, end_date)
        
        if error_tickers:
            logger.warning(f"Could not fetch data for: {error_tickers}")
        
        if df_monthly is None or df_monthly.empty:
            return jsonify({"error": "Could not retrieve portfolio data"}), 400
        
        # Prepare CSV
        # Make sure we're using the actual monthly returns data
        monthly_returns = pd.DataFrame(index=df_monthly.index)
        monthly_returns['Portfolio_Return'] = df_monthly['Monthly Return']
        monthly_returns.index.name = 'Date'
        
        # Add benchmark to the CSV if available
        if BENCHMARK_TICKER not in tickers:
            df_benchmark, benchmark_error = fetch_benchmark_data(BENCHMARK_TICKER, start_date, end_date)
            if df_benchmark is not None and not df_benchmark.empty:
                monthly_returns['Benchmark_Return'] = df_benchmark['Monthly Return']
                
        # Debug the output
        logger.debug(f"CSV Data: \n{monthly_returns.head()}")
        
        # Make sure we have data in the CSV
        if monthly_returns['Portfolio_Return'].sum() == 0:
            logger.warning("CSV data has all zeros for Portfolio_Return")
            
        # Convert to percentage values for easier reading
        monthly_returns['Portfolio_Return'] = monthly_returns['Portfolio_Return'] * 100
        if 'Benchmark_Return' in monthly_returns.columns:
            monthly_returns['Benchmark_Return'] = monthly_returns['Benchmark_Return'] * 100
        
        # Export to CSV with index (date column)
        csv_buffer = io.StringIO()
        monthly_returns.to_csv(csv_buffer, index=True, float_format='%.2f')
        csv_buffer.seek(0)
        
        # Return as downloadable file
        return Response(
            csv_buffer.getvalue(),
            mimetype="text/csv",
            headers={"Content-disposition": f"attachment; filename=portfolio_returns.csv"}
        )
    
    except Exception as e:
        logger.exception("Error generating returns CSV")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
