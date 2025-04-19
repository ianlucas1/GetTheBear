/**
 * Charts module index
 * Aggregates and exports all chart-related functions
 */

import { createEquityCurveChart } from './equityCurve.js';
import { createDrawdownChart } from './drawdown.js';
import { createAnnualReturnsChart } from './annualReturns.js';
import { createAllocationChart } from './allocation.js';
import { createCorrelationChart } from './correlation.js';

/**
 * Initialize all tab functionality
 */
export function setupTabs() {
    // Tab switching
    const tablist = document.querySelector('.tabs[role="tablist"]');
    if (!tablist) return;
    
    const tabs = tablist.querySelectorAll('.tab[role="tab"]');

    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Find the previously selected tab and set aria-selected to false
            const previousSelectedTab = tablist.querySelector('.tab[aria-selected="true"]');
            if (previousSelectedTab) {
                previousSelectedTab.classList.remove('active');
                previousSelectedTab.setAttribute('aria-selected', 'false');
            }
            
            // Set aria-selected to true on the clicked tab
            this.classList.add('active');
            this.setAttribute('aria-selected', 'true');
            
            // Show corresponding content
            const tabId = this.getAttribute('data-tab');
            document.querySelectorAll('.tab-content[role="tabpanel"]').forEach(content => {
                content.classList.remove('active');
            });
            
            const tabPanel = document.getElementById(tabId);
            if (tabPanel) {
                tabPanel.classList.add('active');
            }
        });
    });
}

/**
 * Create all charts from analysis data
 * @param {Object} data - The portfolio analysis data from the API
 * @param {Array} originalTickers - The tickers from the form
 * @param {Array} originalWeights - The weights from the form
 */
export function createCharts(data, originalTickers, originalWeights) {
    // Normalize weights to sum to 1 for pie chart
    let normalizedWeights = [];
    if (originalWeights && originalWeights.length > 0) {
        const totalWeight = originalWeights.reduce((a, b) => a + b, 0);
        normalizedWeights = originalWeights.map(w => w / totalWeight);
    }
    
    // Create each chart
    createEquityCurveChart('equity-chart', data.chart_data);
    createDrawdownChart('drawdown-chart', data.chart_data);
    createAnnualReturnsChart('returns-chart', data.chart_data);
    
    // Create allocation pie chart
    createAllocationChart('allocation-chart', 'allocation-legend', originalTickers, normalizedWeights);
    
    // Create correlation heatmap if data is available
    if (data.correlation_matrix && data.correlation_matrix.tickers && data.correlation_matrix.tickers.length > 1) {
        createCorrelationChart('correlation-chart', data.correlation_matrix);
    }
}

// Export all chart-related functions
export {
    createEquityCurveChart,
    createDrawdownChart,
    createAnnualReturnsChart,
    createAllocationChart,
    createCorrelationChart
}; 