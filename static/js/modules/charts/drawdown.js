/*  static/js/modules/charts/drawdown.js
    Portfolio & benchmark draw‑down line‑chart (Chart.js v4)          */

// Import the chart rendering utility
import { renderChart } from '../utils/chartUtils.js';

/**
 * Render (or update) a draw‑down chart.
 *
 * @param {string}  containerId  <div id="…"> that will host the chart
 * @param {{ 
 *      dates: string[], 
 *      drawdowns: number[], 
 *      benchmark_drawdowns?: number[], 
 *      benchmark_ticker?: string,
 *      benchmark_in_portfolio?: boolean 
 * }} chartData Payload returned by the Flask API
 */
export async function createDrawdownChart(containerId, chartData = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Drawdown chart container '${containerId}' not found.`);
        return;
    }

    /* ── guards & data extraction ─────────────────────────────────── */
    const dates       = chartData.dates      ?? [];
    const ddPortfolio = chartData.drawdowns  ?? [];

    if (!dates.length || !ddPortfolio.length || dates.length !== ddPortfolio.length) {
        container.innerHTML = '<div class="chart-error">Insufficient or mismatched data for drawdown chart.</div>';
        return;
    }

    /* ── compose datasets ─────────────────────────────────────────── */
    const datasets = [
        {
            label           : 'Portfolio Drawdown', // Consistent casing
            data            : ddPortfolio,
            borderColor     : 'rgba(255, 99, 132, 1)',
            backgroundColor : 'rgba(255, 99, 132, 0.25)',
            borderWidth     : 2,
            pointRadius     : 0,
            pointHitRadius  : 8,
            tension         : 0.15,
            fill            : true,
            spanGaps        : false // Don't connect lines across null data points
        }
    ];

    // Check if benchmark data exists and should be displayed
    const benchDrawdowns = chartData.benchmark_drawdowns ?? [];
    const hasBench = benchDrawdowns.length > 0 && 
                     dates.length === benchDrawdowns.length && // Ensure lengths match
                     chartData.benchmark_in_portfolio !== true;

    if (hasBench) {
        console.log("Adding benchmark to drawdown chart - ticker:", chartData.benchmark_ticker);
        datasets.push({
            label           : `${chartData.benchmark_ticker ?? 'Benchmark'} Drawdown`,
            data            : benchDrawdowns,
            borderColor     : 'rgba(153, 102, 255, 1)',
            backgroundColor : 'rgba(153, 102, 255, 0.25)',
            borderWidth     : 2,
            pointRadius     : 0,
            pointHitRadius  : 8,
            tension         : 0.15,
            fill            : true,
            spanGaps        : false
        });
    } else {
        if (benchDrawdowns.length > 0 && chartData.benchmark_in_portfolio === true) {
             console.log("Benchmark is in portfolio, not adding separate line to drawdown chart");
        } else if (benchDrawdowns.length === 0) {
             console.log("No benchmark data available for drawdown chart");
        } else if (dates.length !== benchDrawdowns.length) {
             console.warn("Benchmark drawdown data length mismatch, not adding benchmark line.");
        }
    }

    /* ── chart config ─────────────────────────────────────────────── */
    const chartConfig = {
        type   : 'line',
        data   : { labels: dates, datasets },
        options: {
            responsive          : true,
            maintainAspectRatio : false,
            plugins : {
                title  : { display: true, text: 'Portfolio Drawdown', font: { size: 16 } }, // Consistent casing
                legend : { position: 'top' },
                tooltip: {
                    mode      : 'index',
                    intersect : false,
                    callbacks : {
                        label({ dataset, parsed }) {
                            const base = dataset.label ? `${dataset.label}: ` : '';
                            if (parsed.y === null || parsed.y === undefined) return base + 'N/A';
                            return (
                                base +
                                new Intl.NumberFormat('en-US', {
                                    style : 'percent',
                                    minimumFractionDigits : 2,
                                    maximumFractionDigits : 2
                                }).format(parsed.y)
                            );
                        }
                    }
                }
            },
            scales : {
                x : {
                    type : 'time',
                    time : { 
                        unit: 'month', 
                        tooltipFormat: 'MMM yyyy', // Format for tooltip
                        displayFormats: { month: 'MMM yyyy' } 
                    },
                    title: { display: true, text: 'Date' }
                },
                y : {
                    min   : yAxisMin(ddPortfolio, hasBench ? benchDrawdowns : []), // Only pass bench data if valid
                    max   : 0.02, // nudge above zero
                    title : { display: true, text: 'Drawdown (%)' },
                    ticks : {
                        callback(v) {
                            return new Intl.NumberFormat('en-US', {
                                style : 'percent',
                                minimumFractionDigits : 0,
                                maximumFractionDigits : 0
                            }).format(v);
                        }
                    }
                }
            }
        }
    };

    /* ── render chart using utility ──────────────────────────────── */
    await renderChart(containerId, chartConfig, 'Drawdown Chart');
}

/* ------------------------------------------------------------------
   Helper to calculate appropriate Y-axis minimum
   ------------------------------------------------------------------ */
function yAxisMin(portfolioDD, benchDD = []) {
    // Combine valid, non-null data points from both datasets
    const vals = [...portfolioDD, ...benchDD].filter(v => v !== null && v !== undefined && !Number.isNaN(v));

    if (!vals.length) return -0.1; // Default if no valid data

    const min = Math.min(...vals);
    // Round down to next 5% step and add a 5% buffer for padding
    const roundedMin = Math.floor(min * 20) / 20;
    return Math.min(-0.01, roundedMin - 0.05); // Ensure it's at least slightly negative, add buffer
}
  