//  static/js/charts.js
//  Loads all chart modules once and exposes Chart to modules

// First ensure Chart.js is loaded and globally available
let chartReady;
const chartReadyPromise = new Promise(resolve => {
  chartReady = resolve;
});

// Check if Chart is already loaded
if (typeof Chart !== 'undefined') {
  chartReady();
} else {
  // If not, wait for it to load
  window.addEventListener('ChartLoaded', chartReady);
  // Fallback if event never fires
  setTimeout(chartReady, 1000);
}

// Track matrix plugin loading for correlation charts
let matrixReady;
const matrixReadyPromise = new Promise(resolve => {
  matrixReady = resolve;
});

// Check if MatrixController is already defined in window
if (typeof window.MatrixController !== 'undefined') {
  matrixReady();
} else {
  // If not, wait for our custom event
  window.addEventListener('MatrixPluginLoaded', matrixReady);
  // Fallback if event never fires - allow Matrix to be null but don't block other charts
  setTimeout(() => {
    console.log("Matrix plugin load timeout - will proceed anyway");
    matrixReady();
  }, 2000);
}

// Export a function to get the Chart object safely
export async function getChart() {
  await chartReadyPromise;
  return window.Chart;
}

// Export a function to get the MatrixController
export async function getMatrixController() {
  await matrixReadyPromise;
  return window.MatrixController || 
         (window.Chart && window.Chart.registry.getController('matrix')) ||
         (window.Chart && window.Chart.controllers && window.Chart.controllers.matrix);
}

// Export Chart as a promise-based module
export const ChartModule = chartReadyPromise.then(() => window.Chart);

// Export Matrix controller as a promise-based module
export const MatrixModule = matrixReadyPromise.then(() => {
  return window.MatrixController || 
         (window.Chart && window.Chart.registry.getController('matrix')) ||
         (window.Chart && window.Chart.controllers && window.Chart.controllers.matrix);
});

// Make chart modules available globally (for non-module scripts)
(async () => {
  await chartReadyPromise; // Wait for Chart to be available
  
  // dynamic import of the bundled chart modules
  const exports = await import('./modules/charts/index.js');
  
  /* make every named export visible to classic scripts such as main.js
     (e.g. createEquityCurveChart, createDrawdownChart, …) */
  Object.assign(window, exports);
})();
