/**
 * charts.js
 * 
 * Exports the globally available Chart object and provides access
 * to the custom Matrix controller/element if loaded.
 */

// Export the global Chart object directly
// Assumes Chart.js (specifically chart.auto.min.js or similar) 
// has been loaded via a <script> tag in layout.html
export const ChartModule = window.Chart;

/**
 * Attempts to get the MatrixController constructor.
 * Assumes custom-matrix.js has been loaded globally.
 * 
 * @returns {Function|null} The MatrixController constructor or null.
 */
export function getMatrixController() {
    // Access the controller potentially attached to the global Chart object
    // by custom-matrix.js
    return window.Chart?.controllers?.matrix || null;
}

/**
 * Attempts to get the MatrixElement constructor.
 * Assumes custom-matrix.js has been loaded globally.
 * 
 * @returns {Function|null} The MatrixElement constructor or null.
 */
export function getMatrixElement() {
    // Access the element potentially attached to the global Chart object
    // by custom-matrix.js
    return window.Chart?.elements?.MatrixElement || null;
}

// Optional: Perform a check and log if Chart wasn't loaded
if (!ChartModule) {
    console.error("Chart.js core library (window.Chart) not found. Ensure it is loaded globally in layout.html before this module.");
}

// Optional: Log if custom matrix components were found
if (getMatrixController()) {
    console.log("Custom MatrixController found.");
} else {
    console.warn("Custom MatrixController not found. Correlation chart might not work.");
}
if (getMatrixElement()) {
    console.log("Custom MatrixElement found.");
} else {
     console.warn("Custom MatrixElement not found. Matrix chart rendering might be affected.");
}
