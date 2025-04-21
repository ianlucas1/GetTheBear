# analytics/fetching.py
import logging
import pandas as pd
import yfinance as yf
import io
from datetime import datetime, timezone

# Import db stuff from models and Flask app context
from models import db, CacheEntry
from flask import current_app

# Import caching helpers
from .caching import generate_cache_key, CACHE_DURATION

logger = logging.getLogger(__name__)

# --- Fetch Portfolio Data (with Caching) ---
def fetch_portfolio_data(tickers, weights, start_date, end_date):
    """Fetch portfolio data, using cache if available and valid."""
    
    # Check if database is configured for caching
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
                    cached_data = cache_entry.data
                    # Wrap JSON string in StringIO for pd.read_json
                    df_monthly = pd.read_json(io.StringIO(cached_data['df_monthly_json']), orient='table')
                    # Ensure index is DatetimeIndex
                    df_monthly.index = pd.to_datetime(df_monthly.index)
                    return df_monthly, cached_data['errors'], cached_data['correlation_json']
                else:
                    logger.info(f"Cache expired for portfolio key: {cache_key}")
                    db.session.delete(cache_entry)
                    db.session.commit()
                    cache_entry = None
            else:
                 logger.info(f"Cache miss for portfolio key: {cache_key}")
        except Exception as e:
            current_app.logger.error(f"Cache read error: {e}", exc_info=True)
            use_cache = False 
            db.session.rollback()

    # --- Fetching Logic (if cache miss or invalid) ---
    logger.info(f"Fetching live data for portfolio: {tickers}")
    all_data = pd.DataFrame()
    error_tickers = []
    valid_tickers = []

    for ticker in tickers:
        try:
            clean_ticker = ticker.split(" (")[0].strip()
            if not clean_ticker:
                error_tickers.append(ticker)
                continue
                
            stock_data = yf.download(clean_ticker, start=start_date, end=end_date, progress=False)
            if stock_data.empty:
                logger.warning(f"No data found for ticker: {clean_ticker}")
                error_tickers.append(ticker)
            else:
                all_data[clean_ticker] = stock_data['Close']
                valid_tickers.append(clean_ticker)
        except Exception as e:
            logger.error(f"Error fetching data for ticker {ticker}: {e}")
            error_tickers.append(ticker)

    if all_data.empty:
        return None, error_tickers, None

    # --- Processing Logic ---
    valid_weights = []
    original_ticker_map = {t.split(" (")[0].strip(): w for t, w in zip(tickers, weights)}
    for vt in valid_tickers:
        valid_weights.append(original_ticker_map.get(vt, 0))

    # Renormalize valid_weights corresponding to the *valid_tickers* only.
    total_valid_weight = sum(valid_weights)
    valid_weights_normalized = [w / total_valid_weight if total_valid_weight > 0 else 0 for w in valid_weights]

    # Ensure all_data only contains columns for valid_tickers before resampling
    all_data = all_data[valid_tickers] 

    if all_data.empty: # Check again after filtering
        return None, error_tickers, None
        
    df_monthly = all_data.resample('ME').last()
    df_monthly_returns = df_monthly.pct_change().dropna()

    # Check if valid_weights_normalized matches columns after potential drops
    if len(valid_weights_normalized) != len(df_monthly_returns.columns):
        logger.error("Mismatch between weights and fetched data columns after resampling/dropping NaNs.")
        # Handle error appropriately - maybe return None or raise?
        # For now, let's filter weights to match columns if possible
        valid_weights_normalized = [w for w, t in zip(valid_weights_normalized, valid_tickers) if t in df_monthly_returns.columns]
        # Re-normalize again if weights were removed
        total_valid_weight = sum(valid_weights_normalized)
        valid_weights_normalized = [w / total_valid_weight if total_valid_weight > 0 else 0 for w in valid_weights_normalized]
        if len(valid_weights_normalized) != len(df_monthly_returns.columns):
             logger.error("Cannot reconcile weights and columns. Aborting portfolio calculation.")
             return None, error_tickers, None # Abort if still mismatched

    portfolio_monthly_returns = (df_monthly_returns * valid_weights_normalized).sum(axis=1)
    portfolio_cumulative_returns = (1 + portfolio_monthly_returns).cumprod()
    
    # Add Portfolio Value and Monthly Return back to the main monthly dataframe
    # Make sure index aligns for assignment
    df_monthly['Portfolio Value'] = portfolio_cumulative_returns.reindex(df_monthly.index)
    df_monthly['Monthly Return'] = portfolio_monthly_returns.reindex(df_monthly.index)

    # Add initial row
    first_valid_index = df_monthly.first_valid_index()
    if first_valid_index is not None:
        initial_row_index = first_valid_index - pd.Timedelta(days=1)
        initial_row = pd.DataFrame({'Portfolio Value': 1.0, 'Monthly Return': 0.0}, index=[initial_row_index])
        df_monthly = pd.concat([initial_row, df_monthly]).sort_index()
    
    # Fill NaNs strategically
    df_monthly['Portfolio Value'] = df_monthly['Portfolio Value'].ffill().fillna(1.0) # Ffill then fill remaining NAs (like start) with 1.0
    df_monthly['Monthly Return'] = df_monthly['Portfolio Value'].pct_change().fillna(0)

    # Calculate Drawdown
    rolling_max = df_monthly['Portfolio Value'].cummax()
    df_monthly['Drawdown'] = (df_monthly['Portfolio Value'] / rolling_max) - 1

    # Calculate Correlation Matrix (only for valid tickers with returns)
    correlation_matrix = df_monthly_returns.corr()
    correlation_data = {
        "tickers": correlation_matrix.columns.tolist(),
        "matrix": correlation_matrix.round(4).values.tolist() # Round for cleaner JSON
    } if not correlation_matrix.empty else None

    # --- Cache Write Logic ---
    if use_cache and cache_key:
        try:
            data_to_cache = {
                'df_monthly_json': df_monthly.to_json(orient='table', date_format='iso'),
                'errors': error_tickers,
                'correlation_json': correlation_data
            }
            
            new_entry = CacheEntry(id=cache_key, data=data_to_cache)
            db.session.merge(new_entry)
            db.session.commit()
            logger.info(f"Cache written for portfolio key: {cache_key}")
        except Exception as e:
            current_app.logger.error(f"Cache write error: {e}", exc_info=True)
            db.session.rollback()

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
                    cached_data = cache_entry.data
                    df_benchmark = pd.read_json(io.StringIO(cached_data['df_json']), orient='table')
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
        ticker_obj = yf.Ticker(ticker)
        stock_data = ticker_obj.history(start=start_date, end=end_date)
        
        if stock_data.empty:
            logger.warning(f"Empty data from Ticker.history for {ticker}, trying download fallback")
            stock_data = yf.download(ticker, start=start_date, end=end_date, progress=False)
        
        if stock_data.empty:
            error = f"No data found for benchmark ticker: {ticker}"
            logger.warning(error)
        else:
            logger.info(f"Benchmark data date range: {stock_data.index.min()} to {stock_data.index.max()}")
            df_benchmark = stock_data[['Close']].resample('ME').last()
            df_benchmark.rename(columns={'Close': 'Portfolio Value'}, inplace=True)
            
            # Handle cases where resampling might yield no data (e.g., single day fetch)
            if df_benchmark.empty:
                 error = f"No monthly data after resampling for benchmark: {ticker}"
                 logger.warning(error)
                 df_benchmark = None # Ensure it's None if empty
            else:
                first_valid_index = df_benchmark['Portfolio Value'].first_valid_index()
                if first_valid_index is not None:
                    first_value = df_benchmark.loc[first_valid_index, 'Portfolio Value']
                    df_benchmark['Portfolio Value'] = df_benchmark['Portfolio Value'] / first_value
                else: # Handle case where all values might be NaN after resample
                    df_benchmark['Portfolio Value'] = 1.0

                df_benchmark['Monthly Return'] = df_benchmark['Portfolio Value'].pct_change() # Keep NaNs here initially
                
                # Add initial row if there's data
                first_valid_index = df_benchmark.first_valid_index()
                if first_valid_index is not None:
                    initial_row_index = first_valid_index - pd.Timedelta(days=1)
                    initial_row = pd.DataFrame({'Portfolio Value': 1.0, 'Monthly Return': 0.0}, index=[initial_row_index])
                    df_benchmark = pd.concat([initial_row, df_benchmark]).sort_index()
                
                # Fill NaNs after initial row is added and pct_change is calculated
                df_benchmark['Portfolio Value'] = df_benchmark['Portfolio Value'].ffill().fillna(1.0)
                df_benchmark['Monthly Return'] = df_benchmark['Monthly Return'].fillna(0)
                
                # Calculate Drawdown
                rolling_max = df_benchmark['Portfolio Value'].cummax()
                df_benchmark['Drawdown'] = (df_benchmark['Portfolio Value'] / rolling_max) - 1

    except Exception as e:
        logger.error(f"Error fetching benchmark data for {ticker}: {e}", exc_info=True)
        error = f"An error occurred while fetching benchmark data for {ticker}."

    # --- Cache Write Logic ---
    # Only cache if fetch was successful (no error and df exists)
    if use_cache and cache_key and error is None and df_benchmark is not None and not df_benchmark.empty:
        try:
            data_to_cache = {
                'df_json': df_benchmark.to_json(orient='table', date_format='iso'),
                'error': None # Store None error explicitly
            }
            new_entry = CacheEntry(id=cache_key, data=data_to_cache)
            db.session.merge(new_entry)
            db.session.commit()
            logger.info(f"Cache written for benchmark key: {cache_key}")
        except Exception as e:
            current_app.logger.error(f"Benchmark cache write error: {e}", exc_info=True)
            db.session.rollback()
    # If there was an error during fetch, don't cache it
    elif error:
         logger.warning(f"Skipping cache write for benchmark {ticker} due to fetch error: {error}")

    return df_benchmark, error 