/**
 * Benchmark control module for managing benchmark selection
 */

/**
 * Setup benchmark dropdown selector with autocomplete
 */
export function setupBenchmarkControl() {
    const benchmarkSelect = document.getElementById('benchmark-select');
    const customBenchmarkInput = document.getElementById('custom-benchmark');
    const suggestionsContainer = document.getElementById('ticker-suggestions');
    
    if (!benchmarkSelect || !customBenchmarkInput || !suggestionsContainer) return;
    
    // Store tickers data for fuzzy search
    let tickersData = [];
    
    // Load tickers data
    fetch('/static/data/tickers.csv')
        .then(response => response.text())
        .then(csv => {
            // Parse CSV manually (minimal implementation)
            const lines = csv.split('\n');
            const headers = lines[0].split(',');
            
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                
                const values = lines[i].split(',');
                tickersData.push({
                    ticker: values[0],
                    name: values[1]
                });
            }
            
            // Initialize Fuse.js for fuzzy search
            initFuzzySearch(tickersData);
        })
        .catch(error => {
            console.error('Error loading tickers data:', error);
        });
    
    // Initialize Fuse.js
    function initFuzzySearch(data) {
        const options = {
            includeScore: true,
            keys: ['ticker', 'name'],
            threshold: 0.3
        };
        
        const fuse = new Fuse(data, options);
        
        // Setup input event for autocomplete
        customBenchmarkInput.addEventListener('input', function() {
            const query = this.value.trim();
            
            if (query.length < 1) {
                suggestionsContainer.style.display = 'none';
                // Ensure aria-expanded is false when input is cleared
                customBenchmarkInput.setAttribute('aria-expanded', 'false');
                customBenchmarkInput.removeAttribute('aria-activedescendant');
                return;
            }
            
            // Perform fuzzy search
            const results = fuse.search(query);
            
            // Limit to 10 results
            const topResults = results.slice(0, 10);
            
            // Clear previous suggestions
            suggestionsContainer.innerHTML = '';

            if (topResults.length > 0) {
                topResults.forEach((result, index) => {
                    const item = result.item;
                    
                    // Create suggestion item element
                    const suggestionDiv = document.createElement('div');
                    suggestionDiv.className = 'suggestion-item';
                    suggestionDiv.setAttribute('role', 'option');
                    suggestionDiv.id = `suggestion-${index}`;
                    suggestionDiv.dataset.ticker = item.ticker;

                    // Create ticker span
                    const tickerSpan = document.createElement('span');
                    tickerSpan.className = 'suggestion-ticker';
                    tickerSpan.textContent = item.ticker;

                    // Create name span
                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'suggestion-name';
                    nameSpan.textContent = item.name;

                    // Append spans to the suggestion div
                    suggestionDiv.appendChild(tickerSpan);
                    suggestionDiv.appendChild(nameSpan);

                    // Add click listener
                    suggestionDiv.addEventListener('click', function() {
                        const ticker = this.dataset.ticker;
                        const name = this.querySelector('.suggestion-name').textContent;
                        customBenchmarkInput.value = `${ticker} (${name})`;
                        suggestionsContainer.style.display = 'none';
                        customBenchmarkInput.setAttribute('aria-expanded', 'false');
                        customBenchmarkInput.removeAttribute('aria-activedescendant');
                    });

                    suggestionsContainer.appendChild(suggestionDiv);
                });
                
                suggestionsContainer.style.display = 'block';
                customBenchmarkInput.setAttribute('aria-expanded', 'true');
            } else {
                suggestionsContainer.style.display = 'none';
                customBenchmarkInput.setAttribute('aria-expanded', 'false');
                customBenchmarkInput.removeAttribute('aria-activedescendant');
            }
        });
        
        // Add keydown listener for arrow navigation and Enter/Escape
        let activeSuggestionIndex = -1;
        customBenchmarkInput.addEventListener('keydown', function(e) {
            const suggestions = suggestionsContainer.querySelectorAll('.suggestion-item');
            if (suggestions.length === 0 || suggestionsContainer.style.display === 'none') return;

            if (e.key === 'ArrowDown') {
                e.preventDefault(); // Prevent cursor move
                activeSuggestionIndex = (activeSuggestionIndex + 1) % suggestions.length;
                updateActiveSuggestion(suggestions, activeSuggestionIndex);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault(); // Prevent cursor move
                activeSuggestionIndex = (activeSuggestionIndex - 1 + suggestions.length) % suggestions.length;
                updateActiveSuggestion(suggestions, activeSuggestionIndex);
            } else if (e.key === 'Enter') {
                if (activeSuggestionIndex >= 0) {
                    e.preventDefault(); // Prevent form submission if suggestion selected
                    suggestions[activeSuggestionIndex].click(); // Trigger click event on active suggestion
                    activeSuggestionIndex = -1; // Reset index
                }
            } else if (e.key === 'Escape') {
                suggestionsContainer.style.display = 'none';
                customBenchmarkInput.setAttribute('aria-expanded', 'false');
                customBenchmarkInput.removeAttribute('aria-activedescendant');
                activeSuggestionIndex = -1; // Reset index
            }
        });

        // Helper function to update ARIA and visual state of suggestions
        function updateActiveSuggestion(suggestions, index) {
            suggestions.forEach((item, i) => {
                if (i === index) {
                    item.style.backgroundColor = 'var(--hover)'; // Use hover color for highlight
                    customBenchmarkInput.setAttribute('aria-activedescendant', item.id);
                } else {
                    item.style.backgroundColor = ''; // Remove background color
                }
            });
        }
    }
    
    // Handle switching between dropdown and custom input
    benchmarkSelect.addEventListener('change', function() {
        if (this.value === 'custom') {
            customBenchmarkInput.style.display = 'block';
            customBenchmarkInput.focus();
            customBenchmarkInput.required = true;
        } else {
            customBenchmarkInput.style.display = 'none';
            customBenchmarkInput.required = false;
            suggestionsContainer.style.display = 'none';
            // Ensure ARIA state is reset when switching away from custom
            customBenchmarkInput.setAttribute('aria-expanded', 'false');
            customBenchmarkInput.removeAttribute('aria-activedescendant');
        }
    });
    
    // Add auto-uppercase functionality to custom benchmark input
    customBenchmarkInput.addEventListener('blur', function() {
        this.value = this.value.toUpperCase();
        // Hide suggestions when focus is lost
        setTimeout(() => {
            // Check if focus is still within the container before hiding
            if (!suggestionsContainer.contains(document.activeElement)) {
                suggestionsContainer.style.display = 'none';
                // Set aria-expanded to false on blur
                customBenchmarkInput.setAttribute('aria-expanded', 'false');
                customBenchmarkInput.removeAttribute('aria-activedescendant');
            }
        }, 150); // Slightly shorter delay
    });
    
    // Close suggestions when clicking outside
    document.addEventListener('click', function(e) {
        if (!customBenchmarkInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
            suggestionsContainer.style.display = 'none';
            // Set aria-expanded to false on outside click
            customBenchmarkInput.setAttribute('aria-expanded', 'false');
            customBenchmarkInput.removeAttribute('aria-activedescendant');
        }
    });
}

/**
 * Get the selected benchmark ticker
 * @returns {string} The selected benchmark ticker
 */
export function getBenchmarkTicker() {
    const benchmarkSelect = document.getElementById('benchmark-select');
    const customBenchmarkInput = document.getElementById('custom-benchmark');
    
    if (!benchmarkSelect) return 'SPY';
    
    if (benchmarkSelect.value === 'custom') {
        if (!customBenchmarkInput || !customBenchmarkInput.value.trim()) {
            return 'SPY'; // Default if empty
        }
        
        let customValue = customBenchmarkInput.value.trim().toUpperCase();
        
        // Extract just the ticker if it's in "TICKER (Fund Name)" format
        if (customValue.includes('(')) {
            return customValue.split('(')[0].trim();
        } else {
            return customValue;
        }
    } else {
        return benchmarkSelect.value;
    }
} 