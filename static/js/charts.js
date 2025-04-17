/**
 * Get the Bear - Portfolio Analysis Tool
 * Charts JavaScript File
 */

/**
 * Create an equity curve chart using Plotly
 */
function createEquityCurveChart(elementId, data) {
    const dates = data.dates;
    const portfolioValues = data.portfolio_values;
    
    // Portfolio trace
    const portfolioTrace = {
        x: dates,
        y: portfolioValues,
        type: 'scatter',
        mode: 'lines',
        name: 'Portfolio Value',
        line: {
            color: '#0052CC',
            width: 2
        }
    };
    
    // Array of traces, starting with portfolio
    const traces = [portfolioTrace];
    
    // Add benchmark trace if available
    if (data.benchmark_values) {
        // Separate benchmark data
        const benchmarkTrace = {
            x: dates,
            y: data.benchmark_values,
            type: 'scatter',
            mode: 'lines',
            name: 'Benchmark (SPY)',
            line: {
                color: '#6554C0', // Different color for benchmark
                width: 2,
                dash: 'dash' // Make it dashed to distinguish
            }
        };
        traces.push(benchmarkTrace);
    } else if (data.benchmark_in_portfolio) {
        // Add annotation that benchmark is part of portfolio
        // Will be handled in displayResults
    }
    
    const layout = {
        title: 'Portfolio Equity Curve',
        xaxis: {
            title: 'Date',
            tickfont: {
                family: 'Inter, sans-serif',
                size: 12,
                color: '#172B4D'
            }
        },
        yaxis: {
            title: 'Value ($)',
            tickformat: ',.2f',
            tickfont: {
                family: 'Inter, sans-serif',
                size: 12,
                color: '#172B4D'
            }
        },
        hovermode: 'closest',
        hoverlabel: {
            bgcolor: '#FFF',
            font: {
                family: 'Roboto Mono, monospace',
                size: 12,
                color: '#172B4D'
            },
            bordercolor: '#DFE1E6'
        },
        margin: {
            l: 60,
            r: 30,
            t: 60,
            b: 60
        },
        plot_bgcolor: '#FFF',
        paper_bgcolor: '#FFF',
        font: {
            family: 'Inter, sans-serif',
            size: 12,
            color: '#172B4D'
        },
        legend: {
            orientation: 'h',
            y: -0.15
        }
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        displaylogo: false
    };
    
    Plotly.newPlot(elementId, traces, layout, config);
}

/**
 * Create a drawdown chart using Plotly
 */
function createDrawdownChart(elementId, data) {
    const dates = data.dates;
    const drawdowns = data.drawdowns.map(d => d * 100); // Convert to percentage
    
    // Portfolio drawdown trace
    const portfolioTrace = {
        x: dates,
        y: drawdowns,
        type: 'scatter',
        mode: 'lines',
        name: 'Portfolio Drawdown',
        fill: 'tozeroy',
        line: {
            color: '#DE350B',
            width: 2
        }
    };
    
    // Array of traces, starting with portfolio
    const traces = [portfolioTrace];
    
    // Add benchmark trace if available
    if (data.benchmark_drawdowns) {
        const benchmarkDrawdowns = data.benchmark_drawdowns.map(d => d * 100); // Convert to percentage
        
        // Benchmark trace
        const benchmarkTrace = {
            x: dates,
            y: benchmarkDrawdowns,
            type: 'scatter',
            mode: 'lines',
            name: 'Benchmark Drawdown',
            line: {
                color: '#6554C0',
                width: 2,
                dash: 'dash'
            }
        };
        
        traces.push(benchmarkTrace);
    }
    
    const layout = {
        title: 'Portfolio Drawdown',
        xaxis: {
            title: 'Date',
            tickfont: {
                family: 'Inter, sans-serif',
                size: 12,
                color: '#172B4D'
            }
        },
        yaxis: {
            title: 'Drawdown (%)',
            tickformat: ',.1f',
            ticksuffix: '%',
            rangemode: 'tozero',
            tickfont: {
                family: 'Inter, sans-serif',
                size: 12,
                color: '#172B4D'
            }
        },
        hovermode: 'closest',
        hoverlabel: {
            bgcolor: '#FFF',
            font: {
                family: 'Roboto Mono, monospace',
                size: 12,
                color: '#172B4D'
            },
            bordercolor: '#DFE1E6'
        },
        margin: {
            l: 60,
            r: 30,
            t: 60,
            b: 60
        },
        plot_bgcolor: '#FFF',
        paper_bgcolor: '#FFF',
        font: {
            family: 'Inter, sans-serif',
            size: 12,
            color: '#172B4D'
        },
        legend: {
            orientation: 'h',
            y: -0.15
        }
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        displaylogo: false
    };
    
    Plotly.newPlot(elementId, traces, layout, config);
}

/**
 * Create an annual returns chart using Plotly
 */
function createAnnualReturnsChart(elementId, data) {
    // Extract annual returns data
    const annualReturnsData = data.annual_returns || {};
    const benchmarkAnnualReturnsData = data.benchmark_annual_returns || {};
    
    // Get years from portfolio and benchmark data
    const years = Object.keys(annualReturnsData).sort();
    
    // If no annual data is available, show a message
    if (years.length === 0) {
        document.getElementById(elementId).innerHTML = 
            '<div class="alert alert-info mt-4">Not enough data to calculate annual returns.</div>';
        return;
    }
    
    // Extract values for portfolio returns
    const annualReturns = years.map(year => annualReturnsData[year] * 100); // Convert to percentage
    
    // Create colors array for portfolio (green for positive, red for negative)
    const colors = annualReturns.map(value => 
        value >= 0 ? '#00875A' : '#DE350B'
    );
    
    // Portfolio return trace
    const portfolioTrace = {
        x: years,
        y: annualReturns,
        type: 'bar',
        name: 'Portfolio Return',
        marker: {
            color: colors
        }
    };
    
    // Array of traces, starting with portfolio
    const traces = [portfolioTrace];
    
    // Add benchmark trace if available
    if (Object.keys(benchmarkAnnualReturnsData).length > 0) {
        // Extract benchmark returns for the same years
        const benchmarkReturns = years.map(year => {
            return benchmarkAnnualReturnsData[year] ? benchmarkAnnualReturnsData[year] * 100 : null;
        });
        
        // Benchmark trace
        const benchmarkTrace = {
            x: years,
            y: benchmarkReturns,
            type: 'bar',
            name: 'Benchmark (SPY)',
            marker: {
                color: '#6554C0'
            },
            opacity: 0.7
        };
        
        traces.push(benchmarkTrace);
    }
    
    const layout = {
        title: 'Annual Returns',
        xaxis: {
            title: 'Year',
            tickmode: 'array',
            tickvals: years,
            tickfont: {
                family: 'Inter, sans-serif',
                size: 12,
                color: '#172B4D'
            }
        },
        yaxis: {
            title: 'Return (%)',
            tickformat: ',.1f',
            ticksuffix: '%',
            tickfont: {
                family: 'Inter, sans-serif',
                size: 12,
                color: '#172B4D'
            }
        },
        hovermode: 'closest',
        hoverlabel: {
            bgcolor: '#FFF',
            font: {
                family: 'Roboto Mono, monospace',
                size: 12,
                color: '#172B4D'
            },
            bordercolor: '#DFE1E6'
        },
        margin: {
            l: 60,
            r: 30,
            t: 60,
            b: 60
        },
        plot_bgcolor: '#FFF',
        paper_bgcolor: '#FFF',
        font: {
            family: 'Inter, sans-serif',
            size: 12,
            color: '#172B4D'
        },
        barmode: 'group',
        legend: {
            orientation: 'h',
            y: -0.15
        }
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        displaylogo: false
    };
    
    Plotly.newPlot(elementId, traces, layout, config);
}
