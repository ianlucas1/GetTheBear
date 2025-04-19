/**
 * Ticker controls module for managing portfolio securities
 */
import { showError } from './utils/validation.js';

let tickerRowCount = 0;

/**
 * Setup ticker input controls (add/remove) and equal weights functionality
 */
export function setupTickerControls() {
    const addTickerBtn = document.getElementById('add-ticker');
    const tickerInputsContainer = document.getElementById('ticker-inputs');
    
    if (!addTickerBtn || !tickerInputsContainer) return;
    
    // Add default ticker row
    addTickerRow();
    
    // Add ticker button click handler
    addTickerBtn.addEventListener('click', function() {
        addTickerRow();
    });
    
    // Remove ticker button delegation
    tickerInputsContainer.addEventListener('click', function(e) {
        if (e.target.classList.contains('remove-ticker')) {
            const tickerRow = e.target.closest('.ticker-item');
            
            // Only remove if we have more than one ticker
            if (document.querySelectorAll('.ticker-item').length > 1) {
                tickerRow.remove();
                updateWeightTotal(); // Update total after removing a row
            } else {
                showError('Portfolio must contain at least one ticker');
            }
        }
    });
    
    // Add auto-uppercase functionality to all ticker inputs (both existing and future ones)
    tickerInputsContainer.addEventListener('blur', function(e) {
        if (e.target.classList.contains('ticker-input')) {
            e.target.value = e.target.value.toUpperCase();
        }
    }, true);
    
    // Add listener for weight input changes
    tickerInputsContainer.addEventListener('input', function(e) {
        if (e.target.classList.contains('weight-input')) {
            updateWeightTotal();
        }
    });
    
    // Set up Equal Weights button handler
    const equalWeightsBtn = document.getElementById('btn-equal-weights');
    if (equalWeightsBtn) {
        equalWeightsBtn.addEventListener('click', function() {
            applyEqualWeights();
        });
    }
    
    // Initialize weight total
    updateWeightTotal();
}

/**
 * Add a new ticker input row
 */
export function addTickerRow() {
    const tickerInputsContainer = document.getElementById('ticker-inputs');
    if (!tickerInputsContainer) return;
    
    // Increment row count for unique IDs
    tickerRowCount++;
    
    const tickerRow = document.createElement('div');
    tickerRow.className = 'ticker-item';
    
    // Generate unique IDs for this row's inputs
    const tickerInputId = `ticker-input-${tickerRowCount}`;
    const weightInputId = `weight-input-${tickerRowCount}`;

    tickerRow.innerHTML = `
        <div class="ticker-symbol">
            <label for="${tickerInputId}" class="sr-only">Ticker Symbol Row ${tickerRowCount}</label>
            <input type="text" id="${tickerInputId}" class="ticker-input" placeholder="Ticker Symbol (e.g., AAPL)" required>
        </div>
        <div class="ticker-weight">
            <label for="${weightInputId}" class="sr-only">Weight Row ${tickerRowCount}</label>
            <input type="number" id="${weightInputId}" class="weight-input" placeholder="e.g. 25" min="0" step="0.01" required>
        </div>
        <button type="button" class="btn btn-danger btn-sm remove-ticker" aria-label="Remove Ticker Row ${tickerRowCount}">×</button>
    `;
    
    tickerInputsContainer.appendChild(tickerRow);
    
    // Add auto-uppercase functionality to the newly added ticker input
    const tickerInput = tickerRow.querySelector('.ticker-input');
    tickerInput.addEventListener('blur', function() {
        this.value = this.value.toUpperCase();
    });

    // Focus the new ticker input for better flow
    tickerInput.focus();
    
    return tickerRow;
}

/**
 * Update the weight total indicator
 */
export function updateWeightTotal() {
    const weightInputs = document.querySelectorAll('.weight-input');
    const weightTotalElement = document.getElementById('weight-sum');
    
    if (!weightTotalElement) return;
    
    let totalWeight = 0;
    
    // Sum all weight inputs
    weightInputs.forEach(input => {
        const weight = parseFloat(input.value) || 0;
        totalWeight += weight;
    });
    
    // Update the weight total element
    weightTotalElement.textContent = `Total: ${totalWeight.toFixed(1)}%`;
    
    // Add valid/invalid styling with weight-pill classes
    weightTotalElement.classList.remove('valid', 'invalid');
    
    // Check if total is exactly 100% (within 0.05% tolerance)
    if (Math.abs(totalWeight - 100) <= 0.05) {
        weightTotalElement.classList.add('valid');
    } else {
        weightTotalElement.classList.add('invalid');
    }
    
    return totalWeight;
}

/**
 * Apply equal weights to all ticker inputs
 */
export function applyEqualWeights() {
    const tickerRows = document.querySelectorAll('.ticker-item');
    
    if (tickerRows.length > 0) {
        // Distribute exactly 100% evenly with precise decimal handling
        const numTickers = tickerRows.length;
        
        // Calculate equal weight with full precision
        const equalWeight = 100 / numTickers;
        
        // Calculate rounded weights (2 decimal places)
        const weights = Array(numTickers).fill(0).map(() => Math.floor(equalWeight * 100) / 100);
        
        // Calculate the sum after rounding
        const sumAfterRounding = weights.reduce((sum, w) => sum + w, 0);
        
        // Calculate the remainder needed to reach exactly 100%
        const remainder = parseFloat((100 - sumAfterRounding).toFixed(2));
        
        // Distribute the remainder among the first few items
        if (remainder > 0) {
            const incrementValue = 0.01;
            let remainingIncrement = remainder * 100; // Convert to cents
            
            for (let i = 0; i < remainingIncrement; i++) {
                weights[i % numTickers] += incrementValue;
            }
        }
        
        // Set weights for all ticker inputs
        tickerRows.forEach((row, index) => {
            const weightInput = row.querySelector('.weight-input');
            weightInput.value = weights[index].toFixed(2);
            
            // Trigger input event for validation
            const inputEvent = new Event('input', { bubbles: true });
            weightInput.dispatchEvent(inputEvent);
        });
        
        updateWeightTotal();
    }
}

/**
 * Get the current ticker symbols and weights from the form
 * @returns {Object} Object containing tickers and weights arrays
 */
export function getTickersAndWeights() {
    const tickers = [];
    const weights = [];
    
    // Get ticker symbols and weights
    const tickerRows = document.querySelectorAll('.ticker-item');
    
    tickerRows.forEach(row => {
        let ticker = row.querySelector('.ticker-input').value.trim().toUpperCase();
        const weight = parseFloat(row.querySelector('.weight-input').value);
        
        // If the ticker contains a benchmark label, clean it up
        if (ticker.includes(' (BENCHMARK)')) {
            ticker = ticker.replace(' (BENCHMARK)', '');
        }
        
        if (ticker && !isNaN(weight) && weight > 0) {
            tickers.push(ticker);
            weights.push(weight);
        }
    });
    
    return { tickers, weights };
} 