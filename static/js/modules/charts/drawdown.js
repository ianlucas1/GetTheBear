/**
 * Drawdown Chart Module
 */

/**
 * Create a drawdown chart showing portfolio and benchmark drawdowns over time
 * @param {string} containerId - The ID of the HTML element to render the chart in
 * @param {Object} chartData - Data from the API response
 */
export function createDrawdownChart(containerId, chartData) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const dates = chartData.dates || [];
    const drawdowns = chartData.drawdowns || [];
    
    if (dates.length === 0 || drawdowns.length === 0) {
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
                    label: 'Portfolio Drawdown',
                    data: drawdowns,
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHitRadius: 10,
                    tension: 0.1,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Portfolio Drawdown',
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
                                    style: 'percent',
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
                        text: 'Drawdown (%)'
                    },
                    min: calculateYAxisMinimum(drawdowns, chartData.benchmark_drawdowns),
                    max: 0.01, // Slightly above 0 for better visualization
                    ticks: {
                        callback: function(value) {
                            return new Intl.NumberFormat('en-US', { 
                                style: 'percent',
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0
                            }).format(value);
                        }
                    }
                }
            }
        }
    };
    
    // Add benchmark data if available
    const benchmarkTicker = chartData.benchmark_ticker || 'SPY';
    
    if (!chartData.benchmark_in_portfolio && chartData.benchmark_drawdowns) {
        chartConfig.data.datasets.push({
            label: `${benchmarkTicker} Drawdown`,
            data: chartData.benchmark_drawdowns,
            backgroundColor: 'rgba(153, 102, 255, 0.2)',
            borderColor: 'rgba(153, 102, 255, 1)',
            borderWidth: 2,
            pointRadius: 0,
            pointHitRadius: 10,
            tension: 0.1,
            fill: true
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
 * @param {Array} drawdowns - Portfolio drawdowns array
 * @param {Array} benchmarkDrawdowns - Benchmark drawdowns array (optional)
 * @returns {number} The minimum Y value for the chart
 */
function calculateYAxisMinimum(drawdowns, benchmarkDrawdowns) {
    let allValues = [...drawdowns];
    
    if (benchmarkDrawdowns && benchmarkDrawdowns.length > 0) {
        allValues = allValues.concat(benchmarkDrawdowns);
    }
    
    if (allValues.length === 0) return -0.1;
    
    const minValue = Math.min(...allValues.filter(v => v !== null && !isNaN(v)));
    
    // Round down to nearest 5% and add 5% buffer
    return Math.floor(minValue * 20) / 20 - 0.05;
} 