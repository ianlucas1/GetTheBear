/**
 * Get the Bear - Portfolio Analysis Tool
 * Main JavaScript File
 */

// Import chart functions
import {
    createEquityCurveChart,
    createDrawdownChart,
    createAnnualReturnsChart,
    createAllocationChart,
    createCorrelationChart,
    ensureChartComponentsRegistered
} from './modules/charts/index.js';

// Import UI/Control modules
import { initializeDatePicker, getDateValues } from './modules/datePicker.js';
import { setupTickerControls, getTickersAndWeights } from './modules/tickerControls.js';
import { setupBenchmarkControl, getBenchmarkTicker } from './modules/benchmarkControl.js';

// Import utility functions
import { showError, validatePortfolioForm } from './modules/utils/validation.js';

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

/**
 * Initialize the application
 * This function sets up UI controls and ensures chart components are registered
 */
async function initializeApp() {
    console.log("Initializing application...");
    
    try {
        // Register chart components first (async operation)
        await ensureChartComponentsRegistered();
        
        // Initialize UI controls
        initializeDatePicker();
        setupTickerControls();
        setupBenchmarkControl();
        setupAnalysisForm();
        
        console.log("Application initialized successfully");
    } catch (error) {
        console.error("Error initializing application:", error);
        showError("Failed to initialize application. Please refresh the page.");
    }
}

/**
 * Setup the analysis form submission
 */
function setupAnalysisForm() {
    const analysisForm = document.getElementById('analysis-form');
    const submitBtn = document.getElementById('analyze-btn');
    const downloadBtn = document.getElementById('download-returns-btn');
    
    if (!analysisForm || !submitBtn || !downloadBtn) return;
    
    // Form submission handler
    analysisForm.addEventListener('submit', function(e) {
        e.preventDefault();
        analyzePortfolio();
    });
    
    // Download returns button
    downloadBtn.addEventListener('click', function() {
        downloadReturns();
    });
    
    // Tab switching (Keep this logic here for now)
    const tablist = document.querySelector('.tabs[role="tablist"]');
    const tabs = tablist ? tablist.querySelectorAll('.tab[role="tab"]') : [];

    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Find the previously selected tab and set aria-selected to false
            const previousSelectedTab = tablist.querySelector('.tab[aria-selected="true"]');
            if (previousSelectedTab) {
                previousSelectedTab.classList.remove('active');
                previousSelectedTab.setAttribute('aria-selected', 'false');
            }
            
            // Set aria-selected to true on the clicked tab
            this.classList.add('active');
            this.setAttribute('aria-selected', 'true');
            
            // Show corresponding content
            const tabId = this.getAttribute('data-tab');
            document.querySelectorAll('.tab-content[role="tabpanel"]').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(tabId).classList.add('active');
        });
    });
}

/**
 * Show loading spinner
 */
function showLoading(show) {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = show ? 'block' : 'none';
    }
}

/**
 * Analyze portfolio
 */
async function analyzePortfolio() {
    // Hide any previous errors and results
    const errorElement = document.getElementById('error-message');
    const resultsContainer = document.getElementById('results-container');
    if (errorElement) errorElement.style.display = 'none';
    if (resultsContainer) resultsContainer.style.display = 'none';
    
    // Show loading indicator
    showLoading(true);
    
    // Gather and validate form data using imported functions
    const formData = getFormData(); 
    
    if (!formData) {
        showLoading(false);
        return; // Validation failed inside getFormData
    }
    
    // ---- Send request to server (now with CSRF token) ----
    const csrfTokenInput = document.querySelector('input[name="csrf_token"]');
    const csrfToken = csrfTokenInput ? csrfTokenInput.value : '';

    try {
        const response = await fetch('/analyze_portfolio', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        showLoading(false);
        if (data.error) {
            showError(data.error); // Use imported showError
            return;
        }
        
        // Display results
        await displayResults(data);
    } catch (err) {
        showLoading(false);
        showError('An error occurred while analyzing the portfolio. Please try again.'); // Use imported showError
        console.error('Error:', err);
    }
}

/**
 * Gather and validate form data for analysis using imported modules
 * @returns {Object|null} Form data object or null if validation fails
 */
function getFormData() {
    const { tickers, weights } = getTickersAndWeights();
    const { start_date, end_date } = getDateValues();
    const benchmark_ticker = getBenchmarkTicker();

    // Validate using the imported function
    if (!validatePortfolioForm(tickers, weights, start_date, end_date, benchmark_ticker)) {
        return null; // Validation messages are shown by validatePortfolioForm
    }
    
    return {
        tickers,
        weights,
        start_date,
        end_date,
        benchmark_ticker
    };
}

/**
 * Display analysis results
 */
async function displayResults(data) {
    try {
        // Ensure Chart.js is ready before proceeding
        await ensureChartComponentsRegistered();
        
        // Show results container
        document.getElementById('results-container').style.display = 'block';
        
        // Enable download button
        document.getElementById('download-returns-btn').disabled = false;
        
        // Get the benchmark ticker name to display
        const benchmarkTicker = data.chart_data.benchmark_ticker || 'SPY';
        
        // Update benchmark header in the metrics table
        document.getElementById('benchmark-header').textContent = `Benchmark (${benchmarkTicker})`;
    
        // Display metrics for portfolio and benchmark
        displayMetrics(data.metrics, data.benchmark_metrics);
        
        // Handle the benchmark in portfolio notice
        const benchmarkNotice = document.getElementById('benchmark-in-portfolio-notice');
        const benchmarkNameNotice = document.getElementById('benchmark-name-notice');
        
        if (data.chart_data.benchmark_in_portfolio) {
            // Update the notice text with the benchmark ticker
            benchmarkNameNotice.textContent = benchmarkTicker;
            benchmarkNotice.style.display = 'block';
            
            // Add "(Benchmark)" label to ticker in the portfolio
            if (data.chart_data.benchmark_index >= 0) {
                const tickerRows = document.querySelectorAll('.ticker-item');
                if (tickerRows.length > data.chart_data.benchmark_index) {
                    const benchmarkRow = tickerRows[data.chart_data.benchmark_index];
                    const tickerInput = benchmarkRow.querySelector('.ticker-input');
                    if (tickerInput) {
                        // Make sure we don't add the label multiple times
                        if (!tickerInput.value.includes('(BENCHMARK)')) {
                            tickerInput.value = `${tickerInput.value.toUpperCase()} (BENCHMARK)`;
                        }
                    }
                }
            }
        } else {
            benchmarkNotice.style.display = 'none';
        }
        
        // Get the original tickers and weights from the form
        const originalTickers = [];
        const originalWeights = [];
        
        document.querySelectorAll('.ticker-item').forEach(item => {
            const ticker = item.querySelector('.ticker-input').value.trim().split(' (')[0];
            const weight = parseFloat(item.querySelector('.weight-input').value);
            if (ticker && !isNaN(weight) && weight > 0) {
                originalTickers.push(ticker);
                originalWeights.push(weight);
            }
        });
        
        // Normalize weights to sum to 1 for pie chart
        const totalWeight = originalWeights.reduce((a, b) => a + b, 0);
        const normalizedWeights = originalWeights.map(w => w / totalWeight);
        
        // Create charts (using imported functions asynchronously)
        await Promise.all([
            createEquityCurveChart('equity-chart', data.chart_data),
            createDrawdownChart('drawdown-chart', data.chart_data),
            createAnnualReturnsChart('returns-chart', data.chart_data),
            createAllocationChart('allocation-chart', 'allocation-legend', originalTickers, normalizedWeights)
        ]);
        
        // Create correlation heatmap if data is available
        if (data.correlation_matrix && data.correlation_matrix.tickers && data.correlation_matrix.tickers.length > 1) {
            await createCorrelationChart('correlation-chart', data.correlation_matrix);
        }
        
        // Create summary view with key metrics
        createSummaryView(data.metrics, data.benchmark_metrics);
        
        // Scroll to results
        document.getElementById('results-container').scrollIntoView({
            behavior: 'smooth'
        });
    } catch (error) {
        console.error("Error displaying results:", error);
        showError("Failed to display analysis results. Please try again.");
    }
}

/**
 * Display metrics in the metrics table
 */
function displayMetrics(portfolioMetrics, benchmarkMetrics) {
    // Helper function to format values and handle NaN/null/undefined
    function formatValue(value) {
        if (!value || value === 'N/A' || value === 'nan%' || value === 'null%') {
            return '0.00%';
        }
        return value;
    }
    
    // Make sure all value cells are right-aligned
    const allValueCells = document.querySelectorAll('.metrics-table td.value-cell');
    allValueCells.forEach(cell => {
        cell.classList.add('text-end');
    });
    
    // Portfolio metrics - existing metrics
    document.getElementById('cagr-value').textContent = formatValue(portfolioMetrics.cagr);
    document.getElementById('volatility-value').textContent = formatValue(portfolioMetrics.volatility);
    document.getElementById('sharpe-value').textContent = formatValue(portfolioMetrics.sharpe_ratio);
    document.getElementById('max-drawdown-value').textContent = formatValue(portfolioMetrics.max_drawdown);
    document.getElementById('best-month-value').textContent = formatValue(portfolioMetrics.best_month);
    document.getElementById('worst-month-value').textContent = formatValue(portfolioMetrics.worst_month);
    document.getElementById('total-return-value').textContent = formatValue(portfolioMetrics.total_return);
    document.getElementById('period-value').textContent = `${portfolioMetrics.years} years`;
    
    // Portfolio metrics - new metrics
    document.getElementById('sortino-ratio-value').textContent = formatValue(portfolioMetrics.sortino_ratio);
    document.getElementById('calmar-ratio-value').textContent = formatValue(portfolioMetrics.calmar_ratio);
    document.getElementById('max-drawdown-duration-value').textContent = portfolioMetrics.max_drawdown_duration || '0 months';
    document.getElementById('rolling-volatility-value').textContent = formatValue(portfolioMetrics.rolling_volatility);
    document.getElementById('rolling-return-value').textContent = formatValue(portfolioMetrics.rolling_return);
    
    // Benchmark metrics if available
    if (benchmarkMetrics) {
        // Existing benchmark metrics
        document.getElementById('benchmark-cagr-value').textContent = formatValue(benchmarkMetrics.cagr);
        document.getElementById('benchmark-volatility-value').textContent = formatValue(benchmarkMetrics.volatility);
        document.getElementById('benchmark-sharpe-value').textContent = formatValue(benchmarkMetrics.sharpe_ratio);
        document.getElementById('benchmark-max-drawdown-value').textContent = formatValue(benchmarkMetrics.max_drawdown);
        document.getElementById('benchmark-best-month-value').textContent = formatValue(benchmarkMetrics.best_month);
        document.getElementById('benchmark-worst-month-value').textContent = formatValue(benchmarkMetrics.worst_month);
        document.getElementById('benchmark-total-return-value').textContent = formatValue(benchmarkMetrics.total_return);
        
        // New benchmark metrics
        document.getElementById('benchmark-sortino-ratio-value').textContent = formatValue(benchmarkMetrics.sortino_ratio);
        document.getElementById('benchmark-calmar-ratio-value').textContent = formatValue(benchmarkMetrics.calmar_ratio);
        document.getElementById('benchmark-max-drawdown-duration-value').textContent = benchmarkMetrics.max_drawdown_duration || '0 months';
        document.getElementById('benchmark-rolling-volatility-value').textContent = formatValue(benchmarkMetrics.rolling_volatility);
        document.getElementById('benchmark-rolling-return-value').textContent = formatValue(benchmarkMetrics.rolling_return);
        
        // Add color classes to benchmark values - existing metrics
        colorizeValue('benchmark-total-return-value', formatValue(benchmarkMetrics.total_return));
        colorizeValue('benchmark-cagr-value', formatValue(benchmarkMetrics.cagr));
        colorizeValue('benchmark-max-drawdown-value', formatValue(benchmarkMetrics.max_drawdown));
        colorizeValue('benchmark-best-month-value', formatValue(benchmarkMetrics.best_month));
        colorizeValue('benchmark-worst-month-value', formatValue(benchmarkMetrics.worst_month));
        
        // Add color classes to benchmark values - new ratio metrics
        colorizeValue('benchmark-sortino-ratio-value', formatValue(benchmarkMetrics.sortino_ratio));
        colorizeValue('benchmark-calmar-ratio-value', formatValue(benchmarkMetrics.calmar_ratio));
        colorizeValue('benchmark-rolling-return-value', formatValue(benchmarkMetrics.rolling_return));
    } else {
        // If no benchmark data, display 0.00% for all benchmark metrics
        const benchmarkElements = [
            // Existing benchmark metrics
            'benchmark-cagr-value', 'benchmark-volatility-value', 'benchmark-sharpe-value',
            'benchmark-max-drawdown-value', 'benchmark-best-month-value', 'benchmark-worst-month-value',
            'benchmark-total-return-value',
            // New benchmark metrics
            'benchmark-sortino-ratio-value', 'benchmark-calmar-ratio-value', 
            'benchmark-rolling-volatility-value',
            'benchmark-rolling-return-value'
        ];
        benchmarkElements.forEach(elementId => {
            document.getElementById(elementId).textContent = '0.00%';
        });
        document.getElementById('benchmark-max-drawdown-duration-value').textContent = '0 months';
    }
    
    // Add color classes to portfolio values - existing metrics
    colorizeValue('total-return-value', formatValue(portfolioMetrics.total_return));
    colorizeValue('cagr-value', formatValue(portfolioMetrics.cagr));
    colorizeValue('max-drawdown-value', formatValue(portfolioMetrics.max_drawdown));
    colorizeValue('best-month-value', formatValue(portfolioMetrics.best_month));
    colorizeValue('worst-month-value', formatValue(portfolioMetrics.worst_month));
    
    // Add color classes to portfolio values - new ratio metrics
    colorizeValue('sortino-ratio-value', formatValue(portfolioMetrics.sortino_ratio));
    colorizeValue('calmar-ratio-value', formatValue(portfolioMetrics.calmar_ratio));
    colorizeValue('rolling-return-value', formatValue(portfolioMetrics.rolling_return));
}

/**
 * Create summary view with key metrics
 */
function createSummaryView(portfolioMetrics, benchmarkMetrics) {
    const summaryContainer = document.getElementById('summary-metrics');
    if (!summaryContainer) return;
    
    // Helper function to format values and handle NaN/null/undefined
    function formatValue(value) {
        if (!value || value === 'N/A' || value === 'nan%' || value === 'null%') {
            return '0.00%';
        }
        return value;
    }
    
    summaryContainer.innerHTML = ''; // Clear any existing content
    
    // Key metrics to display in the summary
    const keyMetrics = [
        { id: 'total-return', label: 'Total Return', value: formatValue(portfolioMetrics.total_return) },
        { id: 'cagr', label: 'CAGR', value: formatValue(portfolioMetrics.cagr) },
        { id: 'volatility', label: 'Volatility', value: formatValue(portfolioMetrics.volatility) },
        { id: 'sharpe', label: 'Sharpe Ratio', value: formatValue(portfolioMetrics.sharpe_ratio) },
        { id: 'max-drawdown', label: 'Max Drawdown', value: formatValue(portfolioMetrics.max_drawdown) },
        { id: 'sortino', label: 'Sortino Ratio', value: formatValue(portfolioMetrics.sortino_ratio) },
        { id: 'calmar', label: 'Calmar Ratio', value: formatValue(portfolioMetrics.calmar_ratio) },
        { id: 'rolling-return', label: 'TTM Return', value: formatValue(portfolioMetrics.rolling_return) }
    ];
    
    // Add each metric to the summary
    keyMetrics.forEach(metric => {
        const metricElement = document.createElement('div');
        metricElement.className = 'metric-card';
        
        const metricTitle = document.createElement('div');
        metricTitle.className = 'metric-title';
        metricTitle.textContent = metric.label;
        
        const metricValue = document.createElement('div');
        metricValue.className = 'metric-value';
        metricValue.textContent = metric.value;
        
        // Add color class
        if (metric.value !== 'N/A' && metric.value !== '0.00%') {
            const numValue = parseFloat(metric.value.replace('%', ''));
            if (!isNaN(numValue)) {
                // For drawdown, negative is actually positive (less drawdown is good)
                if (metric.id === 'max-drawdown') {
                    metricValue.classList.add(numValue > -10 ? 'positive' : 'negative');
                } else {
                    metricValue.classList.add(numValue >= 0 ? 'positive' : 'negative');
                }
            }
        }
        
        const benchmarkValue = document.createElement('div');
        benchmarkValue.className = 'benchmark-value';
        
        if (benchmarkMetrics) {
            const benchmarkKey = metric.id.replace(/-/g, '_');
            const benchmarkMetricValue = formatValue(benchmarkMetrics[benchmarkKey] || '0.00%');
            benchmarkValue.textContent = `Benchmark: ${benchmarkMetricValue}`;
        } else {
            benchmarkValue.textContent = 'Benchmark: 0.00%';
        }
        
        metricElement.appendChild(metricTitle);
        metricElement.appendChild(metricValue);
        metricElement.appendChild(benchmarkValue);
        
        summaryContainer.appendChild(metricElement);
    });
}

/**
 * Add positive/negative color classes to values
 */
function colorizeValue(elementId, value) {
    const element = document.getElementById(elementId);
    element.classList.remove('positive', 'negative');
    
    if (value !== 'N/A' && value !== '0.00%') {
        // Extract numeric part from percentage string
        const numValue = parseFloat(value.replace('%', ''));
        
        if (!isNaN(numValue)) {
            // For drawdown, negative is actually positive (less drawdown is good)
            if (elementId === 'max-drawdown-value' || elementId === 'benchmark-max-drawdown-value') {
                element.classList.add(numValue > -10 ? 'positive' : 'negative');
            } else {
                element.classList.add(numValue >= 0 ? 'positive' : 'negative');
            }
        }
    }
}

/**
 * Download returns CSV with portfolio and benchmark data
 */
function downloadReturns() {
    showLoading(true);
    
    // Gather and validate form data using the refactored function
    const formData = getFormData();
    
    // Validate form data
    if (!formData) {
        showLoading(false);
        return; // Validation errors shown by getFormData/validatePortfolioForm
    }
    
    // Get the benchmark ticker
    const benchmarkTicker = formData.benchmark_ticker;
    
    // Construct URL with query parameters
    const url = `/download_returns?tickers=${formData.tickers.join(',')}&weights=${formData.weights.join(',')}&start_date=${formData.start_date}&end_date=${formData.end_date}&benchmark_ticker=${benchmarkTicker}`;
    
    // Create filename with benchmark ticker
    const filename = `portfolio_vs_${benchmarkTicker}_returns.csv`;
    
    // Create temporary link to download the file
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.download = filename;
    
    // Append to document, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showLoading(false);
}   