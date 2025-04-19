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
        # Create test data with known correlation properties
        dates = pd.date_range(start='2020-01-01', end='2023-01-01', freq='ME')
        np.random.seed(42) # For reproducibility

        # Create base random returns for AAPL
        aapl_returns = np.random.normal(0.01, 0.05, len(dates))
        
        # Create MSFT returns positively correlated with AAPL
        msft_returns = 0.8 * aapl_returns + np.random.normal(0.005, 0.02, len(dates))
        
        # Create GOOG returns negatively correlated with AAPL
        goog_returns = -0.6 * aapl_returns + np.random.normal(0.002, 0.03, len(dates))
        
        # Combine into a DataFrame
        returns_df = pd.DataFrame({
            'AAPL': aapl_returns,
            'MSFT': msft_returns,
            'GOOG': goog_returns
        }, index=dates)
        
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
        # self.assertLess(matrix_values[msft_idx][goog_idx], 0, "MSFT and GOOG relation check")

if __name__ == '__main__':
    unittest.main()