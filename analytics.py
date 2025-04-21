# Legacy analytics.py - Functionality moved to analytics/ subpackage
# This file can likely be removed if all imports are updated.

# Keep imports that *might* be needed by other modules if they
# were importing directly from here, although they should be
# updated to import from analytics/ submodules or analytics/__init__.py
import logging
import pandas as pd
import yfinance as yf
import math
import os
import json
import hashlib
from datetime import datetime, timedelta, timezone
import io

# Configure logger (might be overridden by app factory)
# logger = logging.getLogger(__name__)
# logger.addHandler(logging.NullHandler()) # Prevent "No handler found" warnings

# --- Functionality has been moved --- 
# - generate_cache_key, CACHE_DURATION -> analytics.caching
# - fetch_portfolio_data, fetch_benchmark_data -> analytics.fetching
# - calculate_metrics -> analytics.calculation
# - generate_returns_csv -> analytics.csv_generator
