/**
 * Equity‑curve chart module
 * Uses the global `Chart` object provided by
 *   <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js">
 */

// Import the registration helper
import { ensureChartComponentsRegistered } from './index.js';
import { ChartModule } from '../../charts.js';

/* ------------------------------------------------------------------ */
/* 2 ▸ public API                                                     */
/* ------------------------------------------------------------------ */

/**
 * Render the equity‑curve chart.
 * @param {string}  containerId  id of the wrapper <div>
 * @param {Object}  chartData    pre‑formatted payload from the backend
 */
export async function createEquityCurveChart (containerId, chartData) {
    // Ensure Chart.js is ready and components are registered
    const success = await ensureChartComponentsRegistered();
    if (!success) {
        console.error("Failed to register Chart.js components");
        const errContainer = document.getElementById(containerId);
        if (errContainer) {
            errContainer.innerHTML = '<div class="chart-error">Chart library not properly initialized.</div>';
        }
        return;
    }

    // Get Chart object
    const Chart = await ChartModule;

    const container = document.getElementById(containerId);
    if (!container) return;

    const dates            = chartData.dates            || [];
    const portfolioValues  = chartData.portfolio_values || [];

    if (!dates.length || !portfolioValues.length) {
        container.innerHTML =
            '<div class="chart-error">Insufficient data to create chart</div>';
        return;
    }

    /* ------- build cfg -------------------------------------------- */
    const cfg = {
        type : 'line',
        data : {
            labels   : dates,
            datasets : [
                {
                    label           : 'Portfolio',
                    data            : portfolioValues,
                    backgroundColor : 'rgba(75, 192, 192, 0.15)',
                    borderColor     : 'rgba(75, 192, 192, 1)',
                    borderWidth     : 2,
                    pointRadius     : 0,
                    pointHitRadius  : 10,
                    tension         : 0.15
                }
            ]
        },
        options : {
            responsive          : true,
            maintainAspectRatio : false,
            plugins : {
                title : {
                    display : true,
                    text    : 'Portfolio equity curve',
                    font    : { size : 16 }
                },
                tooltip : {
                    mode : 'index',
                    intersect : false,
                    callbacks : {
                        label (ctx) {
                            const base = ctx.dataset.label ? ctx.dataset.label + ': ' : '';
                            if (ctx.parsed.y == null) return base + '—';
                            return (
                                base +
                                new Intl.NumberFormat('en-US', {
                                    minimumFractionDigits : 2,
                                    maximumFractionDigits : 2
                                }).format(ctx.parsed.y)
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
                        displayFormats : { month : 'MMM yyyy' }
                    },
                    title : { display : true, text : 'Date' }
                },
                y : {
                    title : { display : true, text : 'Value (start = 1.0)' },
                    min   : yAxisMin(portfolioValues, chartData.benchmark_values)
                }
            }
        }
    };

    /* ------- add benchmark line if needed ------------------------- */
    if (Array.isArray(chartData.benchmark_values) && chartData.benchmark_values.length > 0) {
        // Check for explicitly set benchmark_in_portfolio flag
        const shouldShowBenchmark = chartData.benchmark_in_portfolio !== true;
        
        if (shouldShowBenchmark) {
            console.log("Adding benchmark to equity curve chart - benchmark ticker:", chartData.benchmark_ticker);
            cfg.data.datasets.push({
                label           : `Benchmark (${chartData.benchmark_ticker || 'Benchmark'})`,
                data            : chartData.benchmark_values,
                backgroundColor : 'rgba(153, 102, 255, 0.15)',
                borderColor     : 'rgba(153, 102, 255, 1)',
                borderWidth     : 2,
                pointRadius     : 0,
                pointHitRadius  : 10,
                tension         : 0.15
            });
        } else {
            console.log("Benchmark is in portfolio, not adding separate line");
        }
    } else {
        console.log("No benchmark data available for equity curve chart");
    }

    /* ------- destroy any previous chart & render ------------------ */
    container.innerHTML = '';                 // clear wrapper
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);

    try {
      /* eslint-disable no-new -- we intentionally create Chart instance */
      new Chart(canvas, cfg);
    } catch (error) {
      console.error("Error creating Equity Curve Chart instance:", error);
      const errContainer = document.getElementById(containerId); // Get container again for error
      if (errContainer) { // Ensure container exists before setting innerHTML
          errContainer.innerHTML = '<div class="chart-error">Failed to render equity curve chart.</div>';
      }
    }
}

/* ------------------------------------------------------------------ */
/* 3 ▸ helpers                                                        */
/* ------------------------------------------------------------------ */

function yAxisMin (portfolioVals, benchmarkVals = []) {
    const all = [...portfolioVals, ...benchmarkVals].filter(
        v => v != null && !Number.isNaN(v)
    );
    if (!all.length) return 0.8;
    const min = Math.min(...all);
    return min < 0.8 ? Math.floor(min * 10) / 10 : 0.8;
}
