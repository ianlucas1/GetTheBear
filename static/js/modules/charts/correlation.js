/**
 * Correlation Chart Module
 */

/**
 * Create a correlation heatmap chart
 * @param {string} containerId - The ID of the HTML element to render the chart in
 * @param {Object} correlationData - Correlation data from the API response
 */
export function createCorrelationChart(containerId, correlationData) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Validate input data
    if (!correlationData || !correlationData.tickers || !correlationData.matrix || 
        correlationData.tickers.length === 0 || correlationData.matrix.length === 0) {
        container.innerHTML = '<div class="chart-error">Insufficient data to create correlation chart</div>';
        return;
    }
    
    const tickers = correlationData.tickers;
    const matrix = correlationData.matrix;
    
    // Ensure we have valid matrix dimensions
    if (matrix.length !== tickers.length) {
        container.innerHTML = '<div class="chart-error">Invalid correlation data dimensions</div>';
        return;
    }
    
    // Format data for the heatmap
    const datasets = [];
    
    // Create dataset for each row
    for (let i = 0; i < tickers.length; i++) {
        const rowData = [];
        
        // Create data points for each cell
        for (let j = 0; j < tickers.length; j++) {
            rowData.push({
                x: j,
                y: i,
                v: matrix[i][j] // Original correlation value for tooltip
            });
        }
        
        datasets.push({
            data: rowData,
            backgroundColor: generateCellColors(matrix[i]),
            borderColor: 'rgba(0, 0, 0, 0.1)',
            borderWidth: 1
        });
    }
    
    // Create chart data
    const chartConfig = {
        type: 'matrix',
        data: {
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Correlation Matrix',
                    font: {
                        size: 16
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            const item = context[0];
                            const i = item.parsed.y;
                            const j = item.parsed.x;
                            return `${tickers[i]} vs ${tickers[j]}`;
                        },
                        label: function(context) {
                            // Use the original value from our v property
                            const value = context.raw.v;
                            return `Correlation: ${value.toFixed(2)}`;
                        }
                    }
                },
                legend: {
                    display: false
                }
            },
            layout: {
                padding: {
                    top: 30,
                    right: 30,
                    bottom: 30,
                    left: 30
                }
            },
            scales: {
                x: {
                    type: 'category',
                    labels: tickers,
                    offset: true,
                    ticks: {
                        display: true
                    },
                    grid: {
                        display: false
                    }
                },
                y: {
                    type: 'category',
                    labels: tickers,
                    offset: true,
                    ticks: {
                        display: true
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    };
    
    // Create custom plugin to draw correlation values in cells
    const correlationLabelsPlugin = {
        id: 'correlationLabels',
        afterDatasetDraw: function(chart) {
            const ctx = chart.ctx;
            ctx.save();
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            for (let i = 0; i < tickers.length; i++) {
                for (let j = 0; j < tickers.length; j++) {
                    const value = matrix[i][j];
                    const meta = chart.getDatasetMeta(i);
                    const element = meta.data[j];
                    
                    // Skip if element is not visible
                    if (!element || !element.active) continue;
                    
                    // Get the cell position from the element
                    const position = element.getCenterPoint();
                    
                    // Set text color based on background
                    if (value >= 0.7) {
                        ctx.fillStyle = '#ffffff'; // White text on dark background
                    } else {
                        ctx.fillStyle = '#000000'; // Black text on light background
                    }
                    
                    // Draw the correlation value
                    ctx.fillText(value.toFixed(2), position.x, position.y);
                }
            }
            
            ctx.restore();
        }
    };
    
    // Register the plugin
    Chart.register(correlationLabelsPlugin);
    
    // Clear previous chart if it exists
    container.innerHTML = '';
    
    // Create canvas element
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    
    // Create the chart
    new Chart(canvas, chartConfig);
}

/**
 * Generate cell background colors based on correlation values
 * @param {Array} correlations - Array of correlation values
 * @returns {Array} Array of color strings
 */
function generateCellColors(correlations) {
    return correlations.map(value => {
        // Negative correlation: Blue to White
        if (value < 0) {
            const intensity = Math.abs(value);
            return `rgba(0, 0, 255, ${intensity * 0.7})`;
        }
        // Positive correlation: White to Red
        else {
            return `rgba(255, 0, 0, ${value * 0.7})`;
        }
    });
} 