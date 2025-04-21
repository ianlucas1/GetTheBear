/**
 * Equity‑curve chart module
 * Uses the global `Chart` object provided by
 *   <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js">
 */

// Import the registration helper
import { ensureChartComponentsRegistered } from './index.js';
import { ChartModule } from '../../charts.js';

// Import the chart rendering utility
import { renderChart } from '../utils/chartUtils.js';

/* ------------------------------------------------------------------ */
/* 2 ▸ public API                                                     */
/* ------------------------------------------------------------------ */

/**
 * Render the equity‑curve chart.
 * @param {string}  containerId  id of the wrapper <div>
 * @param {Object}  chartData    pre‑formatted payload from the backend, containing dates, portfolio_values, etc.
 */
export async function createEquityCurveChart (containerId, chartData = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Equity Curve chart container '${containerId}' not found.`);
        return;
    }

    /* ── guards & data extraction ─────────────────────────────────── */
    const dates            = chartData.dates            || [];
    const portfolioValues  = chartData.portfolio_values || [];
    const benchmarkValues  = chartData.benchmark_values || [];

    if (!dates.length || !portfolioValues.length || dates.length !== portfolioValues.length) {
        container.innerHTML =
            '<div class="chart-error">Insufficient or mismatched data for equity curve chart.</div>';
        return;
    }

    /* ------- Compose Datasets ------------------------------------- */
    const datasets = [
        {
            label           : 'Portfolio',
            data            : portfolioValues,
            backgroundColor : 'rgba(75, 192, 192, 0.15)',
            borderColor     : 'rgba(75, 192, 192, 1)',
            borderWidth     : 2,
            pointRadius     : 0,
            pointHitRadius  : 10,
            tension         : 0.15,
            fill            : 'origin', // Fill from origin
            spanGaps        : false
        }
    ];

    // Check if benchmark data exists and should be displayed
    const hasBench = benchmarkValues.length > 0 && 
                     dates.length === benchmarkValues.length && // Ensure lengths match
                     chartData.benchmark_in_portfolio !== true;

    if (hasBench) {
        console.log("Adding benchmark to equity curve chart - ticker:", chartData.benchmark_ticker);
        datasets.push({
            label           : `Benchmark (${chartData.benchmark_ticker || 'Benchmark'})`,
            data            : benchmarkValues,
            backgroundColor : 'rgba(153, 102, 255, 0.15)',
            borderColor     : 'rgba(153, 102, 255, 1)',
            borderWidth     : 2,
            pointRadius     : 0,
            pointHitRadius  : 10,
            tension         : 0.15,
            fill            : 'origin',
            spanGaps        : false
        });
    } else {
         if (benchmarkValues.length > 0 && chartData.benchmark_in_portfolio === true) {
             console.log("Benchmark is in portfolio, not adding separate line to equity curve chart");
        } else if (benchmarkValues.length === 0) {
             console.log("No benchmark data available for equity curve chart");
        } else if (dates.length !== benchmarkValues.length) {
             console.warn("Benchmark equity data length mismatch, not adding benchmark line.");
        }
    }

    /* ------- Build Config ----------------------------------------- */
    const chartConfig = {
        type : 'line',
        data : { labels: dates, datasets },
        options : {
            responsive          : true,
            maintainAspectRatio : false,
            plugins : {
                title : {
                    display : true,
                    text    : 'Portfolio Equity Curve', // Consistent casing
                    font    : { size : 16 }
                },
                tooltip : {
                    mode : 'index',
                    intersect : false,
                    callbacks : {
                        label (ctx) {
                            const base = ctx.dataset.label ? ctx.dataset.label + ': ' : '';
                            if (ctx.parsed.y === null || ctx.parsed.y === undefined) return base + 'N/A';
                            return (
                                base +
                                new Intl.NumberFormat('en-US', {
                                    style: 'currency', // Use currency for equity value
                                    currency: 'USD',   // Assume USD, or make dynamic if needed
                                    minimumFractionDigits : 2,
                                    maximumFractionDigits : 2
                                }).format(ctx.parsed.y * 10000) // Assuming start value is 1.0 = $10,000
                            );
                        }
                    }
                },
                legend : { position : 'top' }
            },
            scales : {
                x : {
                    type : 'time',
                    time : {
                        unit           : 'month',
                        tooltipFormat: 'MMM yyyy',
                        displayFormats : { month : 'MMM yyyy' }
                    },
                    title : { display : true, text : 'Date' }
                },
                y : {
                    type: 'linear', // Explicitly linear
                    title : { display : true, text : 'Portfolio Value (Indexed)' }, // Updated title
                    min   : yAxisMin(portfolioValues, hasBench ? benchmarkValues : []), // Use helper
                    ticks: { // Format y-axis ticks as well
                         callback: function(value, index, ticks) {
                             // Show simplified value (e.g., 1.0, 1.5)
                             return value.toFixed(1);
                         }
                     }
                }
            }
        }
    };

    /* ------- Render Chart using Utility --------------------------- */
    await renderChart(containerId, chartConfig, 'Equity Curve Chart');
}

/* ------------------------------------------------------------------ */
/* Helper to calculate appropriate Y-axis minimum                     */
/* ------------------------------------------------------------------ */
function yAxisMin (portfolioVals, benchmarkVals = []) {
    // Combine valid, non-null data points from both datasets
    const all = [...portfolioVals, ...benchmarkVals].filter(
        v => v !== null && v !== undefined && !Number.isNaN(v)
    );
    if (!all.length) return 0.8; // Default if no valid data

    const min = Math.min(...all);
    // Determine a reasonable floor, e.g., round down to nearest 0.1 or 0.2
    const floor = Math.floor(min * 10) / 10; 
    // Add a small buffer below the floor, but don't go below 0 unless necessary
    return Math.max(0, floor - 0.1); 
}
