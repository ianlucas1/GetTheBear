/**
 * Validation utility functions for portfolio analysis
 */

/**
 * Show error message
 * @param {string} message - The error message to display
 */
export function showError(message) {
    const errorElement = document.getElementById('error-message');
    if (!errorElement) return;
    
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    // Hide after 5 seconds
    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 5000);
}

/**
 * Validate portfolio form data
 * @param {Array} tickers - Array of ticker symbols
 * @param {Array} weights - Array of weight values
 * @param {string} startDate - Start date string
 * @param {string} endDate - End date string
 * @param {string} benchmarkTicker - Benchmark ticker symbol
 * @returns {boolean} Whether the form data is valid
 */
export function validatePortfolioForm(tickers, weights, startDate, endDate, benchmarkTicker) {
    // Validate tickers and weights
    if (tickers.length === 0) {
        showError('Please add at least one valid ticker symbol');
        return false;
    }
    
    // Validate weight total is exactly 100% (with a small tolerance)
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (Math.abs(totalWeight - 100) > 0.05) {
        showError(`Weights must sum to 100% - your total is ${totalWeight.toFixed(1)}%`);
        return false;
    }
    
    // Validate date range
    if (!startDate || !endDate) {
        showError('Please select a valid date range');
        return false;
    }
    
    if (new Date(startDate) >= new Date(endDate)) {
        showError('Start date must be before end date');
        return false;
    }
    
    // Validate benchmark ticker
    if (!benchmarkTicker) {
        showError('Please select a benchmark ticker');
        return false;
    }
    
    return true;
} 