/**
 * Chart Rendering Utility
 */
import { ChartModule } from '../charts.js';

/**
 * Creates or updates a Chart.js chart in a specified container,
 * handling canvas creation/clearing, error display, and registration checks.
 *
 * @param {string} containerId - The ID of the div element to contain the chart.
 * @param {object} chartConfig - The Chart.js configuration object.
 * @param {string} chartType - A descriptive name for the chart type (for logging).
 * @returns {Chart|null} The created Chart instance or null if an error occurred.
 */
export async function renderChart(containerId, chartConfig, chartType = 'Chart') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`${chartType} container '${containerId}' not found.`);
        return null;
    }

    // Get the Chart object (assuming it's loaded via ChartModule)
    const Chart = await ChartModule;
    if (!Chart) {
        console.error("Chart.js library is not available.");
        container.innerHTML = '<div class="chart-error">Chart library failed to load.</div>';
        return null;
    }

    // Basic validation of chartConfig (can be expanded)
    if (!chartConfig || typeof chartConfig !== 'object' || !chartConfig.type || !chartConfig.data) {
        console.error(`Invalid chart configuration provided for ${chartType} in '${containerId}'.`);
        container.innerHTML = '<div class="chart-error">Invalid chart configuration.</div>';
        return null;
    }

    // Clear previous chart/content and create a new canvas
    try {
        const existingChart = Chart.getChart(containerId); // Try getting by container ID first
        if (existingChart) {
            existingChart.destroy();
        }
        // If no chart by ID, check for canvas element inside
        const existingCanvas = container.querySelector('canvas');
        if(existingCanvas) {
             const chartOnCanvas = Chart.getChart(existingCanvas);
             if (chartOnCanvas) chartOnCanvas.destroy();
        }
    } catch (e) {
        console.warn(`Could not destroy previous chart in '${containerId}':`, e);
    }
    container.innerHTML = ''; // Clear container content
    const canvas = document.createElement('canvas');
    // Optionally set an ID on the canvas if needed, e.g., canvas.id = `${containerId}-canvas`;
    container.appendChild(canvas);

    // Render the new chart
    try {
        const chartInstance = new Chart(canvas, chartConfig);
        console.log(`${chartType} rendered successfully in '${containerId}'.`);
        return chartInstance;
    } catch (error) {
        console.error(`Error creating ${chartType} instance in '${containerId}':`, error);
        container.innerHTML = `<div class="chart-error">Failed to render ${chartType.toLowerCase()}.</div>`;
        return null;
    }
} 