/*  static/js/modules/charts/allocation.js
    Draw a portfolio‑allocation donut (Chart.js v4)                 */

// Import the chart rendering utility
import { renderChart } from '../utils/chartUtils.js';
// We still need ChartModule potentially for specific component access if needed later,
// but registration should be handled centrally.
import { ChartModule } from '../../charts.js'; 

/**
 * Draw or update a portfolio‑allocation donut chart.
 *
 * @param {string}  containerId   ID of the <div> to render into
 * @param {?string} legendId   ID of a <ul> for a custom legend (optional)
 * @param {string[]} labels    Ticker symbols e.g. ['VUG', 'TLT', …]
 * @param {number[]} weights   Normalised weights   e.g. [0.333, 0.333, …]
 */
export async function createAllocationChart(containerId, legendId, labels, weights) {
    /* ── guards ──────────────────────────────────────────────────── */
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Allocation chart container '${containerId}' not found.`);
        return;
    }
    if (!Array.isArray(labels) || !Array.isArray(weights) || labels.length === 0 || labels.length !== weights.length) {
        console.error("Invalid labels or weights for allocation chart.");
        container.innerHTML = '<div class="chart-error">Insufficient or mismatched data for allocation chart.</div>';
        return;
    }

    /* ── build dataset ───────────────────────────────────────────── */
    const chartData = {
        labels,
        datasets: [
            {
                label: 'Portfolio share',
                data: weights.map(w => +(w * 100).toFixed(2)), // → percentages
                backgroundColor: [
                    '#3366cc', '#dc3912', '#ff9900', '#109618',
                    '#990099', '#0099c6', '#dd4477', '#66aa00',
                ],
                borderWidth: 1,
            },
        ],
    };

    /* ── build config ────────────────────────────────────────────── */
    const chartConfig = {
        type: 'doughnut',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false, // Often better for donuts in containers
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (tt) => `${tt.label}: ${tt.parsed}%`,
                    },
                },
                legend: {
                    display: !legendId, // hide if we'll build a custom one
                },
            },
        },
    };

    /* ── render chart using utility ──────────────────────────────── */
    const chartInstance = await renderChart(containerId, chartConfig, 'Allocation Chart');

    /* ── optional custom HTML legend (ul > li.swatch ⋯) ─────────── */
    if (chartInstance && legendId) { // Check if chart was created successfully
        const ul = document.getElementById(legendId);
        if (ul) {
            ul.innerHTML = ''; // clear previous
            chartData.labels.forEach((lbl, i) => {
                const li = document.createElement('li');
                const swatch = document.createElement('span');
                swatch.className = 'swatch';
                // Ensure colors loop correctly if more labels than colors
                const bgColor = chartData.datasets[0].backgroundColor[i % chartData.datasets[0].backgroundColor.length];
                swatch.style.background = bgColor;
                const labelSpan = document.createElement('span');
                labelSpan.className = 'lbl';
                labelSpan.textContent = lbl;
                const valueSpan = document.createElement('span');
                valueSpan.className = 'val';
                valueSpan.textContent = `${chartData.datasets[0].data[i]}%`;
                li.appendChild(swatch);
                li.appendChild(labelSpan);
                li.appendChild(valueSpan);
                ul.appendChild(li);
            });
        } else {
             console.warn(`Legend container '${legendId}' not found for allocation chart.`);
        }
    }

    // No need to return chartInstance unless the caller needs it
}
  