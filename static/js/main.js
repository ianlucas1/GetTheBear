/**
 * Get the Bear - Portfolio Analysis Tool
 * Main JavaScript File
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize application
    initializeDatePicker();
    setupTickerControls();
    setupAnalysisForm();
});

/**
 * Initialize date picker with default values
 */
function initializeDatePicker() {
    const today = new Date();
    const endDateInput = document.getElementById('end-date');
    const startDateInput = document.getElementById('start-date');
    
    // Format today's date as YYYY-MM-DD
    const endDateStr = today.toISOString().split('T')[0];
    endDateInput.value = endDateStr;
    
    // Default start date (5 years ago)
    const startDate = new Date();
    startDate.setFullYear(today.getFullYear() - 5);
    const startDateStr = startDate.toISOString().split('T')[0];
    startDateInput.value = startDateStr;
    
    // Set max date to today
    endDateInput.max = endDateStr;
    startDateInput.max = endDateStr;
}

/**
 * Setup ticker input controls (add/remove)
 */
function setupTickerControls() {
    const addTickerBtn = document.getElementById('add-ticker');
    const tickerInputsContainer = document.getElementById('ticker-inputs');
    
    // Add default ticker row
    addTickerRow();
    
    // Add ticker button click handler
    addTickerBtn.addEventListener('click', function() {
        addTickerRow();
    });
    
    // Remove ticker button delegation
    tickerInputsContainer.addEventListener('click', function(e) {
        if (e.target.classList.contains('remove-ticker')) {
            const tickerRow = e.target.closest('.ticker-item');
            
            // Only remove if we have more than one ticker
            if (document.querySelectorAll('.ticker-item').length > 1) {
                tickerRow.remove();
            } else {
                showError('Portfolio must contain at least one ticker');
            }
        }
    });
}

/**
 * Add a new ticker input row
 */
function addTickerRow() {
    const tickerInputsContainer = document.getElementById('ticker-inputs');
    
    const tickerRow = document.createElement('div');
    tickerRow.className = 'ticker-item';
    
    tickerRow.innerHTML = `
        <div class="ticker-symbol">
            <input type="text" class="ticker-input" placeholder="Ticker Symbol (e.g., AAPL)" required>
        </div>
        <div class="ticker-weight">
            <input type="number" class="weight-input" placeholder="Weight %" min="0" step="1" value="100" required>
        </div>
        <button type="button" class="btn btn-danger btn-sm remove-ticker">×</button>
    `;
    
    tickerInputsContainer.appendChild(tickerRow);
}

/**
 * Setup the analysis form submission
 */
function setupAnalysisForm() {
    const analysisForm = document.getElementById('analysis-form');
    const submitBtn = document.getElementById('analyze-btn');
    const downloadBtn = document.getElementById('download-returns-btn');
    
    // Form submission handler
    analysisForm.addEventListener('submit', function(e) {
        e.preventDefault();
        analyzePortfolio();
    });
    
    // Download returns button
    downloadBtn.addEventListener('click', function() {
        downloadReturns();
    });
    
    // Tab switching
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Show corresponding content
            const tabId = this.getAttribute('data-tab');
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(tabId).classList.add('active');
        });
    });
}

/**
 * Show error message
 */
function showError(message) {
    const errorElement = document.getElementById('error-message');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    // Hide after 5 seconds
    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 5000);
}

/**
 * Show loading spinner
 */
function showLoading(show) {
    document.getElementById('loader').style.display = show ? 'block' : 'none';
}

/**
 * Analyze portfolio
 */
function analyzePortfolio() {
    // Hide any previous errors and results
    document.getElementById('error-message').style.display = 'none';
    document.getElementById('results-container').style.display = 'none';
    
    // Show loading indicator
    showLoading(true);
    
    // Gather form data
    const formData = getFormData();
    
    // Validate form data
    if (!formData) {
        showLoading(false);
        return;
    }
    
    // Send request to server
    fetch('/analyze_portfolio', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
    })
    .then(response => response.json())
    .then(data => {
        showLoading(false);
        
        if (data.error) {
            showError(data.error);
            return;
        }
        
        // Display results
        displayResults(data);
    })
    .catch(error => {
        showLoading(false);
        showError('An error occurred while analyzing the portfolio. Please try again.');
        console.error('Error:', error);
    });
}

/**
 * Gather form data for analysis
 */
function getFormData() {
    const tickers = [];
    const weights = [];
    
    // Get ticker symbols and weights
    const tickerRows = document.querySelectorAll('.ticker-item');
    tickerRows.forEach(row => {
        const ticker = row.querySelector('.ticker-input').value.trim().toUpperCase();
        const weight = parseFloat(row.querySelector('.weight-input').value);
        
        if (ticker && !isNaN(weight) && weight > 0) {
            tickers.push(ticker);
            weights.push(weight);
        }
    });
    
    // Validate
    if (tickers.length === 0) {
        showError('Please add at least one valid ticker symbol');
        return null;
    }
    
    // Get date range
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    
    if (!startDate || !endDate) {
        showError('Please select a valid date range');
        return null;
    }
    
    if (new Date(startDate) >= new Date(endDate)) {
        showError('Start date must be before end date');
        return null;
    }
    
    return {
        tickers: tickers,
        weights: weights,
        start_date: startDate,
        end_date: endDate
    };
}

/**
 * Display analysis results
 */
function displayResults(data) {
    // Show results container
    document.getElementById('results-container').style.display = 'block';
    
    // Enable download button
    document.getElementById('download-returns-btn').disabled = false;
    
    // Display metrics
    displayMetrics(data.metrics);
    
    // Create charts
    createEquityCurveChart('equity-chart', data.chart_data);
    createDrawdownChart('drawdown-chart', data.chart_data);
    createMonthlyReturnsChart('monthly-returns-chart', data.chart_data);
    
    // Scroll to results
    document.getElementById('results-container').scrollIntoView({
        behavior: 'smooth'
    });
}

/**
 * Display metrics in the metrics table
 */
function displayMetrics(metrics) {
    document.getElementById('cagr-value').textContent = metrics.cagr;
    document.getElementById('volatility-value').textContent = metrics.volatility;
    document.getElementById('sharpe-value').textContent = metrics.sharpe_ratio;
    document.getElementById('max-drawdown-value').textContent = metrics.max_drawdown;
    document.getElementById('best-month-value').textContent = metrics.best_month;
    document.getElementById('worst-month-value').textContent = metrics.worst_month;
    document.getElementById('total-return-value').textContent = metrics.total_return;
    document.getElementById('period-value').textContent = `${metrics.years} years`;
    
    // Add color classes
    colorizeValue('total-return-value', metrics.total_return);
    colorizeValue('cagr-value', metrics.cagr);
    colorizeValue('max-drawdown-value', metrics.max_drawdown);
    colorizeValue('best-month-value', metrics.best_month);
    colorizeValue('worst-month-value', metrics.worst_month);
}

/**
 * Add positive/negative color classes to values
 */
function colorizeValue(elementId, value) {
    const element = document.getElementById(elementId);
    element.classList.remove('positive', 'negative');
    
    if (value !== 'N/A') {
        // Extract numeric part from percentage string
        const numValue = parseFloat(value.replace('%', ''));
        
        if (!isNaN(numValue)) {
            // For drawdown, negative is actually positive (less drawdown is good)
            if (elementId === 'max-drawdown-value') {
                element.classList.add(numValue > -10 ? 'positive' : 'negative');
            } else {
                element.classList.add(numValue >= 0 ? 'positive' : 'negative');
            }
        }
    }
}

/**
 * Download monthly returns CSV
 */
function downloadReturns() {
    showLoading(true);
    
    // Gather form data
    const formData = getFormData();
    
    // Validate form data
    if (!formData) {
        showLoading(false);
        return;
    }
    
    // Create form for POST submission
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/download_returns';
    
    // Create hidden field with JSON data
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'portfolio_data';
    input.value = JSON.stringify(formData);
    
    form.appendChild(input);
    document.body.appendChild(form);
    
    // Submit form to trigger file download
    form.submit();
    
    // Remove form
    document.body.removeChild(form);
    
    showLoading(false);
}
