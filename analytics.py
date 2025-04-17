import logging
import numpy as np
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
import math
import os
import psycopg2
import json
from psycopg2.extras import Json

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Get DB connection details from environment variables
DB_URL = os.environ.get('DATABASE_URL')

def setup_cache_table():
    """
    Create a table to cache stock price data
    """
    conn = psycopg2.connect(DB_URL)
    try:
        cursor = conn.cursor()
        
        # Create table for stock price cache
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS stock_price_cache (
                ticker TEXT NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                interval TEXT NOT NULL,
                data JSONB NOT NULL,
                retrieved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (ticker, start_date, end_date, interval)
            )
        """)
        
        conn.commit()
    finally:
        conn.close()
        
def get_cached_stock_data(ticker, start_date, end_date, interval='1mo'):
    """
    Try to get stock data from cache
    
    Returns:
        DataFrame or None: The cached data if available, otherwise None
    """
    conn = psycopg2.connect(DB_URL)
    try:
        cursor = conn.cursor()
        
        # Look for cached data
        cursor.execute("""
            SELECT data FROM stock_price_cache
            WHERE ticker = %s
            AND start_date = %s
            AND end_date = %s
            AND interval = %s
        """, (ticker, start_date, end_date, interval))
        
        result = cursor.fetchone()
        
        if result:
            logger.info(f"Cache hit for {ticker} from {start_date} to {end_date}")
            # Convert JSON to DataFrame
            json_data = result[0]
            
            try:
                # For records oriented JSON (new format)
                df_records = pd.DataFrame(json.loads(json_data))
                
                # Set the Date/index column as the index
                if 'Date' in df_records.columns:
                    df_records.set_index('Date', inplace=True)
                elif 'index' in df_records.columns:
                    df_records.set_index('index', inplace=True)
                elif 'date' in df_records.columns:
                    df_records.set_index('date', inplace=True)
                
                # Ensure index is datetime type
                df_records.index = pd.to_datetime(df_records.index)
                
                return df_records
            except Exception as e:
                logger.warning(f"Error parsing cached data with records format: {str(e)}")
                try:
                    # Try table oriented JSON (old format) as fallback
                    df = pd.read_json(json_data, orient='table')
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

def cache_stock_data(ticker, df, start_date, end_date, interval='1mo'):
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
            if (ticker, 'Close') in df.columns:
                close_data = df[(ticker, 'Close')].copy()
                # Create a new DataFrame with just the date index and Close price
                simple_df = pd.DataFrame({'Close': close_data}, index=df.index)
                df_to_cache = simple_df
            else:
                # Try to get the first Close column
                close_cols = [col for col in df.columns if col[1] == 'Close']
                if close_cols:
                    close_data = df[close_cols[0]].copy()
                    simple_df = pd.DataFrame({'Close': close_data}, index=df.index)
                    df_to_cache = simple_df
                else:
                    logger.warning(f"No Close column found for {ticker}, cannot cache")
                    return
        else:
            # Single-level columns - use as is
            df_to_cache = df.copy()
        
        # Convert DataFrame to JSON (with records orient to avoid MultiIndex issues)
        df_to_cache_reset = df_to_cache.reset_index()
        json_data = df_to_cache_reset.to_json(date_format='iso', orient='records')
        
        # Insert or update cache
        cursor.execute("""
            INSERT INTO stock_price_cache (ticker, start_date, end_date, interval, data)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (ticker, start_date, end_date, interval) 
            DO UPDATE SET data = %s, retrieved_at = CURRENT_TIMESTAMP
        """, (ticker, start_date, end_date, interval, json_data, json_data))
        
        conn.commit()
        logger.info(f"Cached data for {ticker} from {start_date} to {end_date}")
    except Exception as e:
        logger.error(f"Error caching data: {str(e)}")
        conn.rollback()
    finally:
        conn.close()

def fetch_portfolio_data(tickers, weights, start_date, end_date):
    """
    Fetch and process portfolio data.
    
    Args:
        tickers (list): List of stock ticker symbols
        weights (list): List of portfolio weights corresponding to tickers
        start_date (str): Start date in YYYY-MM-DD format
        end_date (str): End date in YYYY-MM-DD format
        
    Returns:
        tuple: (DataFrame with monthly portfolio data, list of tickers with errors)
    """
    try:
        # Clean up tickers (remove any "(Benchmark)" suffix)
        clean_tickers = [ticker.split(" (")[0] for ticker in tickers]
        
        # Create dictionary of weights with clean ticker names
        weight_dict = dict(zip(clean_tickers, weights))
        
        # Initialize DataFrame for all price data
        df = pd.DataFrame()
        error_tickers = []
        
        # Fetch data for each ticker (potentially from cache)
        for ticker in clean_tickers:
            # Try to get from cache first
            cached_data = get_cached_stock_data(ticker, start_date, end_date)
            
            if cached_data is not None:
                # We have cached data
                if 'Close' in cached_data.columns:
                    df[ticker] = cached_data['Close']
            else:
                # No cached data, fetch from Yahoo Finance
                try:
                    # Download single ticker data
                    data = yf.download(ticker, start=start_date, end=end_date, interval='1mo', auto_adjust=False)
                    
                    if data.empty:
                        error_tickers.append(ticker)
                        continue
                    
                    # Prefer Adj Close, but fall back to Close if not available
                    if 'Adj Close' in data.columns:
                        df[ticker] = data['Adj Close']
                        # Create a copy with 'Close' column name for caching
                        data_to_cache = data.copy()
                        data_to_cache['Close'] = data['Adj Close']
                    else:
                        df[ticker] = data['Close']
                        data_to_cache = data
                    
                    # Cache this data for future use
                    cache_stock_data(ticker, data, start_date, end_date)
                    
                except Exception as ticker_error:
                    logger.error(f"Error fetching data for {ticker}: {str(ticker_error)}")
                    error_tickers.append(ticker)
        
        # Handle any error tickers
        if error_tickers:
            logger.warning(f"Could not fetch data for: {error_tickers}")
            # Remove problematic tickers
            for ticker in error_tickers:
                if ticker in clean_tickers:
                    clean_tickers.remove(ticker)
                    
                    # Find the corresponding weight in original list
                    idx = clean_tickers.index(ticker) if ticker in clean_tickers else -1
                    if idx >= 0 and idx < len(weights):
                        weights.pop(idx)
            
            # Recalculate weights if we still have valid tickers
            if clean_tickers:
                total_weight = sum(weights)
                if total_weight > 0:
                    weights = [w/total_weight for w in weights]
                    weight_dict = dict(zip(clean_tickers, weights))
                else:
                    return None, error_tickers
            else:
                return None, error_tickers
        
        # Forward fill missing values (for holidays/weekends)
        df = df.ffill()
        
        if df.empty:
            return None, error_tickers
        
        # Calculate monthly returns for each asset
        # Explicitly specify fill_method=None to address FutureWarning
        monthly_returns = df.pct_change(fill_method=None).dropna()
        
        # Store individual ticker returns in a separate DataFrame
        df_ticker_returns = pd.DataFrame(index=monthly_returns.index)
        for ticker in clean_tickers:
            if ticker in monthly_returns.columns:
                df_ticker_returns[ticker] = monthly_returns[ticker]
        
        # Compute correlation matrix between ticker returns
        correlation_matrix = df_ticker_returns.corr().round(2)
        
        # Calculate portfolio monthly returns using weights
        portfolio_monthly_returns = pd.Series(0, index=monthly_returns.index)
        for ticker, weight in weight_dict.items():
            if ticker in monthly_returns.columns:
                portfolio_monthly_returns += monthly_returns[ticker] * weight
        
        # Calculate cumulative portfolio value (starting with $1)
        df_portfolio = pd.DataFrame(index=df.index)
        df_portfolio['Monthly Return'] = portfolio_monthly_returns.reindex(df.index).fillna(0)
        df_portfolio['Portfolio Value'] = (1 + df_portfolio['Monthly Return']).cumprod()
        
        # Calculate drawdown
        df_portfolio['Peak Value'] = df_portfolio['Portfolio Value'].cummax()
        df_portfolio['Drawdown'] = (df_portfolio['Portfolio Value'] / df_portfolio['Peak Value']) - 1
        
        # Keep annual return data for charts
        df_portfolio['Year'] = df_portfolio.index.year
        
        # Convert correlation matrix to nested dictionary format for JSON
        correlation_data = {
            'tickers': list(correlation_matrix.index),
            'matrix': correlation_matrix.values.tolist()
        }
        
        return df_portfolio, error_tickers, correlation_data
        
    except Exception as e:
        logger.exception(f"Error fetching portfolio data: {str(e)}")
        return None, tickers, None

def calculate_metrics(df_portfolio, is_benchmark=False):
    """
    Calculate key portfolio performance metrics.
    
    Args:
        df_portfolio (DataFrame): Portfolio data with monthly returns and values
        is_benchmark (bool): Whether metrics are for a benchmark in portfolio
        
    Returns:
        dict: Dictionary containing calculated metrics
    """
    try:
        # Get total number of years
        start_date = df_portfolio.index[0]
        end_date = df_portfolio.index[-1]
        years = (end_date - start_date).days / 365.25
        
        # Starting and ending values
        initial_value = df_portfolio['Portfolio Value'].iloc[0]
        final_value = df_portfolio['Portfolio Value'].iloc[-1]
        
        # CAGR (Compound Annual Growth Rate)
        cagr = (final_value / initial_value) ** (1 / years) - 1
        
        # Monthly returns
        monthly_returns = df_portfolio['Monthly Return'].dropna()
        
        # Annualized volatility
        annualized_vol = monthly_returns.std() * np.sqrt(12)
        
        # Sharpe ratio (assuming risk-free rate of 0 for simplicity)
        avg_monthly_return = monthly_returns.mean()
        monthly_return_std = monthly_returns.std()
        sharpe_ratio = 0
        if monthly_return_std > 0:
            sharpe_ratio = (avg_monthly_return / monthly_return_std) * np.sqrt(12)
        
        # Maximum drawdown
        max_drawdown = df_portfolio['Drawdown'].min()
        
        # Best and worst month
        best_month = monthly_returns.max()
        worst_month = monthly_returns.min()
        
        # Total return
        total_return = (final_value / initial_value) - 1
        
        # Calculate annual returns for the chart
        # Group by year and calculate annual returns
        annual_returns = {}
        if 'Year' in df_portfolio.columns:
            # Group by year and get first/last portfolio value for each year
            annual_data = df_portfolio.groupby('Year')['Portfolio Value'].agg(['first', 'last'])
            
            # Calculate annual returns
            for year, row in annual_data.iterrows():
                annual_return = (row['last'] / row['first']) - 1
                annual_returns[int(year)] = annual_return
        
        # --- NEW METRICS ---
        
        # Downside (Sortino) ratio
        # Calculate negative returns (below 0%)
        negative_returns = monthly_returns[monthly_returns < 0]
        
        # Calculate downside deviation (standard deviation of negative returns)
        downside_deviation = 0
        sortino_ratio = 0
        if len(negative_returns) > 0:
            downside_deviation = negative_returns.std() * np.sqrt(12)
            
            # Calculate Sortino ratio (using 0% as minimum acceptable return)
            if downside_deviation > 0:
                sortino_ratio = avg_monthly_return * np.sqrt(12) / downside_deviation
        
        # Calmar ratio (CAGR ÷ absolute max drawdown)
        calmar_ratio = 0
        if max_drawdown < 0:  # Ensure we don't divide by zero
            calmar_ratio = cagr / abs(max_drawdown)
        
        # Max drawdown duration calculation
        max_drawdown_duration = 0
        if 'Drawdown' in df_portfolio.columns:
            # Calculate drawdown durations
            in_drawdown = False
            current_drawdown_start = None
            current_duration = 0
            max_duration = 0
            
            # Iterate through portfolio values
            for date, row in df_portfolio.iterrows():
                drawdown = row['Drawdown']
                
                # Start of a drawdown
                if not in_drawdown and drawdown < 0:
                    in_drawdown = True
                    current_drawdown_start = date
                # End of a drawdown
                elif in_drawdown and drawdown >= 0:
                    in_drawdown = False
                    current_duration = (date - current_drawdown_start).days / 30  # Duration in months
                    max_duration = max(max_duration, current_duration)
                    current_drawdown_start = None
            
            # Check if we're still in a drawdown at the end
            if in_drawdown:
                current_duration = (end_date - current_drawdown_start).days / 30  # Duration in months
                max_duration = max(max_duration, current_duration)
            
            max_drawdown_duration = max_duration
        
        # Rolling 12-month volatility
        rolling_volatility = None
        if len(monthly_returns) >= 12:
            # Calculate rolling 12-month standard deviation
            rolling_std = monthly_returns.rolling(window=12).std() * np.sqrt(12)
            # Get the most recent value
            rolling_volatility = rolling_std.iloc[-1] if not rolling_std.empty else None
        
        # Rolling 12-month returns
        rolling_return = None
        if len(df_portfolio) >= 12:
            # Calculate rolling 12-month return
            rolling_values = df_portfolio['Portfolio Value'].rolling(window=12).apply(
                lambda window: (window.iloc[-1] / window.iloc[0]) - 1 if len(window) == 12 else None
            )
            # Get the most recent value
            rolling_return = rolling_values.iloc[-1] if not rolling_values.empty else None
        
        # Format metrics for display
        metrics = {
            'cagr': format_percentage(cagr),
            'volatility': format_percentage(annualized_vol),
            'sharpe_ratio': format_number(sharpe_ratio),
            'max_drawdown': format_percentage(max_drawdown),
            'best_month': format_percentage(best_month),
            'worst_month': format_percentage(worst_month),
            'total_return': format_percentage(total_return),
            'years': format_number(years, 1),
            'annual_returns': annual_returns,  # Annual returns for chart
            
            # New metrics
            'sortino_ratio': format_number(sortino_ratio),
            'calmar_ratio': format_number(calmar_ratio),
            'max_drawdown_duration': f"{format_number(max_drawdown_duration, 1)} months",
            'rolling_volatility': format_percentage(rolling_volatility) if rolling_volatility is not None else 'N/A',
            'rolling_return': format_percentage(rolling_return) if rolling_return is not None else 'N/A'
        }
        
        return metrics
        
    except Exception as e:
        logger.exception(f"Error calculating metrics: {str(e)}")
        return {
            'cagr': 'N/A',
            'volatility': 'N/A',
            'sharpe_ratio': 'N/A',
            'max_drawdown': 'N/A',
            'best_month': 'N/A',
            'worst_month': 'N/A',
            'total_return': 'N/A',
            'years': 'N/A',
            'annual_returns': {},
            
            # New metrics with N/A values
            'sortino_ratio': 'N/A',
            'calmar_ratio': 'N/A',
            'max_drawdown_duration': 'N/A',
            'rolling_volatility': 'N/A',
            'rolling_return': 'N/A'
        }

def format_percentage(value):
    """Format a number as a percentage string."""
    if value is None or math.isnan(value):
        return 'N/A'
    return f"{value * 100:.2f}%"

def format_number(value, decimals=2):
    """Format a number with specified decimal places."""
    if value is None or math.isnan(value):
        return 'N/A'
    return f"{value:.{decimals}f}"


def fetch_benchmark_data(ticker, start_date, end_date):
    """
    Fetch benchmark data for comparison.
    
    Args:
        ticker (str): Benchmark ticker symbol (e.g., 'SPY')
        start_date (str): Start date in YYYY-MM-DD format
        end_date (str): End date in YYYY-MM-DD format
        
    Returns:
        tuple: (DataFrame with monthly benchmark data, error message or None)
    """
    try:
        # Clean up ticker (remove any "(Benchmark)" suffix)
        clean_ticker = ticker.split(" (")[0]
        
        # Try to get from cache first
        cached_data = get_cached_stock_data(clean_ticker, start_date, end_date)
        
        if cached_data is not None:
            # We have cached data
            if 'Close' in cached_data.columns:
                df = pd.DataFrame(cached_data['Close'])
                df.columns = [clean_ticker]
            else:
                return None, f"Invalid cached data format for {clean_ticker}"
        else:
            # No cached data, fetch from Yahoo Finance
            try:
                # Download benchmark data
                data = yf.download(clean_ticker, start=start_date, end=end_date, interval='1mo', auto_adjust=True)
                
                if data.empty:
                    return None, f"No data available for benchmark {clean_ticker}"
                
                # Process data
                df = pd.DataFrame(data['Close'])
                df.columns = [clean_ticker]
                
                # Cache this data for future use
                cache_stock_data(clean_ticker, data, start_date, end_date)
                
            except Exception as ticker_error:
                logger.error(f"Error fetching data for benchmark {clean_ticker}: {str(ticker_error)}")
                return None, str(ticker_error)
        
        # Forward fill missing values
        df = df.ffill()
        
        # Calculate monthly returns with explicit fill_method=None
        monthly_returns = df.pct_change(fill_method=None).dropna()
        
        # Calculate cumulative value (starting with $1)
        df_benchmark = pd.DataFrame(index=df.index)
        df_benchmark['Monthly Return'] = monthly_returns[clean_ticker].reindex(df.index).fillna(0)
        df_benchmark['Portfolio Value'] = (1 + df_benchmark['Monthly Return']).cumprod()
        
        # Calculate drawdown
        df_benchmark['Peak Value'] = df_benchmark['Portfolio Value'].cummax()
        df_benchmark['Drawdown'] = (df_benchmark['Portfolio Value'] / df_benchmark['Peak Value']) - 1
        
        # Keep annual return data for charts
        df_benchmark['Year'] = df_benchmark.index.year
        
        return df_benchmark, None
        
    except Exception as e:
        logger.exception(f"Error fetching benchmark data: {str(e)}")
        return None, str(e)
