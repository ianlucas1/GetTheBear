/*  static/js/modules/charts/allocation.js
    Draw a portfolio‑allocation donut (Chart.js v4)                 */

// Import the registration helper and Chart module
import { ensureChartComponentsRegistered } from './index.js';
import { ChartModule } from '../../charts.js';

/* ------------------------------------------------------------------
   (Optional) ensure the bits needed for a doughnut are registered.
   ------------------------------------------------------------------ */
   
/**
 * Draw or update a portfolio‑allocation donut chart.
 *
 * @param {string}  canvasId   ID of the <canvas> to render into
 * @param {?string} legendId   ID of a <ul> for a custom legend (optional)
 * @param {string[]} labels    Ticker symbols e.g. ['VUG', 'TLT', …]
 * @param {number[]} weights   Normalised weights   e.g. [0.333, 0.333, …]
 */
export async function createAllocationChart(canvasId, legendId, labels, weights) {
  // Ensure Chart.js is ready and components are registered
  const success = await ensureChartComponentsRegistered();
  if (!success) {
    console.error("Failed to register Chart.js components");
    const container = document.getElementById(canvasId);
    if (container) {
      container.innerHTML = '<div class="chart-error">Chart library not properly initialized.</div>';
    }
    return;
  }

  // Get Chart object
  const Chart = await ChartModule;
  
  // Explicitly register doughnut chart components
  try {
    // Check if components already registered
    if (!Chart.registry.getController('doughnut')) {
      if (Chart.ArcElement && Chart.DoughnutController) {
        Chart.register(Chart.ArcElement, Chart.DoughnutController);
        console.log("Doughnut chart components registered");
      } else {
        console.warn("Unable to find ArcElement or DoughnutController");
      }
    }
  } catch (error) {
    console.error("Error registering doughnut chart components:", error);
  }

  /* ── guards ──────────────────────────────────────────────────── */
  if (!Array.isArray(labels) || !Array.isArray(weights)) return;
  if (labels.length === 0 || labels.length !== weights.length) return;

  const container = document.getElementById(canvasId);
  if (!container) return;

  /* ── build dataset ───────────────────────────────────────────── */
  const data = {
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

  /* ── destroy any earlier chart tied to this <canvas> ─────────── */
  try {
    const existingChart = Chart.getChart(container);
    if (existingChart) existingChart.destroy();
  } catch (e) {
    console.warn("Could not destroy previous chart:", e);
  }

  /* ── create a fresh canvas ──────────────────────────────────── */
  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);

  /* ── draw donut ──────────────────────────────────────────────── */
  try {
    const chart = new Chart(canvas, {
      type: 'doughnut',
      data,
      options: {
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
    });

    /* ── optional custom HTML legend (ul > li.swatch ⋯) ─────────── */
    if (legendId) {
      const ul = document.getElementById(legendId);
      if (ul) {
        ul.innerHTML = ''; // clear previous
        data.labels.forEach((lbl, i) => {
          const li = document.createElement('li');
          li.innerHTML = `
            <span class="swatch"
                  style="background:${data.datasets[0].backgroundColor[i]}"></span>
            <span class="lbl">${lbl}</span>
            <span class="val">${data.datasets[0].data[i]}%</span>`;
          ul.appendChild(li);
        });
      }
    }

    return chart;
  } catch (error) {
    console.error("Error creating Allocation Chart:", error);
    container.innerHTML = '<div class="chart-error">Failed to render allocation chart.</div>';
    return null;
  }
}
  