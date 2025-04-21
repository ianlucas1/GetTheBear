# tests/test_routes.py
import pytest
import json
import pandas as pd
import io
from flask import current_app
from unittest.mock import patch

# Assuming fixtures 'app', 'client', 'sample_portfolio_data', 'sample_benchmark_data'
# are defined in tests/conftest.py and available here.

# --- /analyze_portfolio Tests ---

def test_analyze_portfolio_success(client, mocker):
    """Test successful portfolio analysis with valid inputs."""
    # Mock the underlying analytics functions

    # Create minimal valid DataFrame structure for mocking
    mock_index = pd.to_datetime(['2020-01-31', '2020-02-29'])
    mock_df = pd.DataFrame({
        'Portfolio Value': [1.0, 1.01],
        'Monthly Return': [0.0, 0.01],
        'Drawdown': [0.0, 0.0]
    }, index=mock_index)
    mock_correlation = {"tickers":['AAPL', 'MSFT'], "matrix":[[1.0, 0.5],[0.5, 1.0]]}
    mock_metrics = {
        "cagr": "10.00%", "sharpe_ratio": "1.00", "annual_returns": {2020: "10.00%"}
    }

    # Patch functions where they are looked up (in portfolio_routes)
    # TODO: Update patch paths if analytics functions move
    mocker.patch('portfolio_routes.fetch_portfolio_data', return_value=(mock_df, None, mock_correlation))
    mocker.patch('portfolio_routes.calculate_metrics', return_value=mock_metrics)
    mocker.patch('portfolio_routes.fetch_benchmark_data', return_value=(mock_df.copy(), None)) # Use a copy for benchmark

    valid_data = {
        "tickers": ["AAPL", "MSFT"],
        "weights": [50, 50],
        "start_date": "2020-01-01",
        "end_date": "2021-01-01",
        "benchmark_ticker": "SPY"
    }
    response = client.post('/analyze_portfolio', json=valid_data)

    assert response.status_code == 200
    assert response.content_type == 'application/json'
    json_data = response.get_json()
    assert json_data.get('success') is True
    assert 'metrics' in json_data
    assert 'benchmark_metrics' in json_data
    assert 'chart_data' in json_data
    assert 'correlation_matrix' in json_data
    # Check if data from mock is present
    assert json_data.get('metrics', {}).get('cagr') == "10.00%"
    assert json_data.get('chart_data', {}).get('benchmark_ticker') == "SPY"
    assert json_data.get('correlation_matrix') == mock_correlation # Added check for correlation

def test_analyze_portfolio_missing_params(client):
    """Test portfolio analysis with missing required parameters."""
    invalid_data = {
        "tickers": ["AAPL"],
        # "weights": [100], # Missing weights
        "start_date": "2020-01-01",
        "end_date": "2021-01-01"
        # Missing benchmark_ticker implicitly
    }
    response = client.post('/analyze_portfolio', json=invalid_data)
    assert response.status_code == 400
    json_data = response.get_json()
    assert 'error' in json_data
    assert "Missing required parameters" in json_data['error']

def test_analyze_portfolio_mismatched_lengths(client):
    """Test portfolio analysis with mismatched tickers/weights lengths."""
    invalid_data = {
        "tickers": ["AAPL", "MSFT"],
        "weights": [100], # Only one weight
        "start_date": "2020-01-01",
        "end_date": "2021-01-01",
        "benchmark_ticker": "SPY"
    }
    response = client.post('/analyze_portfolio', json=invalid_data)
    assert response.status_code == 400
    json_data = response.get_json()
    assert 'error' in json_data
    assert "Number of tickers must match number of weights" in json_data['error']

def test_analyze_portfolio_invalid_weight_sum(client):
    """Test portfolio analysis with weights not summing to 100."""
    invalid_data = {
        "tickers": ["AAPL", "MSFT"],
        "weights": [50, 51], # Sum is 101
        "start_date": "2020-01-01",
        "end_date": "2021-01-01",
        "benchmark_ticker": "SPY"
    }
    response = client.post('/analyze_portfolio', json=invalid_data)
    assert response.status_code == 400
    json_data = response.get_json()
    assert 'error' in json_data
    assert "Weights must sum to 100%" in json_data['error']

def test_analyze_portfolio_invalid_date_format(client):
    """Test portfolio analysis with invalid date format."""
    invalid_data = {
        "tickers": ["AAPL"],
        "weights": [100],
        "start_date": "2020/01/01", # Invalid format
        "end_date": "2021-01-01",
        "benchmark_ticker": "SPY"
    }
    response = client.post('/analyze_portfolio', json=invalid_data)
    assert response.status_code == 400
    json_data = response.get_json()
    assert 'error' in json_data
    assert "Invalid date format" in json_data['error']

def test_analyze_portfolio_start_after_end(client):
    """Test portfolio analysis with start date after end date."""
    invalid_data = {
        "tickers": ["AAPL"],
        "weights": [100],
        "start_date": "2021-01-01",
        "end_date": "2020-01-01", # End before start
        "benchmark_ticker": "SPY"
    }
    response = client.post('/analyze_portfolio', json=invalid_data)
    assert response.status_code == 400
    json_data = response.get_json()
    assert 'error' in json_data
    assert "Start date must be before end date" in json_data['error']

def test_analyze_portfolio_invalid_ticker_format(client):
    """Test portfolio analysis with invalid ticker format."""
    invalid_data = {
        "tickers": ["AAPL$"], # Invalid character
        "weights": [100],
        "start_date": "2020-01-01",
        "end_date": "2021-01-01",
        "benchmark_ticker": "SPY"
    }
    response = client.post('/analyze_portfolio', json=invalid_data)
    assert response.status_code == 400
    json_data = response.get_json()
    assert 'error' in json_data
    assert "Invalid ticker format" in json_data['error']

# Test case where fetching portfolio data fails
@pytest.mark.parametrize("fetch_return, expected_error", [
    ((None, ["BADTICKER"], None), "Could not fetch data for: BADTICKER"),
    ((None, ["T1", "T2"], None), "Could not fetch data for: T1, T2"), # Multiple errors
])
def test_analyze_portfolio_fetch_error(client, mocker, fetch_return, expected_error):
    """Test handling of errors during portfolio data fetching."""
    # Mock validation to succeed
    mocker.patch('portfolio_routes.validate_portfolio_input', return_value=(
        {
            "tickers": fetch_return[1], "weights": [100] * len(fetch_return[1]),
            "weights_normalized": [1.0/len(fetch_return[1])] * len(fetch_return[1]),
            "start_date": "2019-01-01", "end_date": "2023-12-31", "benchmark_ticker": "SPY"
        }, None
    ))
    # Mock portfolio fetch to return the specified error
    mocker.patch('portfolio_routes.fetch_portfolio_data', return_value=fetch_return)
    # Mock benchmark fetch (should not be reached)
    mocker.patch('portfolio_routes.fetch_benchmark_data')
    # Mock calculate metrics (should not be reached)
    mocker.patch('portfolio_routes.calculate_metrics')

    request_data = {
        "tickers": fetch_return[1],
        "weights": [100] * len(fetch_return[1]),
        "start_date": "2019-01-01",
        "end_date": "2023-12-31",
        "benchmark_ticker": "SPY"
    }
    response = client.post('/analyze_portfolio', json=request_data)
    assert response.status_code == 400 # Expect user error for bad ticker
    json_data = response.get_json()
    assert "error" in json_data
    assert expected_error in json_data["error"]

# Test case where internal calculation fails (e.g., calculate_metrics)
# Create minimal valid DataFrame structure for mocking
mock_index_calc = pd.to_datetime(['2019-01-31', '2019-02-28'])
mock_df_calc = pd.DataFrame({'Portfolio Value': [1.0, 1.01]}, index=mock_index_calc)
mock_corr_calc = {"tickers":['GOOD', 'DATA'], "matrix":[[1.0, 1.0],[1.0, 1.0]]}

@patch('portfolio_routes.fetch_portfolio_data', return_value=(mock_df_calc, None, mock_corr_calc))
@patch('portfolio_routes.fetch_benchmark_data', return_value=(mock_df_calc.copy(), None))
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
    # Check for a generic message, assuming the route catches specific exceptions
    assert "An unexpected error occurred" in json_data["error"]


# --- /download_returns Tests ---

@pytest.fixture
def mock_csv_data():
    """Provides mock CSV data for testing downloads."""
    buffer = io.StringIO()
    buffer.write("MONTHLY RETURNS\n")
    buffer.write("Date,Year,Month,Portfolio_Return,Benchmark_Return\n")
    buffer.write("2023-01-31,2023,1,0.00,0.00\n") # Using 0.00 for simplicity in assertion
    buffer.seek(0)
    return buffer

def test_download_returns_success(client, mocker, sample_portfolio_data, sample_benchmark_data, mock_csv_data):
    """Test successful CSV download with valid parameters."""
    # Mock the functions called by the route
    # TODO: Update patch paths if analytics functions move
    mocker.patch('portfolio_routes.validate_portfolio_input', return_value=(
        {
            "tickers": ["AAPL", "GOOG"], "weights": [50, 50], "weights_normalized": [0.5, 0.5],
            "start_date": "2023-01-01", "end_date": "2023-01-31", "benchmark_ticker": "SPY"
        }, None # No error message
    ))
    mocker.patch('portfolio_routes.fetch_portfolio_data', return_value=(sample_portfolio_data, None, None))
    mocker.patch('portfolio_routes.fetch_benchmark_data', return_value=(sample_benchmark_data, None))
    mocker.patch('portfolio_routes.generate_returns_csv', return_value=(mock_csv_data, "portfolio_vs_SPY_returns.csv"))

    query_params = {
        "tickers": "AAPL,GOOG", "weights": "50,50", "start_date": "2023-01-01",
        "end_date": "2023-01-31", "benchmark_ticker": "SPY"
    }
    response = client.get('/download_returns', query_string=query_params)

    assert response.status_code == 200
    # Check mimetype and disposition carefully
    assert response.mimetype == 'text/csv'
    assert 'attachment; filename="portfolio_vs_SPY_returns.csv"' in response.headers['Content-Disposition']
    assert response.data.decode('utf-8') == mock_csv_data.getvalue()

@pytest.mark.parametrize("invalid_param_set, expected_error", [
    ({"tickers": "AAPL", "weights": "100", "start_date": "bad-date", "end_date": "2023-01-01"}, "Invalid date format"),
    ({"tickers": "AAPL,MSFT", "weights": "50,60", "start_date": "2023-01-01", "end_date": "2023-12-31"}, "Weights must sum to 100%"),
    ({"tickers": "AAPL", "weights": "100", "start_date": "2023-01-01"}, "Missing required parameters"), # Missing end_date
])
def test_download_returns_validation_error(client, mocker, invalid_param_set, expected_error):
    """Test download returns fails with various invalid query parameters."""
    # Mock validation to return the specific error (or let it run if it handles these cases)
    # For simplicity, let's assume validate_portfolio_input handles these and returns the error message.
    # If validation is more complex, mock it like in test_app.py
    mocker.patch('portfolio_routes.validate_portfolio_input', return_value=(None, expected_error))

    response = client.get('/download_returns', query_string=invalid_param_set)

    assert response.status_code == 400
    assert response.content_type == 'application/json'
    json_data = response.get_json()
    assert 'error' in json_data
    assert expected_error in json_data['error']


@pytest.mark.parametrize("fetch_return, expected_error", [
    ((None, ["FAIL"], None), "Could not fetch data for: FAIL"),
    ((None, ["T1", "T2"], None), "Could not fetch data for: T1, T2"),
])
def test_download_returns_portfolio_fetch_error(client, mocker, fetch_return, expected_error):
    """Test download returns handles portfolio data fetch errors."""
    # Mock validation to succeed
    mocker.patch('portfolio_routes.validate_portfolio_input', return_value=(
        {"tickers": fetch_return[1], "weights": [100]*len(fetch_return[1]), "weights_normalized": [1.0]*len(fetch_return[1]),
         "start_date": "2023-01-01", "end_date": "2023-01-31", "benchmark_ticker": "SPY"}, None
    ))
    # Mock portfolio fetch to return an error
    mocker.patch('portfolio_routes.fetch_portfolio_data', return_value=fetch_return)
    # Mock benchmark fetch (might not be reached)
    mocker.patch('portfolio_routes.fetch_benchmark_data', return_value=(None, None))
    # Mock CSV generation (should not be reached)
    mocker.patch('portfolio_routes.generate_returns_csv')

    query_params = {
        "tickers": ",".join(fetch_return[1]), "weights": ",".join(["100"]*len(fetch_return[1])),
        "start_date": "2023-01-01", "end_date": "2023-01-31"
    }
    response = client.get('/download_returns', query_string=query_params)

    assert response.status_code == 400 # Error during fetch should be 400
    assert response.content_type == 'application/json'
    json_data = response.get_json()
    assert 'error' in json_data
    assert expected_error in json_data['error']

def test_download_returns_benchmark_fetch_warning(client, mocker, sample_portfolio_data, mock_csv_data):
    """Test download continues but logs warning if only benchmark fetch fails."""
    mocker.patch('portfolio_routes.validate_portfolio_input', return_value=(
        {"tickers": ["AAPL"], "weights": [100], "weights_normalized": [1.0],
         "start_date": "2023-01-01", "end_date": "2023-01-31", "benchmark_ticker": "FAILBENCH"}, None
    ))
    mocker.patch('portfolio_routes.fetch_portfolio_data', return_value=(sample_portfolio_data, None, None))
    # Mock benchmark fetch to return an error message
    mocker.patch('portfolio_routes.fetch_benchmark_data', return_value=(None, "Error fetching benchmark"))
    # Mock CSV generation (should still be called, potentially with benchmark_df=None)
    mocker.patch('portfolio_routes.generate_returns_csv', return_value=(mock_csv_data, "portfolio_vs_FAILBENCH_returns.csv"))

    query_params = {"tickers": "AAPL", "weights": "100", "start_date": "2023-01-01",
                    "end_date": "2023-01-31", "benchmark_ticker": "FAILBENCH"}
    response = client.get('/download_returns', query_string=query_params)

    assert response.status_code == 200 # Should still succeed as portfolio data is present
    assert response.mimetype == 'text/csv'
    assert 'attachment; filename="portfolio_vs_FAILBENCH_returns.csv"' in response.headers['Content-Disposition']
    # Log message check would require log capturing fixture


def test_download_returns_csv_generation_error(client, mocker, sample_portfolio_data, sample_benchmark_data):
    """Test download returns handles errors during CSV generation itself."""
    mocker.patch('portfolio_routes.validate_portfolio_input', return_value=(
        {"tickers": ["AAPL"], "weights": [100], "weights_normalized": [1.0],
         "start_date": "2023-01-01", "end_date": "2023-01-31", "benchmark_ticker": "SPY"}, None
    ))
    mocker.patch('portfolio_routes.fetch_portfolio_data', return_value=(sample_portfolio_data, None, None))
    mocker.patch('portfolio_routes.fetch_benchmark_data', return_value=(sample_benchmark_data, None))
    # Mock CSV generation to return None (simulating failure)
    mocker.patch('portfolio_routes.generate_returns_csv', return_value=None)

    query_params = {"tickers": "AAPL", "weights": "100", "start_date": "2023-01-01",
                    "end_date": "2023-01-31"}
    response = client.get('/download_returns', query_string=query_params)

    assert response.status_code == 500 # Internal error if CSV generation fails
    assert response.content_type == 'application/json'
    json_data = response.get_json()
    assert 'error' in json_data
    assert "Failed to generate CSV data" in json_data['error'] 