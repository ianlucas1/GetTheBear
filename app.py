import os
import logging
from flask import Flask, render_template, request, jsonify, send_file, Response, url_for
import pandas as pd
import io
from analytics import fetch_portfolio_data, calculate_metrics

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "get-the-bear-default-secret")

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
        
        logger.debug(f"Analyzing portfolio: {tickers} with weights {weights} from {start_date} to {end_date}")
        
        # Fetch portfolio data
        df_monthly, error_tickers = fetch_portfolio_data(tickers, weights, start_date, end_date)
        
        if error_tickers:
            return jsonify({
                "error": f"Could not fetch data for the following tickers: {', '.join(error_tickers)}. Please verify they are valid."
            }), 400
        
        if df_monthly is None or df_monthly.empty:
            return jsonify({"error": "Could not retrieve portfolio data"}), 400
        
        # Calculate metrics
        metrics = calculate_metrics(df_monthly)
        
        # Prepare data for charts
        chart_data = {
            'dates': df_monthly.index.strftime('%Y-%m-%d').tolist(),
            'portfolio_values': df_monthly['Portfolio Value'].tolist(),
            'drawdowns': df_monthly['Drawdown'].tolist(),
            'monthly_returns': df_monthly['Monthly Return'].tolist()
        }
        
        return jsonify({
            "metrics": metrics,
            "chart_data": chart_data,
            "success": True
        })
    
    except Exception as e:
        logger.exception("Error analyzing portfolio")
        return jsonify({"error": str(e)}), 500

@app.route('/download_returns', methods=['POST'])
def download_returns():
    """Generate and download monthly returns CSV."""
    try:
        data = request.get_json()
        
        tickers = data.get('tickers', [])
        weights = data.get('weights', [])
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        
        # Validate inputs
        if not tickers or not weights or not start_date or not end_date:
            return jsonify({"error": "Missing required parameters"}), 400
        
        # Normalize weights to sum to 1
        weights = [float(w) for w in weights]
        weight_sum = sum(weights)
        weights = [w / weight_sum for w in weights]
        
        # Fetch portfolio data
        df_monthly, error_tickers = fetch_portfolio_data(tickers, weights, start_date, end_date)
        
        if error_tickers or df_monthly is None or df_monthly.empty:
            return jsonify({"error": "Could not retrieve portfolio data"}), 400
        
        # Prepare CSV
        monthly_returns = df_monthly[['Monthly Return']].copy()
        monthly_returns.index.name = 'Date'
        monthly_returns.columns = ['Monthly_Return']
        
        # Export to CSV
        csv_buffer = io.StringIO()
        monthly_returns.to_csv(csv_buffer)
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
