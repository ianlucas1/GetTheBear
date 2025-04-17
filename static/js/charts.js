/**
 * Get the Bear - Portfolio Analysis Tool
 * Charts JavaScript File
 */

/**
 * Create allocation pie chart using Plotly
 */
function createAllocationChart(elementId, legendId, tickers, weights) {
    // Generate a palette of colors for the different tickers
    const colors = [
        '#0052CC', // Primary blue
        '#00875A', // Green
        '#6554C0', // Purple
        '#FF5630', // Red
        '#FFAB00', // Yellow
        '#36B37E', // Teal
        '#00B8D9', // Cyan
        '#6B778C', // Grey
        '#8777D9', // Light purple
        '#4C9AFF', // Light blue
        '#79E2F2', // Light cyan
        '#67AB9F', // Light teal
        '#7A869A', // Medium grey
        '#998DD9', // Medium purple
        '#C1C7D0', // Light grey
    ];
    
    // Ensure we have enough colors by repeating the palette if needed
    while (colors.length < tickers.length) {
        colors.push(...colors);
    }
    
    // Format weights as percentages for display
    const formattedWeights = weights.map(w => (w * 100).toFixed(1) + '%');
    
    // Create the pie chart trace
    const trace = {
        type: 'pie',
        labels: tickers,
        values: weights,
        textinfo: 'label+percent',
        textposition: 'inside',
        automargin: true,
        marker: {
            colors: colors,
            line: {
                color: '#FFFFFF',
                width: 2
            }
        },
        hoverinfo: 'label+percent+value',
        hoverlabel: {
            bgcolor: '#FFF',
            font: {
                family: 'Roboto Mono, monospace',
                size: 12,
                color: '#172B4D'
            },
            bordercolor: '#DFE1E6'
        }
    };
    
    const layout = {
        title: 'Portfolio Allocation',
        height: 500,
        showlegend: false,
        margin: {
            l: 0,
            r: 0,
            t: 50,
            b: 0
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
    
    // Create custom legend with weights
    const legendContainer = document.getElementById(legendId);
    if (legendContainer) {
        legendContainer.innerHTML = ''; // Clear existing content
        
        tickers.forEach((ticker, index) => {
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            
            const colorBox = document.createElement('span');
            colorBox.className = 'legend-color';
            colorBox.style.backgroundColor = colors[index % colors.length];
            
            const tickerSpan = document.createElement('span');
            tickerSpan.className = 'legend-ticker';
            tickerSpan.textContent = ticker;
            
            const weightSpan = document.createElement('span');
            weightSpan.className = 'legend-weight';
            weightSpan.textContent = formattedWeights[index];
            
            legendItem.appendChild(colorBox);
            legendItem.appendChild(tickerSpan);
            legendItem.appendChild(weightSpan);
            
            legendContainer.appendChild(legendItem);
        });
    }
}

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
        // Get the benchmark ticker name
        const benchmarkTicker = data.benchmark_ticker || 'SPY';
        
        // Separate benchmark data
        const benchmarkTrace = {
            x: dates,
            y: data.benchmark_values,
            type: 'scatter',
            mode: 'lines',
            name: `Benchmark (${benchmarkTicker})`,
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
        
        // Get the benchmark ticker name
        const benchmarkTicker = data.benchmark_ticker || 'SPY';
        
        // Benchmark trace
        const benchmarkTrace = {
            x: dates,
            y: benchmarkDrawdowns,
            type: 'scatter',
            mode: 'lines',
            name: `${benchmarkTicker} Drawdown`,
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
        
        // Get the benchmark ticker name
        const benchmarkTicker = data.benchmark_ticker || 'SPY';
        
        // Benchmark trace
        const benchmarkTrace = {
            x: years,
            y: benchmarkReturns,
            type: 'bar',
            name: `Benchmark (${benchmarkTicker})`,
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
