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
    - benchmark_ticker: Custom benchmark ticker (optional, defaults to SPY)
    """
    try:
        data = request.get_json()
        
        tickers = data.get('tickers', [])
        weights = data.get('weights', [])
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        benchmark_ticker = data.get('benchmark_ticker', BENCHMARK_TICKER)
        
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
        
        # Clean up benchmark ticker
        benchmark_ticker = benchmark_ticker.split(" (")[0].strip().upper()
        
        # Check if benchmark is in the portfolio
        benchmark_in_portfolio = False
        benchmark_index = -1
        
        # Look for the benchmark ticker in the portfolio tickers (considering tickers might have the benchmark label)
        for i, ticker in enumerate(tickers):
            # Remove any benchmark labels for comparison
            clean_ticker = ticker.split(" (")[0].strip().upper()
            if clean_ticker == benchmark_ticker:
                benchmark_in_portfolio = True
                benchmark_index = i
                break
        
        logger.debug(f"Analyzing portfolio: {tickers} with weights {weights} from {start_date} to {end_date}")
        logger.debug(f"Using benchmark: {benchmark_ticker}")
        
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
            df_benchmark, benchmark_error = fetch_benchmark_data(benchmark_ticker, start_date, end_date)
            
            if benchmark_error:
                logger.warning(f"Could not fetch benchmark data: {benchmark_error}")
                return jsonify({"error": f"Could not fetch benchmark data for {benchmark_ticker}: {benchmark_error}"}), 400
            
        # Calculate metrics for the portfolio
        metrics = calculate_metrics(df_monthly)
        
        # Calculate metrics for the benchmark
        benchmark_metrics = None
        if benchmark_in_portfolio:
            # Create a separate dataframe for the benchmark using just that ticker's price data
            clean_ticker = tickers[benchmark_index].split(" (")[0]
            benchmark_only_data, _ = fetch_portfolio_data([clean_ticker], [1.0], start_date, end_date)
            if benchmark_only_data is not None and not benchmark_only_data.empty:
                benchmark_metrics = calculate_metrics(benchmark_only_data)
        elif df_benchmark is not None and not df_benchmark.empty:
            benchmark_metrics = calculate_metrics(df_benchmark)
        
        # Prepare data for charts
        chart_data = {
            'dates': df_monthly.index.strftime('%Y-%m-%d').tolist(),
            'portfolio_values': df_monthly['Portfolio Value'].tolist(),
            'drawdowns': df_monthly['Drawdown'].tolist(),
            'monthly_returns': df_monthly['Monthly Return'].tolist(),
            'benchmark_ticker': benchmark_ticker
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
            
            # If the benchmark is in the portfolio, we still need its specific metrics
            # for the charts, so include benchmark annual returns
            if benchmark_metrics and 'annual_returns' in benchmark_metrics:
                chart_data['benchmark_annual_returns'] = benchmark_metrics['annual_returns']
        
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
        tickers = request.args.get('tickers', '').split(',')
        weights_str = request.args.get('weights', '').split(',')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        benchmark_ticker = request.args.get('benchmark_ticker', BENCHMARK_TICKER)
        
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
        
        # Clean up benchmark ticker
        benchmark_ticker = benchmark_ticker.split(" (")[0].strip().upper()
        
        # Check if benchmark is in the portfolio
        benchmark_in_portfolio = False
        for ticker in tickers:
            # Remove any benchmark labels for comparison
            clean_ticker = ticker.split(" (")[0].strip().upper()
            if clean_ticker == benchmark_ticker:
                benchmark_in_portfolio = True
                break
        
        # Fetch portfolio data
        df_portfolio, error_tickers = fetch_portfolio_data(tickers, weights, start_date, end_date)
        
        if error_tickers:
            logger.warning(f"Could not fetch data for: {error_tickers}")
        
        if df_portfolio is None or df_portfolio.empty:
            return jsonify({"error": "Could not retrieve portfolio data"}), 400
        
        # Prepare CSV with monthly returns
        monthly_returns = pd.DataFrame(index=df_portfolio.index)
        monthly_returns['Portfolio_Return'] = df_portfolio['Monthly Return']
        monthly_returns.index.name = 'Date'
        
        # Add year and month columns for easier grouping
        monthly_returns['Year'] = monthly_returns.index.year
        monthly_returns['Month'] = monthly_returns.index.month
        
        # Fetch benchmark data if not already in the portfolio
        benchmark_data = None
        if benchmark_in_portfolio:
            # Create a separate dataframe for the benchmark using just that ticker
            for i, ticker in enumerate(tickers):
                clean_ticker = ticker.split(" (")[0].strip().upper()
                if clean_ticker == benchmark_ticker:
                    benchmark_only_data, _ = fetch_portfolio_data([clean_ticker], [1.0], start_date, end_date)
                    if benchmark_only_data is not None and not benchmark_only_data.empty:
                        benchmark_data = benchmark_only_data
                    break
        else:
            # Fetch benchmark data
            benchmark_data, benchmark_error = fetch_benchmark_data(benchmark_ticker, start_date, end_date)
            if benchmark_error:
                logger.warning(f"Could not fetch benchmark data: {benchmark_error}")
        
        # Add benchmark to the monthly returns CSV
        if benchmark_data is not None and not benchmark_data.empty:
            monthly_returns[f'Benchmark_Return'] = benchmark_data['Monthly Return'].reindex(monthly_returns.index).fillna(0)
        
        # Calculate annual returns
        # Group by year and calculate annual returns for portfolio
        annual_returns = pd.DataFrame()
        annual_returns['Year'] = monthly_returns['Year'].drop_duplicates().sort_values()
        
        # Calculate annual portfolio returns
        portfolio_annual = {}
        for year, group in monthly_returns.groupby('Year'):
            # Get the portfolio value at the beginning and end of the year
            if 'Portfolio Value' in df_portfolio.columns:
                year_data = df_portfolio[df_portfolio['Year'] == year]['Portfolio Value']
                if not year_data.empty:
                    first_value = year_data.iloc[0]
                    last_value = year_data.iloc[-1]
                    annual_return = (last_value / first_value) - 1
                    portfolio_annual[year] = annual_return * 100  # Convert to percentage
        
        # Calculate annual benchmark returns
        benchmark_annual = {}
        if benchmark_data is not None and not benchmark_data.empty:
            for year, group in monthly_returns.groupby('Year'):
                # Get the benchmark value at the beginning and end of the year
                if 'Portfolio Value' in benchmark_data.columns:
                    year_data = benchmark_data[benchmark_data['Year'] == year]['Portfolio Value']
                    if not year_data.empty:
                        first_value = year_data.iloc[0]
                        last_value = year_data.iloc[-1]
                        annual_return = (last_value / first_value) - 1
                        benchmark_annual[year] = annual_return * 100  # Convert to percentage
        
        # Add annual returns to the CSV
        for year in annual_returns['Year']:
            annual_returns.loc[annual_returns['Year'] == year, 'Portfolio_Ann_Return'] = portfolio_annual.get(year, 0)
            annual_returns.loc[annual_returns['Year'] == year, 'Benchmark_Ann_Return'] = benchmark_annual.get(year, 0)
        
        # Make sure we have all the data
        annual_returns.fillna(0, inplace=True)
                
        # Debug the output
        logger.debug(f"CSV Data: \n{monthly_returns.head()}")
        logger.debug(f"Annual CSV Data: \n{annual_returns.head()}")
        
        # Convert to percentage values for easier reading
        monthly_returns['Portfolio_Return'] = monthly_returns['Portfolio_Return'] * 100
        if 'Benchmark_Return' in monthly_returns.columns:
            monthly_returns['Benchmark_Return'] = monthly_returns['Benchmark_Return'] * 100
        
        # Create a combined CSV with both monthly and annual data
        # First, the monthly returns
        csv_buffer = io.StringIO()
        csv_buffer.write("MONTHLY RETURNS\n")
        monthly_returns.to_csv(csv_buffer, index=True, float_format='%.2f')
        
        # Then add a separator and the annual returns
        csv_buffer.write("\n\nANNUAL RETURNS\n")
        annual_returns.to_csv(csv_buffer, index=False, float_format='%.2f')
        
        csv_buffer.seek(0)
        
        # Return as downloadable file with the benchmark name in the filename
        filename = f"portfolio_vs_{benchmark_ticker}_returns.csv"
        
        # Return as downloadable file
        return Response(
            csv_buffer.getvalue(),
            mimetype="text/csv",
            headers={"Content-disposition": f"attachment; filename={filename}"}
        )
    
    except Exception as e:
        logger.exception("Error generating returns CSV")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
