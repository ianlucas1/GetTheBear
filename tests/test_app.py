import pytest
from app import create_app # Import the factory function

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
        'SQLALCHEMY_TRACK_MODIFICATIONS': False # Silence FSADeprecationWarning
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

# --- Placeholder for Future Tests ---
# def test_analyze_portfolio_valid(client):
#     # Test the /analyze_portfolio endpoint with valid data
#     # Requires mocking analytics functions or providing test data
#     pass

# def test_analyze_portfolio_invalid_input(client):
#     # Test the /analyze_portfolio endpoint with invalid data (e.g., bad weights)
#     pass

# def test_download_returns(client):
#     # Test the /download_returns endpoint
#     # Requires mocking analytics functions or providing test data
#     pass 