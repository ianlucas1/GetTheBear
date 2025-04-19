import logging
import numpy as np
import pandas as pd
import yfinance as yf
import math
import os
import json
import hashlib
from datetime import datetime, timedelta, timezone

# Import db stuff from models and Flask app context
from models import db, CacheEntry
from flask import current_app

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Get DB connection details from environment variables
DB_URL = os.environ.get("DATABASE_URL")

# Cache duration (e.g., 1 day)
CACHE_DURATION = timedelta(days=1)

# --- Helper Function for Cache Key ---
def generate_cache_key(prefix, params):
    """Generates a deterministic cache key (SHA256 hash)."""
    # Sort params dict by key for consistent hashing
    sorted_params_str = json.dumps(params, sort_keys=True)
    key_string = f"{prefix}:{sorted_params_str}"
    return hashlib.sha256(key_string.encode('utf-8')).hexdigest()

def get_cached_stock_data(ticker, start_date, end_date, interval="1mo"):
    """
    Try to get stock data from cache

    Returns:
        DataFrame or None: The cached data if available, otherwise None
    """
    conn = psycopg2.connect(DB_URL)
    try:
        cursor = conn.cursor()

        # Look for cached data
        cursor.execute(
            """
            SELECT data FROM stock_price_cache
            WHERE ticker = %s
            AND start_date = %s
            AND end_date = %s
            AND interval = %s
        """,
            (ticker, start_date, end_date, interval),
        )

        result = cursor.fetchone()

        if result:
            logger.info(f"Cache hit for {ticker} from {start_date} to {end_date}")
            # Convert JSON to DataFrame
            json_data = result[0]

            try:
                # For records oriented JSON (new format)
                df_records = pd.DataFrame(json.loads(json_data))

                # Set the Date/index column as the index
                if "Date" in df_records.columns:
                    df_records.set_index("Date", inplace=True)
                elif "index" in df_records.columns:
                    df_records.set_index("index", inplace=True)
                elif "date" in df_records.columns:
                    df_records.set_index("date", inplace=True)

                # Ensure index is datetime type
                df_records.index = pd.to_datetime(df_records.index)

                return df_records
            except Exception as e:
                logger.warning(
                    f"Error parsing cached data with records format: {str(e)}"
                )
                try:
                    # Try table oriented JSON (old format) as fallback
                    df = pd.read_json(json_data, orient="table")
                    df.index = pd.to_datetime(df.index)
                    return df
                except Exception as e2:
                    logger.error(f"Error parsing cached data: {str(e2)}")
                    return None
        else:
            logger.info(f"Cache miss for {ticker} from {start_date} to {end_date}")
            return None
    finally:
        conn.close()


def cache_stock_data(ticker, df, start_date, end_date, interval="1mo"):
    """
    Store stock data in cache

    Args:
        ticker (str): Stock ticker
        df (DataFrame): Stock price data
        start_date (str): Start date
        end_date (str): End date
        interval (str): Data interval
    """
    if df is None or df.empty:
        logger.warning(f"Not caching empty data for {ticker}")
        return

    conn = psycopg2.connect(DB_URL)
    try:
        cursor = conn.cursor()

        # Handle MultiIndex columns in dataframe (common with yfinance)
        if isinstance(df.columns, pd.MultiIndex):
            # Extract just the Close column for the ticker
            if (ticker, "Close") in df.columns:
                close_data = df[(ticker, "Close")].copy()
                # Create a new DataFrame with just the date index and Close price
                simple_df = pd.DataFrame({"Close": close_data}, index=df.index)
                df_to_cache = simple_df
            else:
                # Try to get the first Close column
                close_cols = [col for col in df.columns if col[1] == "Close"]
                if close_cols:
                    close_data = df[close_cols[0]].copy()
                    simple_df = pd.DataFrame({"Close": close_data}, index=df.index)
                    df_to_cache = simple_df
                else:
                    logger.warning(f"No Close column found for {ticker}, cannot cache")
                    return
        else:
            # Single-level columns - use as is
            df_to_cache = df.copy()

        # Convert DataFrame to JSON (with records orient to avoid MultiIndex issues)
        df_to_cache_reset = df_to_cache.reset_index()
        json_data = df_to_cache_reset.to_json(date_format="iso", orient="records")

        # Insert or update cache
        cursor.execute(
            """
            INSERT INTO stock_price_cache (ticker, start_date, end_date, interval, data)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (ticker, start_date, end_date, interval) 
            DO UPDATE SET data = %s, retrieved_at = CURRENT_TIMESTAMP
        """,
            (ticker, start_date, end_date, interval, json_data, json_data),
        )

        conn.commit()
        logger.info(f"Cached data for {ticker} from {start_date} to {end_date}")
    except Exception as e:
        logger.error(f"Error caching data: {str(e)}")
        conn.rollback()
    finally:
        conn.close()


def fetch_portfolio_data(tickers, weights, start_date, end_date):
    """Fetch portfolio data, using cache if available and valid."""
    
    # Check if database is configured
    use_cache = bool(current_app.config.get('SQLALCHEMY_DATABASE_URI'))
    cache_entry = None
    cache_key = None

    if use_cache:
        try:
            # Generate cache key
            params = {"tickers": sorted(tickers), "weights": weights, "start": start_date, "end": end_date}
            cache_key = generate_cache_key("portfolio", params)
            
            # Try fetching from cache
            cache_entry = db.session.get(CacheEntry, cache_key)
            if cache_entry:
                # Check if cache entry is still valid
                cache_age = datetime.now(timezone.utc) - cache_entry.created_at
                if cache_age < CACHE_DURATION:
                    logger.info(f"Cache hit for portfolio key: {cache_key}")
                    # Return cached data (structure needs to match expected return)
                    # Assuming cached data is a dict with keys: df_monthly_json, errors, correlation_json
                    cached_data = cache_entry.data
                    df_monthly = pd.read_json(cached_data['df_monthly_json'], orient='table')
                    # Ensure index is DatetimeIndex
                    df_monthly.index = pd.to_datetime(df_monthly.index)
                    return df_monthly, cached_data['errors'], cached_data['correlation_json']
                else:
                    logger.info(f"Cache expired for portfolio key: {cache_key}")
                    # Expired, proceed to fetch but we might delete old entry
                    db.session.delete(cache_entry)
                    db.session.commit() # Commit deletion
                    cache_entry = None # Ensure we don't try to use it
            else:
                 logger.info(f"Cache miss for portfolio key: {cache_key}")
        except Exception as e:
            current_app.logger.error(f"Cache read error: {e}", exc_info=True)
            # Proceed without cache if read fails
            use_cache = False 
            # Rollback any potential session changes from failed read/delete
            db.session.rollback()

    # --- Fetching Logic (if cache miss or invalid) ---
    logger.info(f"Fetching live data for portfolio: {tickers}")
    all_data = pd.DataFrame()
    error_tickers = []
    valid_tickers = []

    for ticker in tickers:
        try:
            # Clean ticker in case it has benchmark label
            clean_ticker = ticker.split(" (")[0].strip()
            if not clean_ticker:
                error_tickers.append(ticker)
                continue
                
            # Download data using yfinance
            stock_data = yf.download(clean_ticker, start=start_date, end=end_date, progress=False)
            if stock_data.empty:
                logger.warning(f"No data found for ticker: {clean_ticker}")
                error_tickers.append(ticker)
            else:
                all_data[clean_ticker] = stock_data['Adj Close']
                valid_tickers.append(clean_ticker)
        except Exception as e:
            logger.error(f"Error fetching data for ticker {ticker}: {e}")
            error_tickers.append(ticker)

    # Check if any data was fetched successfully
    if all_data.empty:
        return None, error_tickers, None

    # --- Processing Logic ---
    # Ensure weights match the successfully fetched tickers
    valid_weights = []
    original_ticker_map = {t.split(" (")[0].strip(): w for t, w in zip(tickers, weights)}
    for vt in valid_tickers:
        valid_weights.append(original_ticker_map.get(vt, 0)) # Default to 0 if something went wrong
    # Renormalize valid_weights if some tickers failed? Or rely on initial validation?
    # For now, assume initial validation passed and weights correspond to tickers list.
    # We should use the weights corresponding to the *valid_tickers* only.
    valid_weights_normalized = [w / sum(valid_weights) if sum(valid_weights) > 0 else 0 for w in valid_weights]
    
    # Resample to monthly data, using the last day's price
    df_monthly = all_data.resample('M').last()

    # Calculate monthly returns
    df_monthly_returns = df_monthly.pct_change().dropna()

    # Calculate weighted portfolio returns
    portfolio_monthly_returns = (df_monthly_returns * valid_weights_normalized).sum(axis=1)

    # Calculate cumulative portfolio value (starting at 1)
    portfolio_cumulative_returns = (1 + portfolio_monthly_returns).cumprod()
    
    # Add Portfolio Value and Monthly Return to the main monthly dataframe
    df_monthly['Portfolio Value'] = portfolio_cumulative_returns
    df_monthly['Monthly Return'] = portfolio_monthly_returns
    # Add initial row for correct value calculation start
    initial_row = pd.DataFrame({'Portfolio Value': 1.0}, index=[df_monthly.index.min() - pd.Timedelta(days=1)])
    df_monthly = pd.concat([initial_row, df_monthly])
    df_monthly['Portfolio Value'] = df_monthly['Portfolio Value'].fillna(1.0)
    # Forward fill other columns if needed, or handle NaNs appropriately
    df_monthly = df_monthly.ffill()
    df_monthly['Monthly Return'] = df_monthly['Portfolio Value'].pct_change().fillna(0)


    # Calculate Drawdown
    rolling_max = df_monthly['Portfolio Value'].cummax()
    df_monthly['Drawdown'] = (df_monthly['Portfolio Value'] / rolling_max) - 1

    # Calculate Correlation Matrix
    correlation_matrix = df_monthly_returns.corr()
    correlation_data = {
        "tickers": correlation_matrix.columns.tolist(),
        "matrix": correlation_matrix.values.tolist()
    } if not correlation_matrix.empty else None

    # Add year column for CSV download convenience (done in app.py now)
    # df_monthly['Year'] = df_monthly.index.year 

    # --- Cache Write Logic ---
    if use_cache and cache_key:
        try:
            # Prepare data for caching (convert DataFrame to JSON)
            # Using 'table' orientation is generally robust for round-tripping
            data_to_cache = {
                'df_monthly_json': df_monthly.to_json(orient='table', date_format='iso'),
                'errors': error_tickers,
                'correlation_json': correlation_data
            }
            
            new_entry = CacheEntry(id=cache_key, data=data_to_cache)
            db.session.merge(new_entry) # Use merge to insert or update if key exists
            db.session.commit()
            logger.info(f"Cache written for portfolio key: {cache_key}")
        except Exception as e:
            current_app.logger.error(f"Cache write error: {e}", exc_info=True)
            db.session.rollback() # Rollback on error

    return df_monthly, error_tickers, correlation_data


def fetch_benchmark_data(ticker, start_date, end_date):
    """Fetch benchmark data, using cache if available and valid."""
    
    use_cache = bool(current_app.config.get('SQLALCHEMY_DATABASE_URI'))
    cache_entry = None
    cache_key = None

    if use_cache:
        try:
            params = {"ticker": ticker, "start": start_date, "end": end_date}
            cache_key = generate_cache_key("benchmark", params)
            cache_entry = db.session.get(CacheEntry, cache_key)
            
            if cache_entry:
                cache_age = datetime.now(timezone.utc) - cache_entry.created_at
                if cache_age < CACHE_DURATION:
                    logger.info(f"Cache hit for benchmark key: {cache_key}")
                    # Assuming cached data is dict: {df_json: ..., error: ...}
                    cached_data = cache_entry.data
                    df_benchmark = pd.read_json(cached_data['df_json'], orient='table')
                    df_benchmark.index = pd.to_datetime(df_benchmark.index)
                    return df_benchmark, cached_data['error']
                else:
                    logger.info(f"Cache expired for benchmark key: {cache_key}")
                    db.session.delete(cache_entry)
                    db.session.commit()
                    cache_entry = None
            else:
                logger.info(f"Cache miss for benchmark key: {cache_key}")
        except Exception as e:
            current_app.logger.error(f"Benchmark cache read error: {e}", exc_info=True)
            use_cache = False
            db.session.rollback()

    # --- Fetching Logic ---
    logger.info(f"Fetching live data for benchmark: {ticker}")
    df_benchmark = None
    error = None
    try:
        stock_data = yf.download(ticker, start=start_date, end=end_date, progress=False)
        if stock_data.empty:
            error = f"No data found for benchmark ticker: {ticker}"
            logger.warning(error)
        else:
            # Resample to monthly
            df_benchmark = stock_data[['Adj Close']].resample('M').last()
            df_benchmark.rename(columns={'Adj Close': 'Portfolio Value'}, inplace=True)
            
            # Calculate monthly returns
            df_benchmark['Monthly Return'] = df_benchmark['Portfolio Value'].pct_change()
            
            # Add initial row for correct value calculation start
            initial_row = pd.DataFrame({'Portfolio Value': df_benchmark['Portfolio Value'].iloc[0] / (1 + df_benchmark['Monthly Return'].iloc[1]) if len(df_benchmark) > 1 and df_benchmark['Monthly Return'].iloc[1] is not None else df_benchmark['Portfolio Value'].iloc[0] }, index=[df_benchmark.index.min() - pd.Timedelta(days=1)])
            df_benchmark = pd.concat([initial_row, df_benchmark])
            df_benchmark['Portfolio Value'] = df_benchmark['Portfolio Value'].ffill()
            df_benchmark['Monthly Return'] = df_benchmark['Portfolio Value'].pct_change().fillna(0)

            # Calculate Drawdown
            rolling_max = df_benchmark['Portfolio Value'].cummax()
            df_benchmark['Drawdown'] = (df_benchmark['Portfolio Value'] / rolling_max) - 1

    except Exception as e:
        error = f"Error fetching benchmark data for {ticker}: {e}"
        logger.error(error, exc_info=True)

    # --- Cache Write Logic ---
    if use_cache and cache_key and error is None and df_benchmark is not None:
        try:
            data_to_cache = {
                'df_json': df_benchmark.to_json(orient='table', date_format='iso'),
                'error': error # Store None if successful
            }
            new_entry = CacheEntry(id=cache_key, data=data_to_cache)
            db.session.merge(new_entry)
            db.session.commit()
            logger.info(f"Cache written for benchmark key: {cache_key}")
        except Exception as e:
            current_app.logger.error(f"Benchmark cache write error: {e}", exc_info=True)
            db.session.rollback()

    return df_benchmark, error


def calculate_metrics(df_monthly):
    # ... (existing metric calculation logic) ...
    # Ensure it handles potential NaNs or edge cases if needed
    
    if df_monthly is None or df_monthly.empty or len(df_monthly) < 2:
        # Return default/NA values if not enough data
        return {
            'cagr': 'N/A', 'volatility': 'N/A', 'sharpe_ratio': 'N/A', 
            'max_drawdown': 'N/A', 'best_month': 'N/A', 'worst_month': 'N/A',
            'total_return': 'N/A', 'years': 0, 'sortino_ratio': 'N/A',
            'calmar_ratio': 'N/A', 'max_drawdown_duration': 'N/A',
            'rolling_volatility': 'N/A', 'rolling_return': 'N/A',
            'annual_returns': {}
        }
        
    # Ensure index is datetime
    df_monthly.index = pd.to_datetime(df_monthly.index)

    # Calculate number of years
    start_date = df_monthly.index.min()
    end_date = df_monthly.index.max()
    years = (end_date - start_date).days / 365.25

    # Ensure we have enough data points
    if years <= 0 or len(df_monthly) <= 1:
        years = 0 # Avoid division by zero

    # Total Return
    total_return = (df_monthly['Portfolio Value'].iloc[-1] / df_monthly['Portfolio Value'].iloc[0]) - 1

    # CAGR
    cagr = ((1 + total_return) ** (1 / years) - 1) if years > 0 else 0

    # Monthly Returns for calculations (excluding potential initial row)
    monthly_returns = df_monthly['Monthly Return'].iloc[1:]

    # Volatility (Annualized Standard Deviation of Monthly Returns)
    volatility = monthly_returns.std() * math.sqrt(12) if not monthly_returns.empty else 0

    # Sharpe Ratio (Assume Risk-Free Rate = 0)
    sharpe_ratio = (cagr / volatility) if volatility > 0 else 0

    # Max Drawdown
    max_drawdown = df_monthly['Drawdown'].min()

    # Best/Worst Month
    best_month = monthly_returns.max() if not monthly_returns.empty else 0
    worst_month = monthly_returns.min() if not monthly_returns.empty else 0
    
    # Sortino Ratio
    downside_returns = monthly_returns[monthly_returns < 0]
    downside_deviation = downside_returns.std() * math.sqrt(12) if not downside_returns.empty else 0
    sortino_ratio = (cagr / downside_deviation) if downside_deviation > 0 else 0
    
    # Calmar Ratio
    calmar_ratio = (cagr / abs(max_drawdown)) if max_drawdown < 0 else 0

    # Max Drawdown Duration
    # Find periods where drawdown is active (value is less than 0)
    drawdown_periods = df_monthly[df_monthly['Drawdown'] < 0]
    max_drawdown_duration = 0
    current_duration = 0
    in_drawdown = False
    for date, row in df_monthly.iterrows():
        if row['Drawdown'] < 0:
            if not in_drawdown:
                in_drawdown = True
                current_duration = 0
            # Increment duration (approx monthly)
            current_duration += 1 
        else:
            if in_drawdown:
                in_drawdown = False
                max_drawdown_duration = max(max_drawdown_duration, current_duration)
    # Check if still in drawdown at the end
    if in_drawdown:
         max_drawdown_duration = max(max_drawdown_duration, current_duration)
    # Convert approx months to more descriptive string (e.g., "X months")
    max_drawdown_duration_str = f"{max_drawdown_duration} months" if max_drawdown_duration > 0 else "0 months"


    # Rolling 12M Volatility (Annualized std dev of the last 12 monthly returns)
    rolling_volatility = monthly_returns.tail(12).std() * math.sqrt(12) if len(monthly_returns) >= 12 else 0

    # Rolling 12M Return (Compounded return over the last 12 months)
    rolling_return = ((1 + monthly_returns.tail(12)).prod() - 1) if len(monthly_returns) >= 12 else 0
    
    # Annual Returns
    annual_returns = {}
    df_monthly['Year'] = df_monthly.index.year
    for year, group in df_monthly.iloc[1:].groupby('Year'): # Exclude initial row
        if not group.empty:
            # Use portfolio value for more accurate annual compounding
            year_start_value = group['Portfolio Value'].iloc[0] / (1 + group['Monthly Return'].iloc[0]) if len(group) > 0 else 1
            year_end_value = group['Portfolio Value'].iloc[-1]
            annual_return = (year_end_value / year_start_value) - 1
            annual_returns[year] = f"{annual_return:.2%}"
            
    # Format results
    metrics = {
        'cagr': f"{cagr:.2%}",
        'volatility': f"{volatility:.2%}",
        'sharpe_ratio': f"{sharpe_ratio:.2f}",
        'max_drawdown': f"{max_drawdown:.2%}",
        'best_month': f"{best_month:.2%}",
        'worst_month': f"{worst_month:.2%}",
        'total_return': f"{total_return:.2%}",
        'years': f"{years:.1f}",
        'sortino_ratio': f"{sortino_ratio:.2f}",
        'calmar_ratio': f"{calmar_ratio:.2f}",
        'max_drawdown_duration': max_drawdown_duration_str,
        'rolling_volatility': f"{rolling_volatility:.2%}",
        'rolling_return': f"{rolling_return:.2%}",
        'annual_returns': annual_returns
    }

    return metrics
