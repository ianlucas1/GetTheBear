# analytics/calculation.py
import pandas as pd
import math

def calculate_metrics(df_monthly):
    """Calculate performance metrics from monthly portfolio/benchmark data."""
    
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
    # Ensure start and end date are valid for calculation
    if pd.isna(start_date) or pd.isna(end_date) or start_date == end_date:
         years = 0
    else:
        years = (end_date - start_date).days / 365.25

    # Ensure we have enough data points
    if years <= 0 or len(df_monthly) <= 1:
        years = 0 # Avoid division by zero or negative exponent

    # Total Return (handle potential division by zero if first value is 0)
    start_value = df_monthly['Portfolio Value'].iloc[0]
    end_value = df_monthly['Portfolio Value'].iloc[-1]
    total_return = (end_value / start_value) - 1 if start_value != 0 else 0

    # CAGR
    cagr = ((1 + total_return) ** (1 / years) - 1) if years > 0 else 0

    # Monthly Returns for calculations (excluding potential initial row at index 0)
    # Ensure 'Monthly Return' column exists
    if 'Monthly Return' not in df_monthly.columns:
        # Attempt to calculate if missing, otherwise return NA
        if 'Portfolio Value' in df_monthly.columns:
             df_monthly['Monthly Return'] = df_monthly['Portfolio Value'].pct_change().fillna(0)
        else: # Cannot calculate volatility etc.
             return {**{
                'cagr': f"{cagr:.2%}", # Keep calculated CAGR/Total Return
                'total_return': f"{total_return:.2%}",
                'years': f"{years:.1f}"
            }, **{ # But N/A for the rest
                 'volatility': 'N/A', 'sharpe_ratio': 'N/A', 'max_drawdown': 'N/A',
                 'best_month': 'N/A', 'worst_month': 'N/A', 'sortino_ratio': 'N/A',
                 'calmar_ratio': 'N/A', 'max_drawdown_duration': 'N/A',
                 'rolling_volatility': 'N/A', 'rolling_return': 'N/A', 'annual_returns': {}
             }}
             
    monthly_returns = df_monthly['Monthly Return'].iloc[1:]

    # Volatility (Annualized Standard Deviation of Monthly Returns)
    volatility = monthly_returns.std() * math.sqrt(12) if not monthly_returns.empty else 0

    # Sharpe Ratio (Assume Risk-Free Rate = 0)
    sharpe_ratio = (cagr / volatility) if volatility > 0 else 0

    # Max Drawdown (Ensure 'Drawdown' column exists)
    if 'Drawdown' not in df_monthly.columns:
        # Calculate if missing
        if 'Portfolio Value' in df_monthly.columns:
            rolling_max = df_monthly['Portfolio Value'].cummax()
            df_monthly['Drawdown'] = (df_monthly['Portfolio Value'] / rolling_max) - 1
            max_drawdown = df_monthly['Drawdown'].min()
        else:
            max_drawdown = 0 # Or N/A
    else:
         max_drawdown = df_monthly['Drawdown'].min() if not pd.isna(df_monthly['Drawdown'].min()) else 0

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
    max_drawdown_duration = 0
    current_duration = 0
    in_drawdown = False
    # Ensure 'Drawdown' column exists before iterating
    if 'Drawdown' in df_monthly.columns:
        # Iterate through rows safely, handling potential NaNs in Drawdown
        for date, row in df_monthly.iterrows():
            if not pd.isna(row['Drawdown']) and row['Drawdown'] < 0:
                if not in_drawdown:
                    in_drawdown = True
                    # Reset duration when a new drawdown period starts
                    current_duration = 1 # Start count at 1 for the first month
                else:
                    # Increment duration for consecutive months in drawdown
                    current_duration += 1
            else:
                # If not in drawdown or NaN, check if we just exited a drawdown period
                if in_drawdown:
                    in_drawdown = False
                    max_drawdown_duration = max(max_drawdown_duration, current_duration)
                    current_duration = 0 # Reset for next potential drawdown
        # Check if still in drawdown at the end
        if in_drawdown:
            max_drawdown_duration = max(max_drawdown_duration, current_duration)
            
    max_drawdown_duration_str = f"{max_drawdown_duration} months" if max_drawdown_duration > 0 else "0 months"

    # Rolling 12M Volatility (Annualized std dev of the last 12 monthly returns)
    rolling_volatility = monthly_returns.tail(12).std() * math.sqrt(12) if len(monthly_returns) >= 12 else 0

    # Rolling 12M Return (Compounded return over the last 12 months)
    rolling_return = ((1 + monthly_returns.tail(12)).prod() - 1) if len(monthly_returns) >= 12 else 0
    
    # Annual Returns
    annual_returns = {}
    df_monthly_calc = df_monthly.iloc[1:].copy() # Work on a copy, exclude potential initial row
    if not df_monthly_calc.empty and pd.api.types.is_datetime64_any_dtype(df_monthly_calc.index):
        df_monthly_calc['Year'] = df_monthly_calc.index.year
        # Group by Year
        grouped = df_monthly_calc.groupby('Year')
        for year, group in grouped:
            if not group.empty:
                # Use portfolio value for more accurate annual compounding
                # Find the value before the start of the year
                year_start_index = group.index.min()
                try:
                    # Get the row just before the first row of the year
                    prev_row = df_monthly.loc[:year_start_index].iloc[-2] 
                    year_start_value = prev_row['Portfolio Value']
                except IndexError:
                    # If it's the first year, the start value is 1.0 (from initial row)
                    year_start_value = 1.0 
                
                year_end_value = group['Portfolio Value'].iloc[-1]
                
                # Handle potential division by zero or NaN values
                if year_start_value is not None and year_start_value != 0 and not pd.isna(year_end_value):
                    annual_return = (year_end_value / year_start_value) - 1
                    annual_returns[year] = f"{annual_return:.2%}"
                else:
                    annual_returns[year] = "N/A" # Indicate calculation error
            
    # Format results, handle potential NaNs from calculations
    metrics = {
        'cagr': f"{cagr:.2%}" if not pd.isna(cagr) else 'N/A',
        'volatility': f"{volatility:.2%}" if not pd.isna(volatility) else 'N/A',
        'sharpe_ratio': f"{sharpe_ratio:.2f}" if not pd.isna(sharpe_ratio) else 'N/A',
        'max_drawdown': f"{max_drawdown:.2%}" if not pd.isna(max_drawdown) else 'N/A',
        'best_month': f"{best_month:.2%}" if not pd.isna(best_month) else 'N/A',
        'worst_month': f"{worst_month:.2%}" if not pd.isna(worst_month) else 'N/A',
        'total_return': f"{total_return:.2%}" if not pd.isna(total_return) else 'N/A',
        'years': f"{years:.1f}",
        'sortino_ratio': f"{sortino_ratio:.2f}" if not pd.isna(sortino_ratio) else 'N/A',
        'calmar_ratio': f"{calmar_ratio:.2f}" if not pd.isna(calmar_ratio) else 'N/A',
        'max_drawdown_duration': max_drawdown_duration_str,
        'rolling_volatility': f"{rolling_volatility:.2%}" if not pd.isna(rolling_volatility) else 'N/A',
        'rolling_return': f"{rolling_return:.2%}" if not pd.isna(rolling_return) else 'N/A',
        'annual_returns': annual_returns
    }

    return metrics 