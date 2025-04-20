// static/js/chartPlugins.js
// This file handles direct plugin registration for Chart.js

(function() {
  console.log("chartPlugins.js loaded - ensuring matrix controller is available");
  
  // Wait until both Chart.js and the matrix plugin are loaded
  function initializeMatrixPlugin() {
    // Check if Chart is available
    if (typeof Chart === 'undefined') {
      console.warn("Chart.js not loaded yet, waiting...");
      setTimeout(initializeMatrixPlugin, 100);
      return;
    }
    
    // Handle matrix plugin registration directly
    try {
      // Check if the controller already exists in registry
      if (Chart.registry && !Chart.registry.getController('matrix')) {
        console.log("Matrix controller not registered yet, checking available objects...");
        
        // Check different ways the matrix controller might be available
        if (window.Chart.controllers && window.Chart.controllers.matrix) {
          // v3 style controller registration
          console.log("Found matrix controller in Chart.controllers");
          Chart.register(window.Chart.controllers.matrix);
          window.MatrixController = window.Chart.controllers.matrix;
          window.dispatchEvent(new Event('MatrixPluginLoaded'));
        } else if (window.Chart.MatrixController && window.Chart.MatrixElement) {
          // Plugin explicitly exposes controllers
          console.log("Found MatrixController and MatrixElement explicitly");
          Chart.register(window.Chart.MatrixController, window.Chart.MatrixElement);
          window.MatrixController = window.Chart.MatrixController;
          window.dispatchEvent(new Event('MatrixPluginLoaded'));
        } else {
          // Last resort - check if chartjs-chart-matrix script is loaded
          const matrixScript = document.querySelector('script[src*="chartjs-chart-matrix"]');
          
          if (matrixScript) {
            console.log("Matrix script is loaded but controller not found, retrying later...");
            // Give the script a bit more time and try again
            setTimeout(initializeMatrixPlugin, 200);
          } else {
            console.error("Matrix script not found in page, cannot register controller");
            // Dispatch event anyway to unblock waiting code
            window.dispatchEvent(new Event('MatrixPluginLoaded'));
          }
        }
      } else if (Chart.registry && Chart.registry.getController('matrix')) {
        console.log("Matrix controller already registered!");
        window.MatrixController = Chart.registry.getController('matrix');
        window.dispatchEvent(new Event('MatrixPluginLoaded'));
      }
    } catch (error) {
      console.error("Error registering matrix plugin:", error);
      // Dispatch event anyway to unblock waiting code
      window.dispatchEvent(new Event('MatrixPluginLoaded'));
    }
  }
  
  // Start initialization process
  initializeMatrixPlugin();
})(); 