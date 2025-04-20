/*  static/js/modules/charts/drawdown.js
    Portfolio & benchmark draw‑down line‑chart (Chart.js v4)          */

// Import the registration helper and Chart module
import { ensureChartComponentsRegistered } from './index.js';
import { ChartModule } from '../../charts.js';

/* ------------------------------------------------------------------
   1 ▸ grab the pieces we need from the global Chart bundle & register
   ------------------------------------------------------------------ */
/* We'll get Chart object asynchronously now */
  
/* ------------------------------------------------------------------
   2 ▸ public API
   ------------------------------------------------------------------ */
/**
 * Render (or update) a draw‑down chart.
 *
 * @param {string}  containerId  <div id="…"> that will host a <canvas>
 * @param {{
 *   dates:                string[],
 *   drawdowns:            number[],
 *   benchmark_drawdowns?: number[],
 *   benchmark_ticker?:    string,
 *   benchmark_in_portfolio?: boolean
 * }} chartData            payload returned by the Flask API
 */
export async function createDrawdownChart(containerId, chartData = {}) {
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

  /* ── guards ───────────────────────────────────────────────────── */
  const container = document.getElementById(containerId);
  if (!container) return;

  const dates       = chartData.dates      ?? [];
  const ddPortfolio = chartData.drawdowns  ?? [];

  if (!dates.length || !ddPortfolio.length) {
    container.innerHTML =
      '<div class="chart-error">Insufficient data to create chart</div>';
    return;
  }

  /* ── wipe previous instance tied to this <canvas> ─────────────── */
  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  if (Chart.getChart(canvas)) Chart.getChart(canvas).destroy();

  /* ── compose datasets ─────────────────────────────────────────── */
  const datasets = [
    {
      label           : 'Portfolio draw‑down',
      data            : ddPortfolio,
      borderColor     : 'rgba(255, 99, 132, 1)',
      backgroundColor : 'rgba(255, 99, 132, 0.25)',
      borderWidth     : 2,
      pointRadius     : 0,
      pointHitRadius  : 8,
      tension         : 0.15,
      fill            : true
    }
  ];

  // Check if benchmark data exists and should be displayed
  if (Array.isArray(chartData.benchmark_drawdowns) && 
      chartData.benchmark_drawdowns.length > 0 && 
      chartData.benchmark_in_portfolio !== true) {
    
    console.log("Adding benchmark to drawdown chart - benchmark ticker:", chartData.benchmark_ticker);
    datasets.push({
      label           : `${chartData.benchmark_ticker ?? 'Benchmark'} draw‑down`,
      data            : chartData.benchmark_drawdowns,
      borderColor     : 'rgba(153, 102, 255, 1)',
      backgroundColor : 'rgba(153, 102, 255, 0.25)',
      borderWidth     : 2,
      pointRadius     : 0,
      pointHitRadius  : 8,
      tension         : 0.15,
      fill            : true
    });
  } else if (!Array.isArray(chartData.benchmark_drawdowns) || chartData.benchmark_drawdowns.length === 0) {
    console.log("No benchmark data available for drawdown chart");
  } else {
    console.log("Benchmark is in portfolio, not adding separate line to drawdown chart");
  }

  /* ── chart config ─────────────────────────────────────────────── */
  const cfg = {
    type   : 'line',
    data   : { labels: dates, datasets },
    options: {
      responsive          : true,
      maintainAspectRatio : false,
      plugins : {
        title  : { display: true, text: 'Portfolio draw‑down', font: { size: 16 } },
        legend : { position: 'top' },
        tooltip: {
          mode      : 'index',
          intersect : false,
          callbacks : {
            label({ dataset, parsed }) {
              const base = dataset.label ? `${dataset.label}: ` : '';
              if (parsed.y == null) return base + '—';
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
          time : { unit: 'month', displayFormats: { month: 'MMM yyyy' } },
          title: { display: true, text: 'Date' }
        },
        y : {
          min   : yAxisMin(ddPortfolio, chartData.benchmark_drawdowns),
          max   : 0.02,                                 // nudge above zero
          title : { display: true, text: 'Draw‑down (%)' },
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

  /* ── draw ─────────────────────────────────────────────────────── */
  try {
    /* eslint-disable-next-line no-new */
    new Chart(canvas, cfg);
  } catch (error) {
    console.error("Error creating Drawdown Chart instance:", error);
    const errContainer = document.getElementById(containerId);
    if (errContainer) { // Ensure container exists before setting innerHTML
        errContainer.innerHTML = '<div class="chart-error">Failed to render drawdown chart.</div>';
    }
  }
}

/* ------------------------------------------------------------------
   3 ▸ helper
   ------------------------------------------------------------------ */
function yAxisMin(portfolioDD, benchDD = []) {
  let vals = [...portfolioDD];
  if (benchDD.length) vals = vals.concat(benchDD);

  const filtered = vals.filter(v => v != null && !Number.isNaN(v));
  if (!filtered.length) return -0.1;

  const min = Math.min(...filtered);
  // round down to next 5 % step and add a 5 % buffer
  return Math.floor(min * 20) / 20 - 0.05;
}
  