import logging
import numpy as np
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
import math

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

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
        # Create dictionary of weights
        weight_dict = dict(zip(tickers, weights))
        
        # Download data
        data = yf.download(tickers, start=start_date, end=end_date, interval='1mo', 
                           group_by='ticker', auto_adjust=True)
        
        # Check for tickers with no data
        error_tickers = []
        for ticker in tickers:
            if ticker not in data.columns.levels[0] if isinstance(data.columns, pd.MultiIndex) else ticker not in data.columns:
                error_tickers.append(ticker)
        
        if error_tickers:
            logger.warning(f"Could not fetch data for: {error_tickers}")
            # Remove problematic tickers
            for ticker in error_tickers:
                tickers.remove(ticker)
                weights.remove(weight_dict[ticker])
            
            # Recalculate weights if we still have valid tickers
            if tickers:
                total_weight = sum(weights)
                weights = [w/total_weight for w in weights]
                weight_dict = dict(zip(tickers, weights))
            else:
                return None, error_tickers
        
        # Process data based on number of tickers
        if len(tickers) == 1:
            # Single ticker case (no MultiIndex)
            df = pd.DataFrame(data['Close'])
            df.columns = [tickers[0]]
        else:
            # Multiple tickers case
            df = pd.DataFrame()
            for ticker in tickers:
                df[ticker] = data[ticker]['Close']
        
        # Forward fill missing values (for holidays/weekends)
        df = df.ffill()
        
        # Calculate portfolio values
        df_monthly = df.copy()
        
        # Calculate monthly returns for each asset
        monthly_returns = df_monthly.pct_change().dropna()
        
        # Calculate portfolio monthly returns using weights
        portfolio_monthly_returns = pd.Series(0, index=monthly_returns.index)
        for ticker, weight in weight_dict.items():
            portfolio_monthly_returns += monthly_returns[ticker] * weight
        
        # Calculate cumulative portfolio value (starting with $1)
        df_portfolio = pd.DataFrame(index=df_monthly.index)
        df_portfolio['Monthly Return'] = portfolio_monthly_returns.reindex(df_monthly.index).fillna(0)
        df_portfolio['Portfolio Value'] = (1 + df_portfolio['Monthly Return']).cumprod()
        
        # Calculate drawdown
        df_portfolio['Peak Value'] = df_portfolio['Portfolio Value'].cummax()
        df_portfolio['Drawdown'] = (df_portfolio['Portfolio Value'] / df_portfolio['Peak Value']) - 1
        
        return df_portfolio, error_tickers
        
    except Exception as e:
        logger.exception(f"Error fetching portfolio data: {str(e)}")
        return None, tickers

def calculate_metrics(df_portfolio):
    """
    Calculate key portfolio performance metrics.
    
    Args:
        df_portfolio (DataFrame): Portfolio data with monthly returns and values
        
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
        
        # Format metrics for display
        metrics = {
            'cagr': format_percentage(cagr),
            'volatility': format_percentage(annualized_vol),
            'sharpe_ratio': format_number(sharpe_ratio),
            'max_drawdown': format_percentage(max_drawdown),
            'best_month': format_percentage(best_month),
            'worst_month': format_percentage(worst_month),
            'total_return': format_percentage(total_return),
            'years': format_number(years, 1)
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
            'years': 'N/A'
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
