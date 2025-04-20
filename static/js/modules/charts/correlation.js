/*  static/js/modules/charts/correlation.js
    Correlation‑matrix heat‑map (Chart.js v4 + chartjs‑chart‑matrix)  */

// Import the registration helper and Chart module
import { ensureChartComponentsRegistered } from './index.js';
import { ChartModule, MatrixModule, getMatrixController } from '../../charts.js';

/* ------------------------------------------------------------------
   1 ▸ grab Chart & matrix pieces from the global namespace, register
   ------------------------------------------------------------------ */
/**
 * Render a correlation heat‑map.
 *
 * @param {string}  containerId  <div id="…"> that will host a <canvas>
 * @param {{ tickers:string[], matrix:number[][] }} correlationData
 */
export async function createCorrelationChart(containerId, correlationData) {
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
  
  // Check if MatrixController is already registered
  if (!Chart.registry.getController('matrix')) {
    console.error("Matrix controller not registered yet");
    const errContainer = document.getElementById(containerId);
    if (errContainer) {
      errContainer.innerHTML = '<div class="chart-error">Matrix chart controller not available.</div>';
    }
    return;
  }

  const container = document.getElementById(containerId);
  if (!container) return;

  /* ── sanity checks ─────────────────────────────────────────────── */
  if (
    !correlationData?.tickers?.length ||
    !correlationData?.matrix?.length  ||
    correlationData.tickers.length !== correlationData.matrix.length
  ) {
    container.innerHTML =
      '<div class="chart-error">Insufficient correlation data</div>';
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
        x: x,               // Use integer index instead of ticker name
        y: y,               // Use integer index instead of ticker name
        v: matrix[y][x],    // The correlation value
        xLabel: tickers[x], // Keep ticker name as label
        yLabel: tickers[y]  // Keep ticker name as label
      });
    }
  }

  /* colour helper (blue ↔ white ↔ red) ──────────────────────────── */
  const cellColor = (context) => {
    // Get value from context
    const value = context.raw ? context.raw.v : context.v;
    
    return value < 0
      ? `rgba(  0,  0,255,${Math.abs(value) * 0.7})`
      : `rgba(255,  0,  0,${value * 0.7})`;
  };

  /* ── matrix value labels plug‑in ───────────────────────────────── */
  const correlationLabelsPlugin = {
    id: 'correlationLabels',
    afterDatasetDraw(chart) {
      const ctx = chart.ctx;
      ctx.save();
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Get data and scales
      const dataset = chart.data.datasets[0];
      const data = dataset.data || [];
      const xScale = chart.scales.x;
      const yScale = chart.scales.y;
      
      if (!xScale || !yScale) return;
      
      // Draw text for each data point
      data.forEach(point => {
        const x = xScale.getPixelForValue(point.x);
        const y = yScale.getPixelForValue(point.y);
        const value = point.v;
        
        ctx.fillStyle = Math.abs(value) >= 0.7 ? '#fff' : '#000';
        ctx.fillText(value.toFixed(2), x, y);
      });
      
      ctx.restore();
    }
  };

  /* ── build chart config ───────────────────────────────────────── */
  const cfg = {
    type : 'matrix',
    data : {
      datasets: [
        {
          label           : 'Correlation',
          data            : points,
          backgroundColor : cellColor,
          borderColor     : 'rgba(0,0,0,0.05)',
          borderWidth     : 1,
          width  : ({ chart }) =>
            (chart.chartArea?.width  ?? 0) / size - 1,
          height : ({ chart }) =>
            (chart.chartArea?.height ?? 0) / size - 1
        }
      ]
    },
    options : {
      responsive          : true,
      maintainAspectRatio : false,
      plugins : {
        title : {
          display : true,
          text    : 'Correlation matrix',
          font    : { size: 16 }
        },
        tooltip : {
          callbacks : {
            title : (ctx) => {
              const item = ctx[0].raw;
              return `${item.yLabel} vs ${item.xLabel}`;
            },
            label : (ctx) => `Correlation: ${ctx.raw.v.toFixed(2)}`
          }
        },
        legend : { display: false }
      },
      scales : {
        x : {
          type   : 'category',
          labels : tickers,
          offset : true,
          grid   : { display: false }
        },
        y : {
          type   : 'category',
          labels : tickers,
          offset : true,
          grid   : { display: false }
        }
      }
    },
    plugins : [correlationLabelsPlugin]
  };

  /* ── clear & render ───────────────────────────────────────────── */
  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  try {
    /* eslint-disable-next-line no-new */
    new Chart(canvas, cfg);
  } catch (error) {
    console.error("Error creating Correlation Chart instance:", error);
    const errContainer = document.getElementById(containerId);
    if (errContainer) { // Ensure container exists before setting innerHTML
        errContainer.innerHTML = '<div class="chart-error">Failed to render correlation chart.</div>';
    }
  }
}
  