/**
 * Equity Curve Chart Module
 */

/**
 * Create an equity curve chart showing portfolio and benchmark performance over time
 * @param {string} containerId - The ID of the HTML element to render the chart in
 * @param {Object} chartData - Data from the API response
 */
export function createEquityCurveChart(containerId, chartData) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const dates = chartData.dates || [];
    const portfolioValues = chartData.portfolio_values || [];
    
    if (dates.length === 0 || portfolioValues.length === 0) {
        container.innerHTML = '<div class="chart-error">Insufficient data to create chart</div>';
        return;
    }
    
    // Create chart data
    const chartConfig = {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                {
                    label: 'Portfolio',
                    data: portfolioValues,
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHitRadius: 10,
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Portfolio Equity Curve',
                    font: {
                        size: 16
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('en-US', { 
                                    style: 'decimal',
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                },
                legend: {
                    position: 'top',
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'month',
                        displayFormats: {
                            month: 'MMM yyyy'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Date'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Value (Starting at 1.0)'
                    },
                    min: calculateYAxisMinimum(portfolioValues, chartData.benchmark_values)
                }
            }
        }
    };
    
    // Add benchmark data if available
    const benchmarkTicker = chartData.benchmark_ticker || 'SPY';
    
    if (!chartData.benchmark_in_portfolio && chartData.benchmark_values) {
        chartConfig.data.datasets.push({
            label: `Benchmark (${benchmarkTicker})`,
            data: chartData.benchmark_values,
            backgroundColor: 'rgba(153, 102, 255, 0.2)',
            borderColor: 'rgba(153, 102, 255, 1)',
            borderWidth: 2,
            pointRadius: 0,
            pointHitRadius: 10,
            tension: 0.1
        });
    }
    
    // Clear previous chart if it exists
    container.innerHTML = '';
    
    // Create canvas element
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    
    // Create the chart
    new Chart(canvas, chartConfig);
}

/**
 * Calculate a suitable minimum for the Y axis
 * @param {Array} portfolioValues - Portfolio values array
 * @param {Array} benchmarkValues - Benchmark values array (optional)
 * @returns {number} The minimum Y value for the chart
 */
function calculateYAxisMinimum(portfolioValues, benchmarkValues) {
    let allValues = [...portfolioValues];
    
    if (benchmarkValues && benchmarkValues.length > 0) {
        allValues = allValues.concat(benchmarkValues);
    }
    
    if (allValues.length === 0) return 0;
    
    const minValue = Math.min(...allValues.filter(v => v !== null && !isNaN(v)));
    
    // If the minimum is less than 0.8, use it with a slight buffer
    // Otherwise, start the axis at 0.8 to better visualize growth
    return minValue < 0.8 ? Math.floor(minValue * 10) / 10 : 0.8;
} 