import pytest
from app import create_app # Import the factory function
import json # Import json for request data
import pandas as pd # Import pandas for DataFrame operations

# --- Pytest Fixtures ---

@pytest.fixture()
def app():
    """Create and configure a new app instance for each test."""
    # Configure for testing:
    # - TESTING flag enables helpful test features
    # - Set a specific SECRET_KEY for predictability
    # - Use in-memory SQLite database for test isolation
    app = create_app({
        'TESTING': True,
        'SECRET_KEY': 'test-secret-key',
        # Use in-memory SQLite for tests that don't need the real DB
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:', 
        'SQLALCHEMY_TRACK_MODIFICATIONS': False, # Silence FSADeprecationWarning
        'WTF_CSRF_ENABLED': False # Disable CSRF for testing
    })
    yield app

@pytest.fixture()
def client(app):
    """A test client for the app."""
    return app.test_client()

# --- Basic Tests ---

def test_index_route(client):
    """Test if the index route ('/') loads successfully."""
    response = client.get('/')
    assert response.status_code == 200
    # Check if some expected text is in the response
    assert b"Portfolio Setup" in response.data 

def test_404_not_found(client):
    """Test if accessing a non-existent route returns a 404 JSON error."""
    response = client.get('/non-existent-path')
    assert response.status_code == 404
    assert response.content_type == 'application/json'
    json_data = response.get_json()
    assert 'error' in json_data
    assert "Not Found" in json_data['error']

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

    # Patch functions to return minimal valid data
    mocker.patch('app.fetch_portfolio_data', return_value=(mock_df, None, mock_correlation))
    mocker.patch('app.calculate_metrics', return_value=mock_metrics)
    mocker.patch('app.fetch_benchmark_data', return_value=(mock_df.copy(), None)) # Use a copy for benchmark

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

def test_analyze_portfolio_missing_params(client):
    """Test portfolio analysis with missing required parameters."""
    invalid_data = {
        "tickers": ["AAPL"],
        # "weights": [100], # Missing weights
        "start_date": "2020-01-01",
        "end_date": "2021-01-01"
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
        "end_date": "2021-01-01"
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
        "end_date": "2021-01-01"
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
        "end_date": "2021-01-01"
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
        "end_date": "2020-01-01" # End before start
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
        "end_date": "2021-01-01"
    }
    response = client.post('/analyze_portfolio', json=invalid_data)
    assert response.status_code == 400
    json_data = response.get_json()
    assert 'error' in json_data
    assert "Invalid ticker format" in json_data['error']

# --- Placeholder for Future Tests ---
# REMOVE
# def test_analyze_portfolio_valid(client): # REMOVE
#     # Test the /analyze_portfolio endpoint with valid data # REMOVE
#     # Requires mocking analytics functions or providing test data # REMOVE
#     pass # REMOVE
# REMOVE
# def test_analyze_portfolio_invalid_input(client): # REMOVE
#     # Test the /analyze_portfolio endpoint with invalid data (e.g., bad weights) # REMOVE
#     pass # REMOVE
# REMOVE
# def test_download_returns(client): # REMOVE
#     # Test the /download_returns endpoint # REMOVE
#     # Requires mocking analytics functions or providing test data # REMOVE
#     pass # REMOVE