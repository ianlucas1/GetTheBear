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
    
    const trace = {
        x: dates,
        y: drawdowns,
        type: 'scatter',
        mode: 'lines',
        name: 'Drawdown',
        fill: 'tozeroy',
        line: {
            color: '#DE350B',
            width: 2
        }
    };
    
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
        }
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        displaylogo: false
    };
    
    Plotly.newPlot(elementId, [trace], layout, config);
}

/**
 * Create a monthly returns chart using Plotly
 */
function createMonthlyReturnsChart(elementId, data) {
    const dates = data.dates;
    const monthlyReturns = data.monthly_returns.map(r => r * 100); // Convert to percentage
    
    // Create colors array (green for positive, red for negative)
    const colors = monthlyReturns.map(value => 
        value >= 0 ? '#00875A' : '#DE350B'
    );
    
    const trace = {
        x: dates,
        y: monthlyReturns,
        type: 'bar',
        name: 'Monthly Return',
        marker: {
            color: colors
        }
    };
    
    const layout = {
        title: 'Monthly Returns',
        xaxis: {
            title: 'Date',
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
        }
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        displaylogo: false
    };
    
    Plotly.newPlot(elementId, [trace], layout, config);
}
