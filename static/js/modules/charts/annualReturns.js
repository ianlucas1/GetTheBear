/*  static/js/modules/charts/annualReturns.js
    Draw a portfolio vs benchmark "annual returns" chart            */

// Import the chart rendering utility
import { renderChart } from '../utils/chartUtils.js';

/**
 * Create an annual‑returns chart (bar for portfolio, optional line for benchmark).
 *
 * @param {string}  containerId  ID of the element that will host the chart.
 * @param {Object}  chartData    Piece of the API payload containing return data.
 */
export async function createAnnualReturnsChart(containerId, chartData = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Annual Returns chart container '${containerId}' not found.`);
        return;
    }

    /* gather & validate data ---------------------------------------- */
    const annual = chartData.annual_returns || {};
    const bench  = chartData.benchmark_annual_returns || {};

    // Collect all unique years from both portfolio and benchmark data
    const allYears = new Set([
        ...(Object.keys(annual).map(Number)),
        ...(Object.keys(bench).map(Number))
    ]);

    // Sort years in ascending order
    const years = Array.from(allYears).sort((a, b) => a - b);

    if (years.length === 0) {
        container.innerHTML = '<div class="chart-error">Insufficient data: No years found for annual returns chart.</div>';
        return;
    }

    // Create portfolio data array, ensuring zeros for missing years
    const portData = years.map(y =>
        annual[y] !== undefined && annual[y] !== null
            ? parseFloat((annual[y] || '0').toString().replace('%', '')) / 100
            : 0 // Use 0 for missing/null years
    );

    // Create benchmark data array
    const benchData = years.map(y =>
        bench[y] !== undefined && bench[y] !== null
            ? parseFloat(bench[y].toString().replace('%', '')) / 100
            : null // Keep null for missing benchmark years for line chart gaps
    );

    // Check if benchmark data exists and should be displayed
    const hasBench = benchData.some(v => v !== null) && chartData.benchmark_in_portfolio !== true;

    // Log data for debugging (optional)
    // console.log("Years in annual returns chart:", years);
    // console.log("Portfolio annual data:", portData);
    // console.log("Benchmark annual data:", benchData);
    // console.log("Has benchmark data for chart:", hasBench);

    /* build Chart.js config ----------------------------------------- */
    const chartConfig = {
        type: 'bar',
        data: {
            labels: years,
            datasets: [
                {
                    label: 'Portfolio',
                    data: portData,
                    backgroundColor: portData.map(v => {
                        if (v === 0) return 'rgba(200,200,200,.7)'; // Light gray for zero
                        return v > 0 ? 'rgba(75,192,192,.7)' : 'rgba(255,99,132,.7)'; // Green/Red
                    }),
                    borderColor: portData.map(v => {
                         if (v === 0) return 'rgba(150,150,150,1)'; // Gray border for zero
                        return v > 0 ? 'rgba(75,192,192,1)' : 'rgba(255,99,132,1)';
                    }),
                    borderWidth: 1,
                    // Ensure bar chart doesn't treat 0 as a gap
                    parsing: { yAxisKey: 'y' } 
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Annual Returns', font: { size: 16 } },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const value = ctx.parsed.y;
                            if (value === null) return `${ctx.dataset.label}: N/A`;
                            return `${ctx.dataset.label}: ${new Intl.NumberFormat('en-US', {
                                style: 'percent',
                                minimumFractionDigits: 2,
                            }).format(value)}`;
                        }
                    },
                },
                legend: { position: 'top' }
            },
            scales: {
                x: { title: { display: true, text: 'Year' } },
                y: {
                    title: { display: true, text: 'Return (%)' },
                    ticks: {
                        callback: v =>
                            new Intl.NumberFormat('en-US', {
                                style: 'percent',
                                minimumFractionDigits: 0,
                            }).format(v),
                    },
                },
            },
        },
    };

    if (hasBench) {
        console.log("Adding benchmark line to annual returns chart");
        chartConfig.data.datasets.push({
            label: `Benchmark (${chartData.benchmark_ticker || 'SPY'})`,
            data: benchData,
            backgroundColor: 'rgba(153,102,255,.5)',
            borderColor: 'rgba(153,102,255,1)',
            borderWidth: 2, // Thicker line for benchmark
            type: 'line',
            pointStyle: 'circle',
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.1, // Slight curve to the line
            // Ensure line chart skips nulls
            spanGaps: false 
        });
    }

    /* render chart using utility ------------------------------------ */
    await renderChart(containerId, chartConfig, 'Annual Returns Chart');
}
  