/**
 * Get the Bear - Portfolio Analysis Tool
 * Charts JavaScript File
 */

/**
 * Create correlation heatmap using Plotly
 */
function createCorrelationChart(elementId, correlationData) {
    // Extract tickers and matrix data
    const tickers = correlationData.tickers;
    const matrixValues = correlationData.matrix;
    const textLabels = correlationData.labels || matrixValues; // Use provided labels or fall back to matrix values
    
    // Define a color scale: blue for negative, white for zero, red for positive correlations
    const colorScale = [
        [0, '#4169E1'],        // Royal Blue for strong negative correlation
        [0.25, '#B6D0E5'],     // Light blue for weak negative correlation
        [0.5, '#FFFFFF'],      // White for no correlation
        [0.75, '#FFCCCB'],     // Light red for weak positive correlation
        [1, '#FF0000']         // Bright red for strong positive correlation
    ];
    
    // Create text array with formatted labels and determine font colors
    const text = textLabels.map(row => 
        row.map(val => val.toFixed(2))
    );
    
    // Set font color based on correlation value
    // Dark values for light backgrounds, light values for dark backgrounds
    const fontColors = textLabels.map(row => 
        row.map(val => {
            const absVal = Math.abs(val);
            if (absVal > 0.7) {
                // Strong correlation (positive or negative) - use white text
                return '#FFFFFF';
            } else {
                // Weaker correlation - use dark text
                return '#172B4D';
            }
        })
    );
    
    // Create the heatmap trace
    const trace = {
        z: matrixValues,
        x: tickers,
        y: tickers,
        type: 'heatmap',
        colorscale: colorScale,
        zmin: -1,              // Minimum correlation value
        zmax: 1,               // Maximum correlation value
        showscale: true,
        colorbar: {
            title: 'Correlation',
            titleside: 'right',
            titlefont: {
                size: 14,
                family: "'Open Sans', 'Helvetica Neue', Helvetica, sans-serif"
            }
        },
        // Add text labels to cells
        text: text,
        texttemplate: '%{text}',
        textfont: {
            color: fontColors,
            family: "'Roboto Mono', monospace",
            size: 10
        },
        // Format the hover text to show exact correlation values
        hovertemplate: '%{y} ↔ %{x}: %{z:.2f}<extra></extra>'
    };
    
    // Layout configuration for the heatmap
    const layout = {
        title: {
            text: 'Returns Correlation Matrix',
            font: {
                family: "'Open Sans', 'Helvetica Neue', Helvetica, sans-serif",
                size: 18
            }
        },
        autosize: true,
        height: 500,
        margin: {
            l: 80,
            r: 30,
            b: 80,
            t: 80,
            pad: 5
        },
        xaxis: {
            title: '',
            titlefont: {
                family: "'Open Sans', 'Helvetica Neue', Helvetica, sans-serif",
                size: 14
            },
            tickfont: {
                family: "'Open Sans', 'Helvetica Neue', Helvetica, sans-serif",
                size: 12
            },
            tickangle: -45
        },
        yaxis: {
            title: '',
            titlefont: {
                family: "'Open Sans', 'Helvetica Neue', Helvetica, sans-serif",
                size: 14
            },
            tickfont: {
                family: "'Open Sans', 'Helvetica Neue', Helvetica, sans-serif",
                size: 12
            }
        },
        // Add annotation explaining the heatmap
        annotations: [
            {
                x: 0.5,
                y: -0.15,
                xref: 'paper',
                yref: 'paper',
                text: 'This heatmap shows the correlation between monthly returns of all assets in the portfolio.',
                showarrow: false,
                font: {
                    family: "'Open Sans', 'Helvetica Neue', Helvetica, sans-serif",
                    size: 12
                }
            },
            {
                x: 0.5,
                y: -0.2,
                xref: 'paper',
                yref: 'paper',
                text: 'Red = positive correlation (move together), Blue = negative correlation (move oppositely).',
                showarrow: false,
                font: {
                    family: "'Open Sans', 'Helvetica Neue', Helvetica, sans-serif",
                    size: 12
                }
            }
        ]
    };
    
    // Create the heatmap
    Plotly.newPlot(elementId, [trace], layout, {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        displaylogo: false,
        toImageButtonOptions: {
            format: 'png',
            filename: 'correlation_heatmap',
            height: 500,
            width: 700,
            scale: 1
        }
    });
}

/**
 * Create allocation pie chart using Plotly
 */
function createAllocationChart(elementId, legendId, tickers, weights) {
    // Generate a beautiful palette of colors with better visual distinction
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
    
    // Calculate percentage values for the hover text
    const percentValues = weights.map(w => (w * 100).toFixed(2) + '%');
    
    // Format weights as percentages for display (with plus sign for positive values)
    const formattedWeights = weights.map(w => {
        const value = (w * 100).toFixed(1);
        return value + '%';
    });
    
    // Create hover text with both ticker name and percentage
    const hoverTexts = tickers.map((ticker, index) => {
        return `${ticker}: ${percentValues[index]}`;
    });
    
    // Create the pie chart trace with enhanced styling
    const trace = {
        type: 'pie',
        labels: tickers,
        values: weights,
        text: hoverTexts,
        textinfo: 'label+percent',
        textposition: 'auto',
        insidetextfont: {
            family: 'Inter, sans-serif',
            size: 12,
            color: '#FFFFFF'
        },
        outsidetextfont: {
            family: 'Inter, sans-serif',
            size: 12,
            color: '#172B4D'
        },
        automargin: true,
        marker: {
            colors: colors,
            line: {
                color: '#FFFFFF',
                width: 2.5  // Slightly thicker border for better definition
            },
            pattern: {
                shape: ''  // No pattern
            }
        },
        hoverinfo: 'text',
        hovertemplate: '<b>%{label}</b><br>%{percent}<extra></extra>',  // Enhanced tooltip
        hoverlabel: {
            bgcolor: 'rgba(255, 255, 255, 0.9)',
            font: {
                family: 'Roboto Mono, monospace',
                size: 12,
                color: '#172B4D'
            },
            bordercolor: '#DFE1E6',
            borderwidth: 1
        },
        hole: 0.4  // Create a donut chart for more modern look
    };
    
    const layout = {
        title: {
            text: 'Portfolio Allocation',
            font: {
                family: 'Inter, sans-serif',
                size: 20,
                color: '#172B4D'
            },
            xref: 'paper',
            x: 0.5,  // Center the title
            y: 0.97,
            pad: {t: 10}
        },
        height: 500,
        showlegend: false,  // We'll use custom legend
        margin: {
            l: 10,
            r: 10,
            t: 70,
            b: 10
        },
        plot_bgcolor: '#FFF',
        paper_bgcolor: '#FFF',
        font: {
            family: 'Inter, sans-serif',
            size: 12,
            color: '#172B4D'
        },
        annotations: [{
            text: 'Asset<br>Allocation',
            showarrow: false,
            font: {
                family: 'Inter, sans-serif',
                size: 14,
                color: '#172B4D'
            }
        }]
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
        displaylogo: false,
        toImageButtonOptions: {
            format: 'png',
            filename: 'portfolio_allocation',
            height: 600,
            width: 800,
            scale: 2
        }
    };
    
    Plotly.newPlot(elementId, [trace], layout, config);
    
    // Create enhanced custom legend with weights
    const legendContainer = document.getElementById(legendId);
    if (legendContainer) {
        legendContainer.innerHTML = ''; // Clear existing content
        
        // Create a more structured and attractive legend
        const legendGrid = document.createElement('div');
        legendGrid.className = 'allocation-legend-grid';
        legendGrid.style.display = 'grid';
        legendGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(180px, 1fr))';
        legendGrid.style.gap = '12px';
        legendGrid.style.width = '100%';
        legendGrid.style.marginTop = '20px';
        
        tickers.forEach((ticker, index) => {
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            legendItem.style.display = 'flex';
            legendItem.style.alignItems = 'center';
            legendItem.style.padding = '8px 12px';
            legendItem.style.backgroundColor = 'rgba(244, 245, 247, 0.5)';
            legendItem.style.borderRadius = '6px';
            legendItem.style.border = '1px solid #DFE1E6';
            legendItem.style.transition = 'all 0.2s ease';
            
            // Add hover effect
            legendItem.onmouseover = function() {
                this.style.backgroundColor = 'rgba(244, 245, 247, 0.9)';
                this.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.1)';
            };
            legendItem.onmouseout = function() {
                this.style.backgroundColor = 'rgba(244, 245, 247, 0.5)';
                this.style.boxShadow = 'none';
            };
            
            const colorBox = document.createElement('span');
            colorBox.className = 'legend-color';
            colorBox.style.width = '16px';
            colorBox.style.height = '16px';
            colorBox.style.borderRadius = '4px';
            colorBox.style.marginRight = '8px';
            colorBox.style.backgroundColor = colors[index % colors.length];
            colorBox.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
            
            const tickerSpan = document.createElement('span');
            tickerSpan.className = 'legend-ticker';
            tickerSpan.style.fontWeight = '600';
            tickerSpan.style.marginRight = '8px';
            tickerSpan.style.color = '#172B4D';
            tickerSpan.textContent = ticker;
            
            const weightSpan = document.createElement('span');
            weightSpan.className = 'legend-weight';
            weightSpan.style.marginLeft = 'auto';
            weightSpan.style.fontFamily = 'Roboto Mono, monospace';
            weightSpan.style.color = '#5E6C84';
            weightSpan.style.fontSize = '14px';
            weightSpan.textContent = formattedWeights[index];
            
            legendItem.appendChild(colorBox);
            legendItem.appendChild(tickerSpan);
            legendItem.appendChild(weightSpan);
            
            legendGrid.appendChild(legendItem);
        });
        
        legendContainer.appendChild(legendGrid);
    }
}

/**
 * Create an equity curve chart using Plotly
 */
function createEquityCurveChart(elementId, data) {
    const dates = data.dates;
    const portfolioValues = data.portfolio_values;
    
    // Portfolio trace with enhanced styling
    const portfolioTrace = {
        x: dates,
        y: portfolioValues,
        type: 'scatter',
        mode: 'lines+markers',  // Add markers to show data points
        name: 'Portfolio Value',
        line: {
            color: '#0052CC',
            width: 3,  // Thicker line for better visibility
            shape: 'spline'  // Smoother curve
        },
        marker: {
            size: 6,  // Marker size
            color: '#0052CC',
            line: {
                color: '#FFF',
                width: 1
            },
            symbol: 'circle',
            opacity: 0.8
        },
        hoverinfo: 'x+y+name',
        hovertemplate: '<b>%{y:.2f}</b> on %{x|%b %d, %Y}<extra>Portfolio</extra>'  // Enhanced tooltip
    };
    
    // Array of traces, starting with portfolio
    const traces = [portfolioTrace];
    
    // Add benchmark trace if available with enhanced styling
    if (data.benchmark_values) {
        // Get the benchmark ticker name
        const benchmarkTicker = data.benchmark_ticker || 'SPY';
        
        // Separate benchmark data
        const benchmarkTrace = {
            x: dates,
            y: data.benchmark_values,
            type: 'scatter',
            mode: 'lines+markers',  // Add markers for data points
            name: `Benchmark (${benchmarkTicker})`,
            line: {
                color: '#00875A', // Green/teal for better contrast
                width: 2.5,
                dash: 'dot', // Dotted line to distinguish
                shape: 'spline'  // Smoother curve
            },
            marker: {
                size: 5,  // Slightly smaller markers
                color: '#00875A',
                line: {
                    color: '#FFF',
                    width: 1
                },
                symbol: 'diamond',
                opacity: 0.7
            },
            hoverinfo: 'x+y+name',
            hovertemplate: '<b>%{y:.2f}</b> on %{x|%b %d, %Y}<extra>' + benchmarkTicker + '</extra>'  // Enhanced tooltip
        };
        traces.push(benchmarkTrace);
    } else if (data.benchmark_in_portfolio) {
        // Add annotation that benchmark is part of portfolio
        // Will be handled in displayResults
    }
    
    const layout = {
        title: {
            text: 'Portfolio Equity Curve',
            font: {
                family: 'Inter, sans-serif',
                size: 20,
                color: '#172B4D'
            },
            xref: 'paper',
            x: 0.5,  // Center the title
            y: 0.97,
            pad: {t: 10}
        },
        xaxis: {
            title: {
                text: 'Date',
                font: {
                    family: 'Inter, sans-serif',
                    size: 14,
                    color: '#172B4D'
                }
            },
            tickfont: {
                family: 'Inter, sans-serif',
                size: 12,
                color: '#172B4D'
            },
            showgrid: true,
            gridcolor: 'rgba(233, 236, 239, 0.7)',  // Lighter grid for better readability
            zeroline: false
        },
        yaxis: {
            title: {
                text: 'Value ($)',
                font: {
                    family: 'Inter, sans-serif',
                    size: 14,
                    color: '#172B4D'
                }
            },
            tickformat: ',.2f',
            tickfont: {
                family: 'Inter, sans-serif',
                size: 12,
                color: '#172B4D'
            },
            showgrid: true,
            gridcolor: 'rgba(233, 236, 239, 0.7)',  // Lighter grid for better readability
            zeroline: true,
            zerolinecolor: '#DFE1E6',
            zerolinewidth: 1
        },
        hovermode: 'closest',
        hoverlabel: {
            bgcolor: 'rgba(255, 255, 255, 0.9)',
            font: {
                family: 'Roboto Mono, monospace',
                size: 12,
                color: '#172B4D'
            },
            bordercolor: '#DFE1E6',
            borderwidth: 1
        },
        margin: {
            l: 65,
            r: 35,
            t: 70,
            b: 65
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
            xanchor: 'center',
            y: -0.15,
            x: 0.5,
            bgcolor: 'rgba(255, 255, 255, 0.7)',
            bordercolor: '#DFE1E6',
            borderwidth: 1,
            font: {
                family: 'Inter, sans-serif',
                size: 12,
                color: '#172B4D'
            }
        }
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
        displaylogo: false,
        toImageButtonOptions: {
            format: 'png',
            filename: 'portfolio_equity_curve',
            height: 600,
            width: 1000,
            scale: 2
        }
    };
    
    Plotly.newPlot(elementId, traces, layout, config);
}

/**
 * Create a drawdown chart using Plotly
 */
function createDrawdownChart(elementId, data) {
    const dates = data.dates;
    const drawdowns = data.drawdowns.map(d => d * 100); // Convert to percentage
    
    // Portfolio drawdown trace with enhanced styling
    const portfolioTrace = {
        x: dates,
        y: drawdowns,
        type: 'scatter',
        mode: 'lines+markers',  // Add markers for significant drawdown points
        name: 'Portfolio Drawdown',
        fill: 'tozeroy',
        fillcolor: 'rgba(222, 53, 11, 0.15)', // Transparent red fill
        line: {
            color: '#DE350B',
            width: 3,
            shape: 'spline'  // Smoother curve
        },
        marker: {
            size: 4,  // Smaller markers for drawdowns (less cluttered)
            color: '#DE350B',
            line: {
                color: '#FFF',
                width: 1
            },
            symbol: 'circle',
            opacity: function() {
                // Only show markers on significant drawdowns
                return drawdowns.map(d => Math.abs(d) > 5 ? 1 : 0);
            }()
        },
        hoverinfo: 'x+y+name',
        hovertemplate: '<b>%{y:.2f}%</b> on %{x|%b %d, %Y}<extra>Portfolio Drawdown</extra>'  // Enhanced tooltip
    };
    
    // Array of traces, starting with portfolio
    const traces = [portfolioTrace];
    
    // Add benchmark trace if available with enhanced styling
    if (data.benchmark_drawdowns) {
        const benchmarkDrawdowns = data.benchmark_drawdowns.map(d => d * 100); // Convert to percentage
        
        // Get the benchmark ticker name
        const benchmarkTicker = data.benchmark_ticker || 'SPY';
        
        // Benchmark trace with enhanced styling
        const benchmarkTrace = {
            x: dates,
            y: benchmarkDrawdowns,
            type: 'scatter',
            mode: 'lines',  // Lines only for benchmark to reduce visual clutter
            name: `${benchmarkTicker} Drawdown`,
            line: {
                color: '#6554C0',
                width: 2.5,
                dash: 'dot',
                shape: 'spline'  // Smoother curve
            },
            hoverinfo: 'x+y+name',
            hovertemplate: '<b>%{y:.2f}%</b> on %{x|%b %d, %Y}<extra>' + benchmarkTicker + ' Drawdown</extra>'  // Enhanced tooltip
        };
        
        traces.push(benchmarkTrace);
    }
    
    const layout = {
        title: {
            text: 'Portfolio Drawdown',
            font: {
                family: 'Inter, sans-serif',
                size: 20,
                color: '#172B4D'
            },
            xref: 'paper',
            x: 0.5,  // Center the title
            y: 0.97,
            pad: {t: 10}
        },
        xaxis: {
            title: {
                text: 'Date',
                font: {
                    family: 'Inter, sans-serif',
                    size: 14,
                    color: '#172B4D'
                }
            },
            tickfont: {
                family: 'Inter, sans-serif',
                size: 12,
                color: '#172B4D'
            },
            showgrid: true,
            gridcolor: 'rgba(233, 236, 239, 0.7)',  // Lighter grid for better readability
            zeroline: false
        },
        yaxis: {
            title: {
                text: 'Drawdown (%)',
                font: {
                    family: 'Inter, sans-serif',
                    size: 14,
                    color: '#172B4D'
                }
            },
            tickformat: ',.1f',
            ticksuffix: '%',
            rangemode: 'tozero',  // Start at zero
            tickfont: {
                family: 'Inter, sans-serif',
                size: 12,
                color: '#172B4D'
            },
            showgrid: true,
            gridcolor: 'rgba(233, 236, 239, 0.7)',  // Lighter grid for better readability
            zeroline: true,
            zerolinecolor: '#DFE1E6',
            zerolinewidth: 1
        },
        hovermode: 'closest',
        hoverlabel: {
            bgcolor: 'rgba(255, 255, 255, 0.9)',
            font: {
                family: 'Roboto Mono, monospace',
                size: 12,
                color: '#172B4D'
            },
            bordercolor: '#DFE1E6',
            borderwidth: 1
        },
        margin: {
            l: 65,
            r: 35,
            t: 70,
            b: 65
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
            xanchor: 'center',
            y: -0.15,
            x: 0.5,
            bgcolor: 'rgba(255, 255, 255, 0.7)',
            bordercolor: '#DFE1E6',
            borderwidth: 1,
            font: {
                family: 'Inter, sans-serif',
                size: 12,
                color: '#172B4D'
            }
        },
        shapes: [{
            type: 'line',
            xref: 'paper',
            yref: 'y',
            x0: 0,
            y0: 0,
            x1: 1,
            y1: 0,
            line: {
                color: 'rgba(66, 66, 66, 0.3)',
                width: 1.5,
                dash: 'dot'
            }
        }]
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
        displaylogo: false,
        toImageButtonOptions: {
            format: 'png',
            filename: 'portfolio_drawdown',
            height: 600,
            width: 1000,
            scale: 2
        }
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
    
    // Create text values for hover labels with formatted percentages
    const hoverTexts = annualReturns.map(value => 
        `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
    );
    
    // Portfolio return trace with enhanced styling
    const portfolioTrace = {
        x: years,
        y: annualReturns,
        type: 'bar',
        name: 'Portfolio Return',
        text: hoverTexts,
        textposition: 'auto',
        hoverinfo: 'x+text+name',
        hovertemplate: '<b>%{text}</b> in %{x}<extra>Portfolio</extra>',
        marker: {
            color: colors,
            line: {
                color: '#FFFFFF',
                width: 1.5
            },
            opacity: 0.9
        }
    };
    
    // Array of traces, starting with portfolio
    const traces = [portfolioTrace];
    
    // Add benchmark trace if available with enhanced styling
    if (Object.keys(benchmarkAnnualReturnsData).length > 0) {
        // Extract benchmark returns for the same years
        const benchmarkReturns = years.map(year => {
            return benchmarkAnnualReturnsData[year] ? benchmarkAnnualReturnsData[year] * 100 : null;
        });
        
        // Create text values for hover labels with formatted percentages
        const benchmarkHoverTexts = benchmarkReturns.map(value => 
            value !== null ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}%` : 'N/A'
        );
        
        // Get the benchmark ticker name
        const benchmarkTicker = data.benchmark_ticker || 'SPY';
        
        // Benchmark trace with enhanced styling
        const benchmarkTrace = {
            x: years,
            y: benchmarkReturns,
            type: 'bar',
            name: `Benchmark (${benchmarkTicker})`,
            text: benchmarkHoverTexts,
            textposition: 'auto',
            hoverinfo: 'x+text+name',
            hovertemplate: '<b>%{text}</b> in %{x}<extra>' + benchmarkTicker + '</extra>',
            marker: {
                color: '#6554C0',
                line: {
                    color: '#FFFFFF',
                    width: 1
                },
                opacity: 0.7
            }
        };
        
        traces.push(benchmarkTrace);
    }
    
    const layout = {
        title: {
            text: 'Annual Returns',
            font: {
                family: 'Inter, sans-serif',
                size: 20,
                color: '#172B4D'
            },
            xref: 'paper',
            x: 0.5,  // Center the title
            y: 0.97,
            pad: {t: 10}
        },
        xaxis: {
            title: {
                text: 'Year',
                font: {
                    family: 'Inter, sans-serif',
                    size: 14,
                    color: '#172B4D'
                }
            },
            tickmode: 'array',
            tickvals: years,
            tickfont: {
                family: 'Inter, sans-serif',
                size: 12,
                color: '#172B4D'
            },
            showgrid: false
        },
        yaxis: {
            title: {
                text: 'Return (%)',
                font: {
                    family: 'Inter, sans-serif',
                    size: 14,
                    color: '#172B4D'
                }
            },
            tickformat: '+,.1f',  // Show plus sign for positive values
            ticksuffix: '%',
            tickfont: {
                family: 'Inter, sans-serif',
                size: 12,
                color: '#172B4D'
            },
            showgrid: true,
            gridcolor: 'rgba(233, 236, 239, 0.7)',  // Lighter grid for better readability
            zeroline: true,
            zerolinecolor: '#DFE1E6',
            zerolinewidth: 2
        },
        hovermode: 'closest',
        hoverlabel: {
            bgcolor: 'rgba(255, 255, 255, 0.9)',
            font: {
                family: 'Roboto Mono, monospace',
                size: 12,
                color: '#172B4D'
            },
            bordercolor: '#DFE1E6',
            borderwidth: 1
        },
        margin: {
            l: 65,
            r: 35,
            t: 70,
            b: 65
        },
        plot_bgcolor: '#FFF',
        paper_bgcolor: '#FFF',
        font: {
            family: 'Inter, sans-serif',
            size: 12,
            color: '#172B4D'
        },
        barmode: 'group',
        bargap: 0.15,
        bargroupgap: 0.1,
        legend: {
            orientation: 'h',
            xanchor: 'center',
            y: -0.15,
            x: 0.5,
            bgcolor: 'rgba(255, 255, 255, 0.7)',
            bordercolor: '#DFE1E6',
            borderwidth: 1,
            font: {
                family: 'Inter, sans-serif',
                size: 12,
                color: '#172B4D'
            }
        },
        shapes: [{
            type: 'line',
            xref: 'paper',
            yref: 'y',
            x0: 0,
            y0: 0,
            x1: 1,
            y1: 0,
            line: {
                color: 'rgba(66, 66, 66, 0.3)',
                width: 1.5,
                dash: 'dot'
            }
        }]
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
        displaylogo: false,
        toImageButtonOptions: {
            format: 'png',
            filename: 'annual_returns',
            height: 600,
            width: 1000,
            scale: 2
        }
    };
    
    Plotly.newPlot(elementId, traces, layout, config);
}
