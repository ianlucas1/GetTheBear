import pytest
from app import create_app # Import the factory function
import json # Import json for request data
import pandas as pd # Import pandas for DataFrame operations
import io # For mocking StringIO
from flask import current_app

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
    # Make assertion less brittle: check for keyword instead of exact default message
    assert "not found" in json_data['error'].lower() 

def test_app_creation(app):
    """Test if the Flask app instance is created."""
    assert app is not None

def test_testing_config(app):
    """Test if the app is loaded with the TestingConfig."""
    assert app.config['TESTING'] is True
    assert not app.config['DEBUG']
    assert app.config['WTF_CSRF_ENABLED'] is False
    assert 'SECRET_KEY' in app.config
    assert 'SQLALCHEMY_DATABASE_URI' in app.config

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

# --- /download_returns Tests ---

@pytest.fixture
def mock_csv_data():
    """Provides mock CSV data for testing downloads."""
    buffer = io.StringIO()
    buffer.write("MONTHLY RETURNS\n")
    buffer.write("Date,Year,Month,Portfolio_Return,Benchmark_Return\n")
    buffer.write("2023-01-31,2023,1,0.00,0.00\n")
    buffer.seek(0)
    return buffer

def test_download_returns_success(client, mocker, sample_portfolio_data, sample_benchmark_data, mock_csv_data):
    """Test successful CSV download with valid parameters."""
    # Mock the functions called by the route
    mocker.patch('portfolio_routes.validate_portfolio_input', return_value=(
        {
            "tickers": ["AAPL", "GOOG"],
            "weights": [50, 50],
            "weights_normalized": [0.5, 0.5],
            "start_date": "2023-01-01",
            "end_date": "2023-01-31",
            "benchmark_ticker": "SPY"
        }, 
        None # No error message
    ))
    mocker.patch('portfolio_routes.fetch_portfolio_data', return_value=(sample_portfolio_data, None, None))
    mocker.patch('portfolio_routes.fetch_benchmark_data', return_value=(sample_benchmark_data, None))
    mocker.patch('portfolio_routes.generate_returns_csv', return_value=(mock_csv_data, "portfolio_vs_SPY_returns.csv"))

    # Construct query parameters
    query_params = {
        "tickers": "AAPL,GOOG",
        "weights": "50,50",
        "start_date": "2023-01-01",
        "end_date": "2023-01-31",
        "benchmark_ticker": "SPY"
    }
    
    response = client.get('/download_returns', query_string=query_params)

    assert response.status_code == 200
    assert response.mimetype == 'text/csv'
    assert 'attachment; filename=portfolio_vs_SPY_returns.csv' in response.headers['Content-Disposition']
    # Check if the response data matches the mock CSV data
    assert response.data.decode('utf-8') == mock_csv_data.getvalue()

def test_download_returns_validation_error(client, mocker):
    """Test download returns fails with invalid query parameters."""
    # Mock validation to return an error
    mocker.patch('portfolio_routes.validate_portfolio_input', 
                 return_value=(None, "Invalid date format. Please use YYYY-MM-DD"))

    # Parameters don't strictly matter here as validation is mocked to fail
    query_params = {
        "tickers": "AAPL", "weights": "100", "start_date": "bad-date", "end_date": "2023-01-01"
    }
    response = client.get('/download_returns', query_string=query_params)

    assert response.status_code == 400
    assert response.content_type == 'application/json'
    json_data = response.get_json()
    assert 'error' in json_data
    assert "Invalid date format" in json_data['error']

def test_download_returns_portfolio_fetch_error(client, mocker):
    """Test download returns handles portfolio data fetch errors."""
    # Mock validation to succeed
    mocker.patch('portfolio_routes.validate_portfolio_input', return_value=(
        {
            "tickers": ["FAIL"],
            "weights": [100],
            "weights_normalized": [1.0],
            "start_date": "2023-01-01",
            "end_date": "2023-01-31",
            "benchmark_ticker": "SPY"
        }, 
        None
    ))
    # Mock portfolio fetch to return an error
    mocker.patch('portfolio_routes.fetch_portfolio_data', return_value=(None, ["FAIL"], None))
    # Mock benchmark fetch (might not be reached, but good practice)
    mocker.patch('portfolio_routes.fetch_benchmark_data', return_value=(None, None))
    # Mock CSV generation (should not be reached)
    mocker.patch('portfolio_routes.generate_returns_csv', return_value=(None, None))

    query_params = {
        "tickers": "FAIL", "weights": "100", "start_date": "2023-01-01", "end_date": "2023-01-31"
    }
    response = client.get('/download_returns', query_string=query_params)

    assert response.status_code == 400 # Error during fetch should be 400
    assert response.content_type == 'application/json'
    json_data = response.get_json()
    assert 'error' in json_data
    assert "Could not fetch data for: FAIL" in json_data['error']

def test_download_returns_benchmark_fetch_warning(client, mocker, sample_portfolio_data, mock_csv_data):
    """Test download continues but logs warning if only benchmark fetch fails."""
    mocker.patch('portfolio_routes.validate_portfolio_input', return_value=(
        {
            "tickers": ["AAPL"], "weights": [100], "weights_normalized": [1.0],
            "start_date": "2023-01-01", "end_date": "2023-01-31", "benchmark_ticker": "FAILBENCH"
        }, 
        None
    ))
    mocker.patch('portfolio_routes.fetch_portfolio_data', return_value=(sample_portfolio_data, None, None))
    # Mock benchmark fetch to return an error message
    mocker.patch('portfolio_routes.fetch_benchmark_data', return_value=(None, "Error fetching benchmark"))
    # Mock CSV generation (should still be called, potentially with benchmark_df=None)
    mocker.patch('portfolio_routes.generate_returns_csv', return_value=(mock_csv_data, "portfolio_vs_FAILBENCH_returns.csv"))

    query_params = {
        "tickers": "AAPL", "weights": "100", "start_date": "2023-01-01", "end_date": "2023-01-31", "benchmark_ticker": "FAILBENCH"
    }

    response = client.get('/download_returns', query_string=query_params)

    # Should still succeed as portfolio data is present
    assert response.status_code == 200 
    assert response.mimetype == 'text/csv'
    # Log message is checked manually or with log capturing if needed

def test_download_returns_csv_generation_error(client, mocker, sample_portfolio_data, sample_benchmark_data):
    """Test download returns handles errors during CSV generation itself."""
    mocker.patch('portfolio_routes.validate_portfolio_input', return_value=(
        {
            "tickers": ["AAPL"], "weights": [100], "weights_normalized": [1.0],
            "start_date": "2023-01-01", "end_date": "2023-01-31", "benchmark_ticker": "SPY"
        }, 
        None
    ))
    mocker.patch('portfolio_routes.fetch_portfolio_data', return_value=(sample_portfolio_data, None, None))
    mocker.patch('portfolio_routes.fetch_benchmark_data', return_value=(sample_benchmark_data, None))
    # Mock CSV generation to return None (simulating failure)
    mocker.patch('portfolio_routes.generate_returns_csv', return_value=None) 

    query_params = {
        "tickers": "AAPL", "weights": "100", "start_date": "2023-01-01", "end_date": "2023-01-31"
    }
    response = client.get('/download_returns', query_string=query_params)

    assert response.status_code == 500 # Internal error if CSV generation fails
    assert response.content_type == 'application/json'
    json_data = response.get_json()
    assert 'error' in json_data
    assert "Failed to generate CSV data" in json_data['error']

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