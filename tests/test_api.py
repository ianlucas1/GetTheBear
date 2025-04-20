# tests/test_api.py
import pytest
import json
import pandas as pd
import io
from unittest.mock import patch, MagicMock

# Mock data for portfolio and benchmark (replace with more realistic data if needed)
MOCK_PORTFOLIO_DF = pd.DataFrame({
    'Portfolio Value': [1.0, 1.02, 1.05],
    'Monthly Return': [0.0, 0.02, 0.0294],
    'Drawdown': [0.0, 0.0, 0.0]
}, index=pd.to_datetime(["2019-01-31", "2019-02-28", "2019-03-31"]))
MOCK_PORTFOLIO_DF.index.name = 'Date'

MOCK_BENCHMARK_DF = pd.DataFrame({
    'Portfolio Value': [1.0, 1.01, 1.03],
    'Monthly Return': [0.0, 0.01, 0.0198],
    'Drawdown': [0.0, 0.0, 0.0]
}, index=pd.to_datetime(["2019-01-31", "2019-02-28", "2019-03-31"]))
MOCK_BENCHMARK_DF.index.name = 'Date'

# Mock metrics dictionary (simplified)
MOCK_METRICS = {"cagr": "10.00%", "volatility": "15.00%", "sharpe_ratio": "0.67", "max_drawdown": "-20.00%", "years": 0.25, "total_return": "5.00%", "annual_returns": {"2019": "5.00%"}}
MOCK_BENCHMARK_METRICS = {"cagr": "12.00%", "volatility": "16.00%", "sharpe_ratio": "0.75", "max_drawdown": "-18.00%", "years": 0.25, "total_return": "3.00%", "annual_returns": {"2019": "3.00%"}}

MOCK_CORRELATION = {
    "tickers": ["AAPL", "MSFT"],
    "matrix": [[1.0, 0.8], [0.8, 1.0]]
}

MOCK_CSV_FILENAME = "mock_returns.csv"
MOCK_CSV_BUFFER = io.StringIO("Date,Portfolio_Return,Benchmark_Return\n2019-01-31,0.02,0.01\n2019-02-28,0.0294,0.0198\n")


# --- /analyze_portfolio Endpoint Tests ---

# Patch the functions where they are imported and used in portfolio_routes.py
@patch('portfolio_routes.fetch_portfolio_data', return_value=(MOCK_PORTFOLIO_DF, None, MOCK_CORRELATION))
@patch('portfolio_routes.fetch_benchmark_data', return_value=(MOCK_BENCHMARK_DF, None))
@patch('portfolio_routes.calculate_metrics', side_effect=[MOCK_METRICS, MOCK_BENCHMARK_METRICS]) # Called twice (portfolio, benchmark)
def test_analyze_portfolio_success(mock_calc_metrics, mock_fetch_bench, mock_fetch_port, client):
    """Test successful portfolio analysis."""
    valid_data = {
        "tickers": ["AAPL", "MSFT"],
        "weights": [50, 50],
        "start_date": "2019-01-01",
        "end_date": "2019-03-31",
        "benchmark_ticker": "SPY"
    }
    response = client.post('/analyze_portfolio', json=valid_data)

    assert response.status_code == 200
    json_data = response.get_json()
    assert json_data["success"] is True
    assert "metrics" in json_data
    assert "benchmark_metrics" in json_data
    assert "chart_data" in json_data
    assert "correlation_matrix" in json_data
    assert json_data["metrics"]["cagr"] == "10.00%" # Check a sample metric
    assert json_data["benchmark_metrics"]["cagr"] == "12.00%"
    assert json_data["chart_data"]["benchmark_ticker"] == "SPY"
    assert json_data["correlation_matrix"] == MOCK_CORRELATION

    # Assert that analytics functions were called
    mock_fetch_port.assert_called_once_with(
        valid_data["tickers"],
        [0.5, 0.5], # Normalized weights
        valid_data["start_date"],
        valid_data["end_date"]
    )
    mock_fetch_bench.assert_called_once_with(
        valid_data["benchmark_ticker"],
        valid_data["start_date"],
        valid_data["end_date"]
    )
    assert mock_calc_metrics.call_count == 2

# Test cache logic separately if implemented with an extension
# This test suite focuses on API validation and flow with mocked analytics

def test_analyze_portfolio_invalid_weights(client):
    """Test analysis request with weights not summing to 100."""
    invalid_data = {
        "tickers": ["AAPL", "MSFT"],
        "weights": [50, 60], # Sum != 100
        "start_date": "2019-01-01",
        "end_date": "2023-12-31",
        "benchmark_ticker": "SPY"
    }
    response = client.post('/analyze_portfolio', json=invalid_data)
    assert response.status_code == 400
    json_data = response.get_json()
    assert "error" in json_data
    assert "Weights must sum to 100%" in json_data["error"]

def test_analyze_portfolio_invalid_dates(client):
    """Test analysis request with start date after end date."""
    invalid_data = {
        "tickers": ["AAPL", "MSFT"],
        "weights": [50, 50],
        "start_date": "2023-01-01", # Start after end
        "end_date": "2022-12-31",
        "benchmark_ticker": "SPY"
    }
    response = client.post('/analyze_portfolio', json=invalid_data)
    assert response.status_code == 400
    json_data = response.get_json()
    assert "error" in json_data
    assert "Start date must be before end date" in json_data["error"]

def test_analyze_portfolio_missing_fields(client):
    """Test analysis request with missing required fields."""
    invalid_data = {
        "tickers": ["AAPL", "MSFT"],
        "weights": [50, 50],
        # Missing dates and benchmark
    }
    response = client.post('/analyze_portfolio', json=invalid_data)
    assert response.status_code == 400
    json_data = response.get_json()
    assert "error" in json_data
    # Update assertion to match actual error message from validation function
    assert "Missing required parameters" in json_data["error"]

# Test case where fetching portfolio data fails
@patch('portfolio_routes.fetch_portfolio_data', return_value=(None, ["BADTICKER"], None))
def test_analyze_portfolio_fetch_error(mock_fetch_port, client):
    """Test handling of errors during portfolio data fetching."""
    valid_data = {
        "tickers": ["BADTICKER"],
        "weights": [100],
        "start_date": "2019-01-01",
        "end_date": "2023-12-31",
        "benchmark_ticker": "SPY"
    }
    response = client.post('/analyze_portfolio', json=valid_data)
    assert response.status_code == 400 # Expect user error for bad ticker
    json_data = response.get_json()
    assert "error" in json_data
    assert "Could not fetch data for: BADTICKER" in json_data["error"]

# Test case where internal calculation fails (e.g., calculate_metrics)
@patch('portfolio_routes.fetch_portfolio_data', return_value=(MOCK_PORTFOLIO_DF, None, MOCK_CORRELATION))
@patch('portfolio_routes.fetch_benchmark_data', return_value=(MOCK_BENCHMARK_DF, None))
@patch('portfolio_routes.calculate_metrics', side_effect=Exception("Calculation Failed"))
def test_analyze_portfolio_calc_error(mock_calc_metrics, mock_fetch_bench, mock_fetch_port, client):
    """Test handling of internal errors during metric calculation."""
    valid_data = {
        "tickers": ["GOOD", "DATA"],
        "weights": [50, 50],
        "start_date": "2019-01-01",
        "end_date": "2019-03-31",
        "benchmark_ticker": "SPY"
    }
    response = client.post('/analyze_portfolio', json=valid_data)
    assert response.status_code == 500 # Expect internal server error
    json_data = response.get_json()
    assert "error" in json_data
    assert "An unexpected error occurred during portfolio analysis." in json_data["error"] # Generic message shown to user


# --- /download_returns Endpoint Tests ---

@patch('portfolio_routes.fetch_portfolio_data', return_value=(MOCK_PORTFOLIO_DF, None, None)) # Fetch needed for CSV
@patch('portfolio_routes.fetch_benchmark_data', return_value=(MOCK_BENCHMARK_DF, None))
@patch('portfolio_routes.generate_returns_csv', return_value=(MOCK_CSV_BUFFER, MOCK_CSV_FILENAME))
def test_download_returns_success(mock_gen_csv, mock_fetch_bench, mock_fetch_port, client):
    """Test successful download of returns CSV."""
    query_params = {
        "tickers": "AAPL,MSFT",
        "weights": "50,50",
        "start_date": "2019-01-01",
        "end_date": "2019-03-31",
        "benchmark_ticker": "SPY"
    }
    response = client.get('/download_returns', query_string=query_params)

    assert response.status_code == 200
    assert response.content_type == 'text/csv; charset=utf-8'
    assert f'attachment; filename={MOCK_CSV_FILENAME}' in response.headers['Content-Disposition']
    # Check if mock CSV data is in the response
    assert MOCK_CSV_BUFFER.getvalue() in response.get_data(as_text=True)
    mock_fetch_port.assert_called_once()
    mock_fetch_bench.assert_called_once()
    mock_gen_csv.assert_called_once()


def test_download_returns_invalid_input(client):
    """Test download request with invalid weights (validation check)."""
    query_params = {
        "tickers": "AAPL,MSFT",
        "weights": "50,60", # Invalid weights
        "start_date": "2019-01-01",
        "end_date": "2023-12-31",
        "benchmark_ticker": "SPY"
    }
    response = client.get('/download_returns', query_string=query_params)
    assert response.status_code == 400
    json_data = response.get_json()
    assert "error" in json_data
    assert "Weights must sum to 100%" in json_data["error"]

@patch('portfolio_routes.fetch_portfolio_data', return_value=(None, ["BADTICKER"], None))
def test_download_returns_fetch_error(mock_fetch_port, client):
    """Test download request when portfolio fetch fails."""
    query_params = {
        "tickers": "BADTICKER",
        "weights": "100",
        "start_date": "2019-01-01",
        "end_date": "2023-12-31",
        "benchmark_ticker": "SPY"
    }
    response = client.get('/download_returns', query_string=query_params)
    assert response.status_code == 400 # User error for bad ticker
    json_data = response.get_json()
    assert "error" in json_data
    assert "Could not fetch data for: BADTICKER" in json_data["error"] 