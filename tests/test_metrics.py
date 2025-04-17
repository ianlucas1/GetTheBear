import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import unittest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from analytics import calculate_metrics

class TestMetricsCalculation(unittest.TestCase):
    """Test suite for metrics calculation functions."""
    
    def setUp(self):
        """Set up test case with sample portfolio data."""
        # Create a sample DataFrame with portfolio data
        start_date = datetime(2020, 1, 1)
        end_date = datetime(2022, 12, 31)
        
        # Generate date range for monthly data over a 3-year period
        dates = []
        current_date = start_date
        while current_date <= end_date:
            dates.append(current_date)
            # Add one month to the current date
            month = current_date.month
            year = current_date.year
            if month == 12:
                month = 1
                year += 1
            else:
                month += 1
            current_date = datetime(year, month, 1)
        
        # Sample returns and values - simulate a realistic scenario
        # Portfolio that grows with some volatility
        np.random.seed(42)  # For reproducibility
        
        # Generate sample monthly returns with some realistic properties
        monthly_returns = []
        for i in range(len(dates)):
            # Create volatility with some autocorrelation
            if i == 0:
                monthly_return = np.random.normal(0.008, 0.03)  # Starting point
            else:
                # Some autocorrelation with previous month
                prev = monthly_returns[-1]
                monthly_return = 0.3 * prev + np.random.normal(0.008, 0.03)
                
                # Simulate market cycles - occasional drawdowns
                if i % 12 == 0:  # Annual cycle
                    monthly_return = monthly_return - 0.05
                
            monthly_returns.append(monthly_return)
        
        # Create portfolio values based on returns
        portfolio_values = [1.0]  # Start with $1
        for ret in monthly_returns[:-1]:  # Don't include the last month yet
            portfolio_values.append(portfolio_values[-1] * (1 + ret))
        
        # Create drawdowns based on portfolio values
        peak_values = []
        drawdowns = []
        
        current_peak = portfolio_values[0]
        for value in portfolio_values:
            if value > current_peak:
                current_peak = value
            peak_values.append(current_peak)
            drawdowns.append((value / current_peak) - 1)
        
        # Add year column for annual returns
        years = [date.year for date in dates]
        
        # Create the DataFrame
        self.df_portfolio = pd.DataFrame({
            'Portfolio Value': portfolio_values,
            'Monthly Return': monthly_returns,
            'Peak Value': peak_values,
            'Drawdown': drawdowns,
            'Year': years
        }, index=dates)
        
    def test_basic_metrics(self):
        """Test that basic metrics are calculated correctly."""
        metrics = calculate_metrics(self.df_portfolio)
        
        # Check that basic metrics exist and have reasonable values
        self.assertIn('cagr', metrics)
        self.assertIn('volatility', metrics)
        self.assertIn('sharpe_ratio', metrics)
        self.assertIn('max_drawdown', metrics)
        
        # Verify CAGR is not NaN and in a reasonable range
        cagr_value = float(metrics['cagr'].strip('%')) / 100
        self.assertFalse(np.isnan(cagr_value))
        self.assertTrue(-0.5 <= cagr_value <= 0.5)  # Reasonable CAGR range
        
    def test_new_metrics(self):
        """Test that the new metrics are calculated correctly."""
        metrics = calculate_metrics(self.df_portfolio)
        
        # Check that new metrics exist in the result
        self.assertIn('sortino_ratio', metrics)
        self.assertIn('calmar_ratio', metrics)
        self.assertIn('max_drawdown_duration', metrics)
        self.assertIn('rolling_volatility', metrics)
        self.assertIn('rolling_return', metrics)
        
        # Verify Sortino ratio is not NaN
        if metrics['sortino_ratio'] != 'N/A':
            sortino_value = float(metrics['sortino_ratio'])
            self.assertFalse(np.isnan(sortino_value))
            # Sortino should be a reasonable value
            self.assertTrue(-10.0 <= sortino_value <= 10.0)
        
        # Verify Calmar ratio is not NaN
        if metrics['calmar_ratio'] != 'N/A':
            calmar_value = float(metrics['calmar_ratio'])
            self.assertFalse(np.isnan(calmar_value))
            # Calmar should be a reasonable value
            self.assertTrue(-10.0 <= calmar_value <= 10.0)
        
        # Verify max drawdown duration contains "months" and is not NaN
        if metrics['max_drawdown_duration'] != 'N/A':
            self.assertIn('months', metrics['max_drawdown_duration'])
            
            # Extract the numeric part
            duration_value = float(metrics['max_drawdown_duration'].split()[0])
            self.assertFalse(np.isnan(duration_value))
            # Duration should be non-negative and in a reasonable range
            self.assertTrue(0 <= duration_value <= 36)  # Max 3 years in our test data
        
        # Check if rolling metrics are available (depends on having enough data)
        # Since our test data has 3 years, we should have these values
        if metrics['rolling_volatility'] != 'N/A':
            rolling_vol = float(metrics['rolling_volatility'].strip('%')) / 100
            self.assertFalse(np.isnan(rolling_vol))
            self.assertTrue(0.0 <= rolling_vol <= 0.5)  # Reasonable volatility range
            
        if metrics['rolling_return'] != 'N/A':
            rolling_ret = float(metrics['rolling_return'].strip('%')) / 100
            self.assertFalse(np.isnan(rolling_ret))
            self.assertTrue(-0.5 <= rolling_ret <= 0.5)  # Reasonable return range

if __name__ == '__main__':
    unittest.main()