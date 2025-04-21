/*  static/js/modules/charts/correlation.js
    Correlation‑matrix heat‑map (Chart.js v4 + custom matrix controller)  */

// Import the chart rendering utility
import { renderChart } from '../utils/chartUtils.js';
// Import ChartModule to check for matrix controller registration
import { ChartModule } from '../../charts.js';

/**
 * Render a correlation heat‑map.
 *
 * @param {string}  containerId  <div id="…"> that will host the chart
 * @param {{ tickers:string[], matrix:number[][] }} correlationData
 */
export async function createCorrelationChart(containerId, correlationData) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Correlation chart container '${containerId}' not found.`);
        return;
    }

    /* ── sanity checks ─────────────────────────────────────────────── */
    if (
        !correlationData?.tickers?.length ||
        !correlationData?.matrix?.length  ||
        correlationData.tickers.length !== correlationData.matrix.length ||
        correlationData.tickers.length < 2 // Need at least 2 tickers for correlation
    ) {
        container.innerHTML =
            '<div class="chart-error">Insufficient or invalid correlation data (requires at least 2 tickers).</div>';
        return;
    }

    // Check if MatrixController is registered BEFORE trying to render
    const Chart = await ChartModule;
    if (!Chart || !Chart.registry.getController('matrix')) {
        console.error("Matrix controller not registered. Cannot create correlation chart.");
        container.innerHTML = '<div class="chart-error">Matrix chart controller not available.</div>';
        return;
    }

    const tickers = correlationData.tickers;
    const matrix  = correlationData.matrix;
    const size    = tickers.length;

    /* ── flatten matrix to {x,y,v} list (matrix controller format) ── */
    const points = [];
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            points.push({ 
                x: x,               // Use integer index
                y: y,               // Use integer index
                v: matrix[y][x],    // The correlation value
                xLabel: tickers[x], // Keep ticker name as label for tooltip
                yLabel: tickers[y]  // Keep ticker name as label for tooltip
            });
        }
    }

    /* colour helper (blue ↔ white ↔ red) ──────────────────────────── */
    const cellColor = (context) => {
        const value = context.raw?.v ?? 0; // Default to 0 if raw or v is undefined
        const alpha = Math.min(Math.abs(value) * 0.8, 1.0); // Slightly stronger alpha, capped at 1
        return value < 0
            ? `rgba(0, 0, 255, ${alpha})`   // Blue for negative
            : `rgba(255, 0, 0, ${alpha})`; // Red for positive
    };

    /* ── matrix value labels plug‑in ───────────────────────────────── */
    const correlationLabelsPlugin = {
        id: 'correlationLabels',
        afterDatasetDraw(chart) {
            const ctx = chart.ctx;
            ctx.save();
            // Dynamic font size based on cell size?
            const cellWidth = (chart.chartArea?.width ?? 0) / size;
            const fontSize = Math.max(8, Math.min(10, cellWidth / 3)); // Adjust font size based on cell width
            ctx.font = `${fontSize}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const dataset = chart.data.datasets[0];
            const data = dataset.data || [];
            const xScale = chart.scales.x;
            const yScale = chart.scales.y;
            
            if (!xScale || !yScale) {
                 ctx.restore(); 
                 return;
            }
            
            data.forEach(point => {
                const xPixel = xScale.getPixelForValue(point.x);
                const yPixel = yScale.getPixelForValue(point.y);
                const value = point.v;
                
                // Adjust color based on background for better contrast
                ctx.fillStyle = Math.abs(value) >= 0.65 ? '#fff' : '#000'; 
                ctx.fillText(value.toFixed(2), xPixel, yPixel);
            });
            
            ctx.restore();
        }
    };

    /* ── build chart config ───────────────────────────────────────── */
    const chartConfig = {
        type : 'matrix',
        data : {
            // labels: tickers, // Not directly used by matrix data, but can be useful
            datasets: [
                {
                    label           : 'Correlation',
                    data            : points,         // Use the {x,y,v} data points
                    backgroundColor : cellColor,
                    borderColor     : 'rgba(0,0,0,0.1)', // Slightly darker border
                    borderWidth     : 1,
                    // Calculate width/height based on chart area
                    width           : ({ chart }) => (chart.chartArea?.width ?? 0) / size - 1,
                    height          : ({ chart }) => (chart.chartArea?.height ?? 0) / size - 1,
                }
            ]
        },
        options : {
            responsive          : true,
            maintainAspectRatio : false,
            plugins : {
                title : {
                    display : true,
                    text    : 'Correlation Matrix', // Consistent casing
                    font    : { size: 16 }
                },
                tooltip : {
                    callbacks : {
                        title : (tooltipItems) => {
                            // Ensure tooltipItems is not empty and has raw data
                            const item = tooltipItems[0]?.raw;
                            return item ? `${item.yLabel} vs ${item.xLabel}` : 'Correlation';
                        },
                        label : (tooltipItem) => {
                            // Ensure tooltipItem has raw data
                            const value = tooltipItem.raw?.v;
                            return typeof value === 'number' ? `Correlation: ${value.toFixed(3)}` : 'N/A'; // More precision
                        }
                    }
                },
                legend : { display: false } // Matrix usually doesn't need a legend
            },
            scales : {
                x : {
                    type      : 'category', // Use category scale for integer indices
                    labels    : tickers,    // Provide labels for the axis ticks
                    offset    : false,      // Align cells directly with ticks
                    position  : 'bottom',    // Standard position
                    ticks     : { padding: 5 },
                    grid      : { display: false }
                },
                y : {
                    type      : 'category',
                    labels    : tickers,
                    offset    : false,
                    position  : 'left', // Standard position
                    reverse   : true,    // Often preferred for matrix (0,0 at top-left)
                    ticks     : { padding: 5 },
                    grid      : { display: false }
                }
            },
            // Ensure layout padding allows labels to be fully visible
            layout: {
                padding: {
                    top: 10, bottom: 10, left: 10, right: 10
                }
            }
        },
        plugins : [correlationLabelsPlugin] // Register the custom plugin
    };

    /* ── render chart using utility ──────────────────────────────── */
    await renderChart(containerId, chartConfig, 'Correlation Matrix Chart');
}
  