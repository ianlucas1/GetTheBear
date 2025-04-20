/**
 * Charts‑module index
 *  ‑ imports individual chart helpers
 *  ‑ re‑exports them for ES‑modules
 *  ‑ exposes them on window for classic scripts (main.js)
 */

import { createEquityCurveChart }   from './equityCurve.js';
import { createDrawdownChart }      from './drawdown.js';
import { createAnnualReturnsChart } from './annualReturns.js';
import { createAllocationChart }    from './allocation.js';
import { createCorrelationChart }   from './correlation.js';
import { ChartModule, getMatrixController } from '../../charts.js';

let chartComponentsRegistered = false;

/**
 * Ensures necessary Chart.js components are registered once.
 * Should be called by chart creation functions before using Chart.
 */
async function ensureChartComponentsRegistered() {
    if (chartComponentsRegistered) return true;

    try {
        // Wait for Chart to be available via our module system
        const Chart = await ChartModule;
        
        if (!Chart) {
            console.error("Chart.js global object not found even after waiting.");
            return false;
        }

        // Get components from Chart
        const {
            // Common components
            LineController, LineElement, PointElement,
            BarController, BarElement,
            CategoryScale, LinearScale, TimeScale,
            Tooltip, Legend, Title, Filler,
            // Elements for pie/doughnut charts
            ArcElement, DoughnutController
        } = Chart;

        if (!Chart.register) {
            console.error("Chart.register function not found.");
            return false;
        }

        // Base components needed by most charts
        const baseComponents = [
            LineController, LineElement, PointElement,
            BarController, BarElement,
            CategoryScale, LinearScale, TimeScale,
            Tooltip, Legend, Title, Filler
        ].filter(Boolean); // Filter out undefined if any controller failed to load

        if (baseComponents.length > 0) {
            Chart.register(...baseComponents);
            console.log("Base chart components registered successfully");
        }

        // Register doughnut components if available
        if (ArcElement && DoughnutController) {
            Chart.register(ArcElement, DoughnutController);
            console.log("Doughnut components registered");
        }

        // Try to get MatrixController but don't block other charts if it fails
        try {
            const MatrixController = await getMatrixController();
            if (MatrixController) {
                // MatrixElement might be available on window.Chart
                const MatrixElement = window.Chart && window.Chart.MatrixElement;
                
                if (!Chart.registry.getController('matrix')) {
                    if (MatrixElement) {
                        Chart.register(MatrixController, MatrixElement);
                        console.log("Matrix components registered in index.js");
                    } else {
                        Chart.register(MatrixController);
                        console.log("Matrix controller registered in index.js (element not found)");
                    }
                }
            } else {
                console.warn("Matrix components not available during registration in index.js");
            }
        } catch (matrixError) {
            console.warn("Matrix registration error in index.js:", matrixError);
            // Continue without matrix - it's handled separately in correlation.js
        }

        chartComponentsRegistered = true;
        console.log("Chart.js components registered successfully.");
        return true;

    } catch (error) {
        console.error("Error during Chart.js component registration:", error);
        chartComponentsRegistered = false; // Mark as failed
        return false;
    }
}

/* ------------------------------------------------------------------ *
 *  Tab handling
 * ------------------------------------------------------------------ */
export function setupTabs() {
    const tablist = document.querySelector('.tabs[role="tablist"]');
    if (!tablist) return;

    tablist.querySelectorAll('.tab[role="tab"]').forEach(tab => {
        tab.addEventListener('click', () => {
            const prev = tablist.querySelector('.tab[aria-selected="true"]');
            if (prev) {
                prev.classList.remove('active');
                prev.setAttribute('aria-selected', 'false');
            }
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');

            const id = tab.dataset.tab;
            document.querySelectorAll('.tab-content[role="tabpanel"]')
                    .forEach(p => p.classList.toggle('active', p.id === id));
        });
    });
}

/* ------------------------------------------------------------------ *
 *  Chart creation orchestrator
 * ------------------------------------------------------------------ */
export async function createCharts(data, origTickers, origWeights) {
    /* ensure Chart is ready */
    await ensureChartComponentsRegistered();
    
    /* normalise weights for pie‑chart */
    const total = (origWeights ?? []).reduce((a, b) => a + b, 0);
    const norm  = total ? origWeights.map(w => w / total) : [];

    // Create all charts in parallel
    const chartPromises = [
        createEquityCurveChart('equity-chart', data.chart_data),
        createDrawdownChart('drawdown-chart', data.chart_data),
        createAnnualReturnsChart('returns-chart', data.chart_data),
        createAllocationChart('allocation-chart', 'allocation-legend', origTickers, norm)
    ];
    
    // Add correlation chart if data exists
    if (data.correlation_matrix?.tickers?.length > 1) {
        chartPromises.push(createCorrelationChart('correlation-chart', data.correlation_matrix));
    }
    
    // Wait for all charts to render
    await Promise.allSettled(chartPromises);
    console.log("All charts created");
}

/* ------------------------------------------------------------------ *
 *  ES‑module re‑exports
 * ------------------------------------------------------------------ */
export {
    ensureChartComponentsRegistered,
    createEquityCurveChart,
    createDrawdownChart,
    createAnnualReturnsChart,
    createAllocationChart,
    createCorrelationChart
};
