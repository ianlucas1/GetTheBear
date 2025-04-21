import logging

# Make functions available directly from the analytics package
from .caching import generate_cache_key, CACHE_DURATION
from .fetching import fetch_portfolio_data, fetch_benchmark_data
from .calculation import calculate_metrics
from .csv_generator import generate_returns_csv

# Configure logger for the analytics package
logger = logging.getLogger(__name__)
# Prevent duplicate logs if root logger is also configured
logger.propagate = False 

# Add a default null handler to prevent "No handler found" warnings
# if no specific handler is added downstream.
if not logger.handlers:
    logger.addHandler(logging.NullHandler())

# Optionally set a default level for the package logger
# logger.setLevel(logging.INFO) # Or logging.DEBUG, etc.

__all__ = [
    'generate_cache_key',
    'CACHE_DURATION',
    'fetch_portfolio_data',
    'fetch_benchmark_data',
    'calculate_metrics',
    'generate_returns_csv',
    'logger'
]
