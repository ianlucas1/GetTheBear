import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import unittest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

class TestCorrelationMatrix(unittest.TestCase):
    """Test suite for correlation matrix calculation."""
    
    def test_matrix_properties(self):
        """Test that the correlation matrix has expected properties."""
        # Create the data with known correlation properties
        np.random.seed(42)
        date_rng = pd.date_range(start='2023-01-01', end='2023-03-01', freq='BME') # Use Business Month End (Changed from BM)
        n_samples = len(date_rng)

        # Create base random returns for AAPL
        aapl_returns = np.random.normal(0.01, 0.05, n_samples)
        
        # Create MSFT returns positively correlated with AAPL
        msft_returns = 0.8 * aapl_returns + np.random.normal(0.005, 0.02, n_samples)
        
        # Create GOOG returns negatively correlated with AAPL
        goog_returns = -0.6 * aapl_returns + np.random.normal(0.002, 0.03, n_samples)
        
        # Combine into a DataFrame
        returns_df = pd.DataFrame({
            'AAPL': aapl_returns,
            'MSFT': msft_returns,
            'GOOG': goog_returns
        }, index=date_rng)
        
        # Calculate the correlation matrix from this generated data
        correlation_matrix = returns_df.corr()
        
        # Now we test the properties of the correlation matrix
        matrix_values = np.array(correlation_matrix.values)
        tickers = correlation_matrix.columns.tolist()
        
        # 1. Test the matrix is symmetric
        self.assertTrue(np.allclose(matrix_values, matrix_values.T), 
                        "Correlation matrix should be symmetric")
        
        # 2. Test the diagonal is all 1.0
        diagonal = np.diag(matrix_values)
        self.assertTrue(np.allclose(diagonal, np.ones_like(diagonal)),
                       "Diagonal of correlation matrix should be all 1.0")
        
        # 3. Test the correlations match our expectations based on generated data
        aapl_idx = tickers.index('AAPL')
        msft_idx = tickers.index('MSFT')
        goog_idx = tickers.index('GOOG')
        
        # AAPL and MSFT should be positively correlated (adjust threshold if needed)
        self.assertGreater(matrix_values[aapl_idx][msft_idx], 0.7, # Adjusted threshold based on generation
                          "AAPL and MSFT should be positively correlated")
        
        # AAPL and GOOG should be negatively correlated (adjust threshold if needed)
        self.assertLess(matrix_values[aapl_idx][goog_idx], -0.5, # Adjusted threshold based on generation
                       "AAPL and GOOG should be negatively correlated")
        
        # MSFT and GOOG might have less predictable correlation, 
        # could test if needed or omit specific value test.

if __name__ == '__main__':
    unittest.main()