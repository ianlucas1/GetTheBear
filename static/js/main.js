/**
 * Get the Bear - Portfolio Analysis Tool
 * Main JavaScript File
 */

// Import chart functions (now just the creation functions)
import {
    createEquityCurveChart,
    createDrawdownChart,
    createAnnualReturnsChart,
    createAllocationChart,
    createCorrelationChart,
    setupTabs // Import setupTabs from index.js
} from './modules/charts/index.js';

// Import UI/Control modules
import { initializeDatePicker, getDateValues } from './modules/datePicker.js';
import { setupTickerControls, getTickersAndWeights } from './modules/tickerControls.js';
import { setupBenchmarkControl, getBenchmarkTicker } from './modules/benchmarkControl.js';

// Import utility functions
import { showError, validatePortfolioForm } from './modules/utils/validation.js';
// Note: chartUtils.js (renderChart) is used internally by chart modules, not directly here.

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

/**
 * Initialize the application
 * Sets up UI controls.
 */
function initializeApp() {
    console.log("Initializing application...");
    
    try {
        // Initialize UI controls
        initializeDatePicker();
        setupTickerControls();
        setupBenchmarkControl();
        setupAnalysisForm();
        setupTabs(); // Setup tabs after the form is ready
        
        console.log("Application initialized successfully");
    } catch (error) {
        console.error("Error initializing application:", error);
        showError("Failed to initialize application. Please refresh the page.");
    }
}

/**
 * Setup the analysis form submission and tab controls.
 */
function setupAnalysisForm() {
    const analysisForm = document.getElementById('analysis-form');
    const submitBtn = document.getElementById('analyze-btn');
    const downloadBtn = document.getElementById('download-returns-btn');
    
    if (!analysisForm || !submitBtn || !downloadBtn) {
        console.error("Form elements (analysis-form, analyze-btn, download-returns-btn) not found.");
        return;
    }
    
    // Form submission handler
    analysisForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        await analyzePortfolio(); // Make call async
    });
    
    // Download returns button
    downloadBtn.addEventListener('click', function() {
        downloadReturns(); // This can remain synchronous
    });

    // Tab switching logic is now handled by setupTabs() in modules/charts/index.js
    // We call setupTabs() within initializeApp()
}

/**
 * Show/Hide loading spinner
 * @param {boolean} show - Whether to show or hide the loader
 */
function showLoading(show) {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = show ? 'flex' : 'none'; // Use flex for centering if needed by CSS
    }
}

/**
 * Analyze portfolio: fetch data and trigger result display
 */
async function analyzePortfolio() {
    // Hide any previous errors and results
    const errorElement = document.getElementById('error-message');
    const resultsContainer = document.getElementById('results-container');
    if (errorElement) errorElement.style.display = 'none';
    if (resultsContainer) resultsContainer.style.display = 'none'; // Hide results initially
    
    // Show loading indicator
    showLoading(true);
    
    // Gather and validate form data using imported functions
    const formData = getFormData(); 
    
    if (!formData) {
        showLoading(false);
        return; // Validation failed inside getFormData
    }
    
    // ---- Send request to server ----
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
        
        // Check for non-OK responses (like 400, 500 handled by Flask but good practice)
        if (!response.ok) {
            let errorMsg = `Server error: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg; // Use server error if available
            } catch (jsonError) {
                // Ignore if response wasn't JSON
            }
            throw new Error(errorMsg); // Throw an error to be caught below
        }

        const data = await response.json();
        
        showLoading(false);

        // Check for application-level errors returned in JSON
        if (data.error) {
            showError(data.error);
            return;
        }
        
        // Display results
        await displayResults(data);

    } catch (err) {
        showLoading(false);
        showError(`An error occurred: ${err.message || 'Please try again.'}`);
        console.error('Analysis Error:', err);
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
    
    // Return structured data
    return {
        tickers,
        weights, // Weights are already in % (e.g., 50 for 50%)
        start_date,
        end_date,
        benchmark_ticker
    };
}

/**
 * Display analysis results: metrics, notices, charts, summary
 */
async function displayResults(data) {
    // No need for ensureChartComponentsRegistered call here anymore

    // Show results container
    const resultsContainer = document.getElementById('results-container');
    if (!resultsContainer) return; // Should not happen, but guard anyway
    resultsContainer.style.display = 'block';
    
    // Enable download button
    const downloadBtn = document.getElementById('download-returns-btn');
    if (downloadBtn) downloadBtn.disabled = false;
    
    // Get benchmark ticker name
    const benchmarkTicker = data.chart_data?.benchmark_ticker || 'SPY'; // Use optional chaining
    
    // Update benchmark header in the metrics table
    const benchmarkHeader = document.getElementById('benchmark-header');
    if (benchmarkHeader) benchmarkHeader.textContent = `Benchmark (${benchmarkTicker})`;

    // Display metrics table
    displayMetrics(data.metrics, data.benchmark_metrics);
    
    // Handle benchmark in portfolio notice
    handleBenchmarkNotice(data.chart_data, benchmarkTicker);
    
    // --- Prepare data for charts --- 
    // Get the original tickers and weights *as entered by the user* for allocation chart
    const { tickers: originalTickers, weights: originalWeights } = getTickersAndWeights(false); // Pass false to not clean benchmark label
    
    // Normalize weights to sum to 1 for allocation chart (weights are 0-100)
    const totalWeight = originalWeights.reduce((a, b) => a + b, 0);
    const normalizedWeights = totalWeight > 0 ? originalWeights.map(w => w / totalWeight) : [];

    // --- Create charts --- 
    // Use Promise.allSettled to attempt rendering all charts even if one fails.
    const chartPromises = [
        createEquityCurveChart('equity-chart', data.chart_data),
        createDrawdownChart('drawdown-chart', data.chart_data),
        createAnnualReturnsChart('returns-chart', data.chart_data),
        createAllocationChart('allocation-chart', 'allocation-legend', originalTickers, normalizedWeights)
    ];
    
    // Add correlation chart if data is valid
    if (data.correlation_matrix?.tickers?.length > 1) {
        chartPromises.push(createCorrelationChart('correlation-chart', data.correlation_matrix));
    } else {
         // Clear or hide the correlation chart container if no data
         const corrContainer = document.getElementById('correlation-chart');
         if (corrContainer) corrContainer.innerHTML = '<div class="chart-info">Correlation matrix requires at least 2 tickers.</div>';
    }
    
    // Wait for all chart rendering attempts to complete
    const results = await Promise.allSettled(chartPromises);
    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            // Error handling is done within renderChart, but log here too if needed
            console.error(`Chart rendering failed (index ${index}):`, result.reason);
        }
    });
    console.log("Chart rendering process finished.");

    // --- Create summary view --- 
    createSummaryView(data.metrics, data.benchmark_metrics);
    
    // Scroll to results after a short delay to allow rendering
    setTimeout(() => {
        resultsContainer.scrollIntoView({ behavior: 'smooth' });
    }, 100); 
}

/**
 * Handles showing/hiding the notice about the benchmark being in the portfolio
 * and updates the ticker label in the form.
 */
function handleBenchmarkNotice(chartData, benchmarkTicker) {
    const benchmarkNotice = document.getElementById('benchmark-in-portfolio-notice');
    const benchmarkNameNotice = document.getElementById('benchmark-name-notice');

    if (!benchmarkNotice || !benchmarkNameNotice) return;

    if (chartData?.benchmark_in_portfolio) {
        benchmarkNameNotice.textContent = benchmarkTicker;
        benchmarkNotice.style.display = 'block';

        // Add "(Benchmark)" label to the corresponding ticker input field
        if (chartData.benchmark_index >= 0) {
            const tickerRows = document.querySelectorAll('.ticker-item');
            if (tickerRows.length > chartData.benchmark_index) {
                const benchmarkRow = tickerRows[chartData.benchmark_index];
                const tickerInput = benchmarkRow.querySelector('.ticker-input');
                if (tickerInput && !tickerInput.value.includes('(BENCHMARK)')) {
                    // Find the actual ticker symbol before adding the label
                    const currentTicker = tickerInput.value.trim().split(' (')[0].toUpperCase();
                    tickerInput.value = `${currentTicker} (BENCHMARK)`; 
                }
            }
        }
    } else {
        benchmarkNotice.style.display = 'none';
        // Optional: Clean up any existing (BENCHMARK) labels from previous runs
        document.querySelectorAll('.ticker-input').forEach(input => {
            if (input.value.includes('(BENCHMARK)')) {
                 input.value = input.value.replace(/\s*\(BENCHMARK\)/i, '').trim();
            }
        });
    }
}


/**
 * Display metrics in the metrics table - Refactored for template literals
 */
function displayMetrics(portfolioMetrics, benchmarkMetrics) {
    const tableBody = document.querySelector('.metrics-table tbody');
    if (!tableBody) return;

    // Helper to format values, handling N/A, null, NaN
    function formatValue(value, type = 'percent') {
        if (value === null || value === undefined || value === 'N/A' || String(value).toLowerCase() === 'nan%' || String(value).toLowerCase() === 'null%') {
            return type === 'percent' ? '0.00%' : (type === 'months' ? '0 months' : '0.00');
        }
        // If it's already formatted (contains %), return as is
        if (typeof value === 'string' && value.includes('%')) {
            return value;
        }
        // If it's a duration string
        if (typeof value === 'string' && value.includes('months')) {
             return value;
        }
        // If it's years (number)
        if (type === 'years') {
             return `${value} years`;
        }
        // Format numbers as percentage or fixed decimal
        if (typeof value === 'number') {
             if (type === 'percent') {
                 return `${(value * 100).toFixed(2)}%`; // Assuming input value is decimal for % 
             } else if (type === 'ratio') {
                  return value.toFixed(2);
             }
        }
        // Fallback for unexpected types or pre-formatted strings without %
        return String(value);
    }

     // Helper to generate CSS class for positive/negative values
    function getColorClass(valueStr, metricId) {
        if (!valueStr || valueStr === 'N/A' || valueStr === '0.00%' || valueStr === '0.00') {
            return '';
        }
        const numValue = parseFloat(valueStr.replace('%', ''));
        if (isNaN(numValue)) return '';

        // Lower (less negative) drawdown is good
        const isDrawdown = metricId.includes('max-drawdown');
        if (isDrawdown) {
            return numValue > -10 ? 'positive' : 'negative'; // Threshold for drawdown color
        } else {
            // Standard: positive numbers are good
            return numValue >= 0 ? 'positive' : 'negative';
        }
    }

    // Define metrics and their formatting/IDs
    const metricsMap = [
        { label: 'CAGR', id: 'cagr', type: 'percent' },
        { label: 'Volatility', id: 'volatility', type: 'percent' },
        { label: 'Sharpe Ratio', id: 'sharpe', type: 'ratio' }, // Corrected ID
        { label: 'Max Drawdown', id: 'max-drawdown', type: 'percent' },
        { label: 'Max Drawdown Duration', id: 'max-drawdown-duration', type: 'months' },
        { label: 'Sortino Ratio', id: 'sortino-ratio', type: 'ratio' },
        { label: 'Calmar Ratio', id: 'calmar-ratio', type: 'ratio' },
        { label: 'Total Return', id: 'total-return', type: 'percent' },
        { label: 'Rolling 12M Return', id: 'rolling-return', type: 'percent' },
        { label: 'Rolling 12M Volatility', id: 'rolling-volatility', type: 'percent' },
        { label: 'Best Month', id: 'best-month', type: 'percent' },
        { label: 'Worst Month', id: 'worst-month', type: 'percent' },
        { label: 'Time Period', id: 'period', type: 'years' } // Special case
    ];

    let tableHTML = '';

    metricsMap.forEach(metric => {
        const portfolioKey = metric.id.replace(/-/g, '_'); // Convert ID to snake_case for data keys
        const portfolioRawValue = portfolioMetrics ? portfolioMetrics[portfolioKey] : null;
        const benchmarkRawValue = benchmarkMetrics ? benchmarkMetrics[portfolioKey] : null;

        // Format values
        const portfolioDisplayValue = formatValue(portfolioRawValue, metric.type);
        let benchmarkDisplayValue = '--';
        if (metric.id !== 'period') {
            benchmarkDisplayValue = benchmarkMetrics ? formatValue(benchmarkRawValue, metric.type) : formatValue(null, metric.type);
        }

        // Get color classes
        const portfolioColorClass = getColorClass(portfolioDisplayValue, metric.id);
        const benchmarkColorClass = (metric.id !== 'period' && benchmarkMetrics) ? getColorClass(benchmarkDisplayValue, `benchmark-${metric.id}`) : '';

        tableHTML += `
            <tr>
                <td>${metric.label}</td>
                <td id="${metric.id}-value" class="value-cell text-end ${portfolioColorClass}">${portfolioDisplayValue}</td>
                ${metric.id !== 'period' ? 
                    `<td id="benchmark-${metric.id}-value" class="value-cell text-end ${benchmarkColorClass}">${benchmarkDisplayValue}</td>` : 
                    '<td class="value-cell text-right">--</td>' // Placeholder for period row benchmark cell
                }
            </tr>
        `;
    });

    tableBody.innerHTML = tableHTML;
}


/**
 * Create summary view using template literals
 */
function createSummaryView(portfolioMetrics, benchmarkMetrics) {
    const summaryContainer = document.getElementById('summary-metrics');
    if (!summaryContainer) return;

    // Helper functions (copied from displayMetrics for now, consider moving to utils)
    function formatValue(value, type = 'percent') {
        if (value === null || value === undefined || value === 'N/A' || String(value).toLowerCase() === 'nan%' || String(value).toLowerCase() === 'null%') {
            return type === 'percent' ? '0.00%' : (type === 'ratio' ? '0.00' : '0.00');
        }
        if (typeof value === 'string' && value.includes('%')) return value;
         if (typeof value === 'number') {
             if (type === 'percent') return `${(value * 100).toFixed(2)}%`;
             if (type === 'ratio') return value.toFixed(2);
        }
        return String(value);
    }
    function getColorClass(valueStr, metricId) {
        if (!valueStr || valueStr === 'N/A' || valueStr === '0.00%' || valueStr === '0.00') return '';
        const numValue = parseFloat(valueStr.replace('%', ''));
        if (isNaN(numValue)) return '';
        const isDrawdown = metricId.includes('max-drawdown');
        if (isDrawdown) return numValue > -10 ? 'positive' : 'negative';
        else return numValue >= 0 ? 'positive' : 'negative';
    }
    
    summaryContainer.innerHTML = ''; // Clear previous content

    // Key metrics definition
     const keyMetrics = [
        { id: 'total-return', label: 'Total Return', type: 'percent' },
        { id: 'cagr', label: 'CAGR', type: 'percent' },
        { id: 'volatility', label: 'Volatility', type: 'percent' },
        { id: 'sharpe', label: 'Sharpe Ratio', type: 'ratio' }, // Use correct ID
        { id: 'max-drawdown', label: 'Max Drawdown', type: 'percent' },
        { id: 'sortino-ratio', label: 'Sortino Ratio', type: 'ratio' },
        { id: 'calmar-ratio', label: 'Calmar Ratio', type: 'ratio' },
        { id: 'rolling-return', label: 'TTM Return', type: 'percent' }
    ];

    let summaryHTML = '';

    keyMetrics.forEach(metric => {
        const portfolioKey = metric.id.replace(/-/g, '_');
        const portfolioRawValue = portfolioMetrics ? portfolioMetrics[portfolioKey] : null;
        const portfolioDisplayValue = formatValue(portfolioRawValue, metric.type);
        const portfolioColorClass = getColorClass(portfolioDisplayValue, metric.id);

        let benchmarkDisplayValue = '0.00%'; // Default
        if (metric.type === 'ratio') benchmarkDisplayValue = '0.00';
        
        if (benchmarkMetrics) {
            const benchmarkRawValue = benchmarkMetrics[portfolioKey]; // Already snake_case
            benchmarkDisplayValue = formatValue(benchmarkRawValue, metric.type);
        }

        summaryHTML += `
            <div class="metric-card">
                <div class="metric-title">${metric.label}</div>
                <div class="metric-value ${portfolioColorClass}">${portfolioDisplayValue}</div>
                <div class="benchmark-value">Benchmark: ${benchmarkDisplayValue}</div>
            </div>
        `;
    });

    summaryContainer.innerHTML = summaryHTML;
}


/**
 * Download returns CSV
 */
function downloadReturns() {
    // No change needed here unless form data structure changes
    showLoading(true);
    const formData = getFormData();
    if (!formData) {
        showLoading(false);
        return;
    }
    
    const { tickers, weights, start_date, end_date, benchmark_ticker } = formData;
    
    // Construct URL with query parameters
    const queryParams = new URLSearchParams({
        tickers: tickers.join(','),
        weights: weights.join(','),
        start_date,
        end_date,
        benchmark_ticker
    });
    const url = `/download_returns?${queryParams.toString()}`;
    
    // Create filename
    const filename = `portfolio_vs_${benchmark_ticker || 'benchmark'}_returns_${start_date}_to_${end_date}.csv`;
    
    // Create temporary link and click
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank'; // Open in new tab/window if direct download fails
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showLoading(false);
}   