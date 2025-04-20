/*  static/js/modules/charts/annualReturns.js
    Draw a portfolio vs benchmark "annual returns" chart            */

// Import the registration helper and Chart module
import { ensureChartComponentsRegistered } from './index.js';
import { ChartModule } from '../../charts.js';

/* ------------------------------------------------------------------
   We rely on the global `Chart` loaded by layout.html.
   ------------------------------------------------------------------ */
   if (typeof Chart === 'undefined') {
    console.error('Chart.js not loaded – annual‑returns chart aborted.');
  }
  
  /* ------------------------------------------------------------------ */
  /**
   * Create an annual‑returns chart (bar for portfolio, optional line
   * for benchmark).
   *
   * @param {string}  containerId  ID of the element that will receive a
   *                              fresh <canvas>.
   * @param {Object}  chartData    Piece of the API payload
   */
  export async function createAnnualReturnsChart(containerId, chartData) {
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
  
    /* gather & validate data ---------------------------------------- */
    const annual = chartData.annual_returns || {};
    const bench  = chartData.benchmark_annual_returns || {};
  
    if (Object.keys(annual).length === 0 && Object.keys(bench).length === 0) {
      container.innerHTML =
        '<div class="chart-error">Insufficient data to create chart</div>';
      return;
    }
    
    // Collect all unique years from both portfolio and benchmark data
    const allYears = new Set([
      ...Object.keys(annual).map(Number),
      ...Object.keys(bench).map(Number)
    ]);
    
    // Sort years in ascending order
    const years = Array.from(allYears).sort((a, b) => a - b);
  
    // Create portfolio data array, ensuring zeros (not nulls) for missing years
    const portData = years.map(y =>
      annual[y] 
        ? parseFloat((annual[y] || '0').toString().replace('%', '')) / 100
        : 0 // Explicitly use 0 for missing years
    );
  
    // Create benchmark data array
    const benchData = years.map(y =>
      bench[y] == null
        ? null
        : parseFloat(bench[y].toString().replace('%', '')) / 100
    );
    
    // Log data for debugging
    console.log("Years in chart:", years);
    console.log("Portfolio annual data:", portData);
    console.log("Benchmark annual data:", benchData);
  
    // Check if benchmark data exists and should be displayed
    const hasBench = benchData.some(v => v != null) && chartData.benchmark_in_portfolio !== true;
  
    // Log benchmark data status
    if (benchData.some(v => v != null)) {
      if (chartData.benchmark_in_portfolio === true) {
        console.log("Benchmark is in portfolio, not adding separate line to annual returns chart");
      } else {
        console.log("Benchmark data available for annual returns chart");
      }
    } else {
      console.log("No benchmark data available for annual returns chart");
    }
  
    /* build Chart.js config ----------------------------------------- */
    const cfg = {
      type: 'bar',
      data: {
        labels: years,
        datasets: [
          {
            label: 'Portfolio',
            data: portData,
            backgroundColor: portData.map(v => {
              // Use light gray for exactly zero values
              if (v === 0) return 'rgba(200,200,200,.7)'; 
              // Use green for positive values
              return v > 0 ? 'rgba(75,192,192,.7)' : 'rgba(255,99,132,.7)';
            }),
            borderColor: portData.map(v => {
              // Use gray for exactly zero values
              if (v === 0) return 'rgba(150,150,150,1)';
              // Use green for positive values
              return v > 0 ? 'rgba(75,192,192,1)' : 'rgba(255,99,132,1)';
            }),
            borderWidth: 1,
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
              label: ctx =>
                `${ctx.dataset.label}: ${new Intl.NumberFormat('en-US', {
                  style: 'percent',
                  minimumFractionDigits: 2,
                }).format(ctx.parsed.y)}`,
            },
          },
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
      console.log("Adding benchmark to annual returns chart");
      cfg.data.datasets.push({
        label: `Benchmark (${chartData.benchmark_ticker || 'SPY'})`,
        data: benchData,
        backgroundColor: 'rgba(153,102,255,.5)',
        borderColor: 'rgba(153,102,255,1)',
        borderWidth: 1,
        type: 'line',
        pointStyle: 'circle',
        pointRadius: 4,
        pointHoverRadius: 6,
      });
    }
  
    /* render --------------------------------------------------------- */
    container.innerHTML = '';                 // remove any previous chart
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    try { 
        new Chart(canvas, cfg);
    } catch (error) {
        console.error("Error creating Annual Returns Chart instance:", error);
        container.innerHTML = '<div class="chart-error">Failed to render annual returns chart.</div>';
    }
  }
  