import pytest
import pandas as pd
import io
from datetime import datetime

# Function to test (assuming it's importable)
# Make sure analytics.py is accessible from the tests directory
# (e.g., by running pytest from the root directory or adjusting PYTHONPATH)
from analytics import generate_returns_csv

# --- Fixtures for Test Data ---
# Fixtures moved to tests/conftest.py
# @pytest.fixture
# def sample_portfolio_data(): ...
# @pytest.fixture
# def sample_benchmark_data(): ...
# @pytest.fixture
# def sample_portfolio_with_nan(): ...

# --- Tests for generate_returns_csv --- 

def test_generate_csv_success_with_benchmark(sample_portfolio_data, sample_benchmark_data):
    """Test successful CSV generation with both portfolio and benchmark data."""
    benchmark_ticker = "SPY"
    result = generate_returns_csv(sample_portfolio_data, sample_benchmark_data, benchmark_ticker)
    
    assert result is not None
    csv_buffer, filename = result
    assert isinstance(csv_buffer, io.StringIO)
    assert filename == f"portfolio_vs_{benchmark_ticker}_returns.csv"
    
    csv_content = csv_buffer.getvalue()
    # Basic checks for content structure
    assert "MONTHLY RETURNS" in csv_content
    assert "ANNUAL RETURNS" in csv_content
    assert "Year,Month,Portfolio_Return,Benchmark_Return" in csv_content # Check header order
    assert "Portfolio_Ann_Return,Benchmark_Ann_Return" in csv_content # Check header order
    assert "2023,1,0.00,0.00" in csv_content # Check some data points (formatted)
    assert "2024,1,3.96,2.91" in csv_content 
    # Check annual calculation (simple check based on limited data)
    assert "2023," in csv_content # Check year exists
    assert "2024," in csv_content 

def test_generate_csv_success_no_benchmark(sample_portfolio_data):
    """Test successful CSV generation with only portfolio data."""
    benchmark_ticker = "SPY"
    result = generate_returns_csv(sample_portfolio_data, None, benchmark_ticker)
    
    assert result is not None
    csv_buffer, filename = result
    assert isinstance(csv_buffer, io.StringIO)
    assert filename == f"portfolio_vs_{benchmark_ticker}_returns.csv"
    
    csv_content = csv_buffer.getvalue()
    assert "MONTHLY RETURNS" in csv_content
    assert "ANNUAL RETURNS" in csv_content
    assert "Year,Month,Portfolio_Return" in csv_content # Check header order
    assert "Benchmark_Return" not in csv_content # Ensure benchmark column is absent
    assert "Portfolio_Ann_Return" in csv_content # Check header order
    assert "Benchmark_Ann_Return" not in csv_content
    assert "2023,1,0.00" in csv_content

def test_generate_csv_empty_portfolio_df():
    """Test CSV generation when the portfolio DataFrame is empty."""
    empty_df = pd.DataFrame()
    result = generate_returns_csv(empty_df, None, "SPY")
    assert result is None # Should return None as per function logic

def test_generate_csv_none_portfolio_df():
    """Test CSV generation when the portfolio DataFrame is None."""
    result = generate_returns_csv(None, None, "SPY")
    assert result is None # Should return None

def test_generate_csv_with_nan_values(sample_portfolio_with_nan):
    """Test CSV generation handles NaN values in input DataFrames gracefully."""
    # The function itself should handle NaNs internally (e.g., fillna(0) for calcs)
    # The output CSV might show 0.00 where NaNs were, depending on formatting.
    benchmark_ticker = "QQQ"
    result = generate_returns_csv(sample_portfolio_with_nan, None, benchmark_ticker)
    
    assert result is not None
    csv_buffer, filename = result
    csv_content = csv_buffer.getvalue()
    
    assert "MONTHLY RETURNS" in csv_content
    assert "ANNUAL RETURNS" in csv_content
    # Check that the row corresponding to NaN input is handled (likely becomes 0.00)
    assert "2023,3,0.00" in csv_content # Check if NaN month return became 0.00
    # Check annual calculation (should use fillna(0) internally)
    assert "2023," in csv_content 
    # Value depends on how NaN affects calculation - should not error out
    # Example: If only 2 months valid, annual might be based on those 