import pytest
import pandas as pd
from datetime import datetime
from app import create_app # Import your app factory
from config import TestingConfig # Import your testing config

# --- Common Fixtures for Test Data ---

@pytest.fixture(scope='session') # Scope to session as data is read-only
def sample_portfolio_data():
    """Provides a sample portfolio DataFrame."""
    dates = pd.to_datetime(['2023-01-31', '2023-02-28', '2023-03-31', '2024-01-31'])
    data = {
        'Portfolio Value': [1.0, 1.02, 1.01, 1.05], # Include a dip
        'Monthly Return': [0.0, 0.02, -0.0098039, 0.0396], # Approx returns
        'Drawdown': [0.0, 0.0, -0.0098039, 0.0]
    }
    df = pd.DataFrame(data, index=dates)
    df.index.name = 'Date' 
    return df

@pytest.fixture(scope='session')
def sample_benchmark_data():
    """Provides a sample benchmark DataFrame."""
    dates = pd.to_datetime(['2023-01-31', '2023-02-28', '2023-03-31', '2024-01-31'])
    data = {
        'Portfolio Value': [1.0, 1.01, 1.03, 1.06],
        'Monthly Return': [0.0, 0.01, 0.0198, 0.0291], # Approx returns
        'Drawdown': [0.0, 0.0, 0.0, 0.0]
    }
    df = pd.DataFrame(data, index=dates)
    df.index.name = 'Date' 
    return df

@pytest.fixture(scope='session')
def sample_portfolio_with_nan():
    """Provides portfolio data with a NaN value."""
    dates = pd.to_datetime(['2023-01-31', '2023-02-28', '2023-03-31'])
    data = {
        'Portfolio Value': [1.0, 1.02, None], 
        'Monthly Return': [0.0, 0.02, None],
        'Drawdown': [0.0, 0.0, None]
    }
    df = pd.DataFrame(data, index=dates)
    df.index.name = 'Date'
    return df 

@pytest.fixture(scope='module')
def app():
    """Create and configure a new app instance for each test module."""
    # Create the app with the testing configuration
    app = create_app(test_config=TestingConfig.__dict__) # Pass config as dict

    # Establish an application context before running the tests
    with app.app_context():
        yield app

@pytest.fixture(scope='module')
def client(app):
    """A test client for the app."""
    return app.test_client()

@pytest.fixture(scope='module')
def runner(app):
    """A test runner for the app's Click commands."""
    return app.test_cli_runner() 