/**
 * Annual Returns Chart Module
 */

/**
 * Create an annual returns chart showing yearly performance
 * @param {string} containerId - The ID of the HTML element to render the chart in
 * @param {Object} chartData - Data from the API response
 */
export function createAnnualReturnsChart(containerId, chartData) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Gather annual returns data
    const annualReturns = chartData.annual_returns || {};
    const benchmarkAnnualReturns = chartData.benchmark_annual_returns || {};
    
    if (Object.keys(annualReturns).length === 0) {
        container.innerHTML = '<div class="chart-error">Insufficient data to create chart</div>';
        return;
    }
    
    // Organize data for chart
    const years = Object.keys(annualReturns).map(Number).sort((a, b) => a - b);
    const portfolioData = years.map(year => {
        const returnStr = annualReturns[year] || '0.00%';
        return parseFloat(returnStr.replace('%', '')) / 100;
    });
    
    const benchmarkData = years.map(year => {
        if (!benchmarkAnnualReturns[year]) return null;
        const returnStr = benchmarkAnnualReturns[year] || '0.00%';
        return parseFloat(returnStr.replace('%', '')) / 100;
    });
    
    // Determine if we have benchmark data
    const hasBenchmarkData = benchmarkData.some(value => value !== null);
    
    // Create chart data
    const chartConfig = {
        type: 'bar',
        data: {
            labels: years,
            datasets: [
                {
                    label: 'Portfolio',
                    data: portfolioData,
                    backgroundColor: portfolioData.map(value => 
                        value >= 0 ? 'rgba(75, 192, 192, 0.7)' : 'rgba(255, 99, 132, 0.7)'
                    ),
                    borderColor: portfolioData.map(value => 
                        value >= 0 ? 'rgba(75, 192, 192, 1)' : 'rgba(255, 99, 132, 1)'
                    ),
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Annual Returns',
                    font: {
                        size: 16
                    }
                },
                tooltip: {
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
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Year'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Return (%)'
                    },
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
    
    if (hasBenchmarkData) {
        chartConfig.data.datasets.push({
            label: `Benchmark (${benchmarkTicker})`,
            data: benchmarkData,
            backgroundColor: 'rgba(153, 102, 255, 0.5)',
            borderColor: 'rgba(153, 102, 255, 1)',
            borderWidth: 1,
            type: 'line',
            pointStyle: 'circle',
            pointRadius: 4,
            pointHoverRadius: 6
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