/**
 * static/js/modules/charts/index.js
 * 
 * Re-exports individual chart creation functions.
 * Assumes necessary Chart.js components are registered either via 
 * chart.auto.min.js or specific imports/registrations elsewhere.
 */

// Import individual chart creation functions
import { createEquityCurveChart }   from './equityCurve.js';
import { createDrawdownChart }      from './drawdown.js';
import { createAnnualReturnsChart } from './annualReturns.js';
import { createAllocationChart }    from './allocation.js';
import { createCorrelationChart }   from './correlation.js';

// Optional: Import ChartModule or specific controllers/elements if needed
// for advanced configuration or checks within this index file, but generally
// individual chart files should handle their specific needs.
// import { ChartModule, getMatrixController } from '../../charts.js';

/* 
   No need for ensureChartComponentsRegistered anymore if using chart.auto.js 
   and handling the custom matrix controller registration elsewhere or 
   checking within createCorrelationChart itself.
*/

/* ------------------------------------------------------------------ *
 *  Tab handling (Keep as it relates to chart display areas) 
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

            const id = tab.dataset.tab; // Use dataset for cleaner access
            document.querySelectorAll('.tab-content[role="tabpanel"]')
                    .forEach(p => p.classList.toggle('active', p.id === id));
        });
    });

     // Ensure the default active tab's content is shown on initial load
    const initialActiveTab = tablist.querySelector('.tab.active[aria-selected="true"]');
    if (initialActiveTab) {
        const initialTabId = initialActiveTab.dataset.tab;
        document.querySelectorAll('.tab-content[role="tabpanel"]').forEach(p => { 
             p.classList.toggle('active', p.id === initialTabId);
        });
    }
}

/* ------------------------------------------------------------------ *
 *  Chart creation orchestrator (Simplified)
 *  This function now primarily focuses on calling the individual chart 
 *  creation functions with the appropriate data.
 * ------------------------------------------------------------------ */
export async function createCharts(data, origTickers, origWeights) {
    // No need to explicitly wait for Chart.js registration here anymore,
    // assuming layout.html loads scripts correctly.
    
    /* normalise weights for pie‑chart */
    const totalWeight = (origWeights ?? []).reduce((a, b) => a + b, 0);
    const normalizedWeights = totalWeight > 0 ? origWeights.map(w => w / totalWeight) : [];

    // --- Create all charts --- 
    // Use Promise.allSettled to attempt rendering all charts even if one fails.
    const chartPromises = [
        createEquityCurveChart('equity-chart', data.chart_data),
        createDrawdownChart('drawdown-chart', data.chart_data),
        createAnnualReturnsChart('returns-chart', data.chart_data),
        // Pass normalized weights to allocation chart
        createAllocationChart('allocation-chart', 'allocation-legend', origTickers, normalizedWeights)
    ];
    
    // Add correlation chart promise if data is valid
    if (data.correlation_matrix?.tickers?.length > 1) {
        chartPromises.push(createCorrelationChart('correlation-chart', data.correlation_matrix));
    } else {
         // Optionally clear or hide the correlation chart container if no data
         const corrContainer = document.getElementById('correlation-chart');
         if (corrContainer) corrContainer.innerHTML = '<div class="chart-info">Correlation matrix requires at least 2 tickers.</div>';
    }
    
    // Wait for all chart rendering attempts to complete
    const results = await Promise.allSettled(chartPromises);
    
    // Log results (optional)
    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            console.error(`Chart at index ${index} failed to render:`, result.reason);
        }
    });
    
    console.log("Chart creation process finished.");
}

/* ------------------------------------------------------------------ *
 *  ES‑module re‑exports (for use in main.js or other modules)
 * ------------------------------------------------------------------ */
export {
    // Removed ensureChartComponentsRegistered
    createEquityCurveChart,
    createDrawdownChart,
    createAnnualReturnsChart,
    createAllocationChart,
    createCorrelationChart
};
