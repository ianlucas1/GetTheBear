/**
 * Benchmark control module for managing benchmark selection
 * Includes fuzzy search autocomplete for custom tickers.
 */
import { showError } from './utils/validation.js'; // Import error display utility

// Store Fuse instance globally within the module scope
let fuseInstance = null;

/**
 * Parses CSV text, handling potential quotes and commas within fields.
 * @param {string} csvText - The raw CSV text.
 * @returns {Array<Object>} Array of objects representing ticker data.
 */
function parseCsvRobust(csvText) {
    const lines = csvText.split(/\r?\n/); // Split lines respecting Windows/Unix endings
    if (!lines.length) return [];

    // Simple regex to handle quoted commas (adjust if more complex CSV needed)
    const header = lines[0].split(',').map(h => h.trim());
    const tickerIndex = header.indexOf('ticker');
    const nameIndex = header.indexOf('name');

    if (tickerIndex === -1 || nameIndex === -1) {
        console.error("CSV header must contain 'ticker' and 'name' columns.");
        return [];
    }

    const data = [];
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        // Regex to split by comma, but respecting quoted fields
        // Matches commas not inside double quotes
        const values = lines[i].split(/,(?=(?:(?:[^\"]*\"){2})*[^\"]*$)/);
        
        if (values.length > Math.max(tickerIndex, nameIndex)) {
            const ticker = values[tickerIndex]?.trim().replace(/^"|"$/g, ''); // Trim and remove quotes
            const name = values[nameIndex]?.trim().replace(/^"|"$/g, ''); // Trim and remove quotes
            if (ticker && name) {
                data.push({ ticker, name });
            }
        }
    }
    return data;
}

/**
 * Initialize Fuse.js instance for fuzzy search.
 * @param {Array<Object>} data - The ticker data array.
 */
function initializeFuzzySearch(data) {
    if (!data || data.length === 0) {
        console.warn("No ticker data provided for fuzzy search initialization.");
        return;
    }
    try {
        // Check if Fuse is available (loaded via script tag)
        if (typeof Fuse === 'undefined') {
            console.error("Fuse.js library not loaded. Autocomplete disabled.");
            return;
        }
        const options = {
            includeScore: true,
            keys: ['ticker', 'name'],
            threshold: 0.3, // Lower threshold for stricter matching
            minMatchCharLength: 2, // Minimum characters before searching
        };
        fuseInstance = new Fuse(data, options);
        console.log("Fuse.js initialized for benchmark autocomplete.");
    } catch (error) {
        console.error("Error initializing Fuse.js:", error);
        fuseInstance = null; // Ensure it's null if init fails
    }
}

/**
 * Fetches and processes ticker data for autocomplete.
 */
async function loadAndPrepareTickers() {
    try {
        const response = await fetch('/static/data/tickers.csv');
        if (!response.ok) {
            throw new Error(`Failed to load tickers.csv: ${response.status} ${response.statusText}`);
        }
        const csvText = await response.text();
        const tickersData = parseCsvRobust(csvText);
        if (tickersData.length > 0) {
             initializeFuzzySearch(tickersData);
        } else {
             console.warn("Parsed ticker data is empty.");
        }
       
    } catch (error) {
        console.error('Error loading or parsing tickers data:', error);
        showError("Could not load ticker data for autocomplete."); // Inform user
        fuseInstance = null; // Disable autocomplete on error
    }
}

/**
 * Displays autocomplete suggestions.
 * @param {HTMLElement} inputElement - The input field.
 * @param {HTMLElement} suggestionsContainer - The container for suggestions.
 * @param {Array<Object>} results - The search results from Fuse.js.
 */
function displaySuggestions(inputElement, suggestionsContainer, results) {
    suggestionsContainer.innerHTML = ''; // Clear previous

    if (results.length === 0) {
        suggestionsContainer.style.display = 'none';
        inputElement.setAttribute('aria-expanded', 'false');
        inputElement.removeAttribute('aria-activedescendant');
        return;
    }

    // Limit to max 10 results
    const topResults = results.slice(0, 10);

    topResults.forEach((result, index) => {
        const item = result.item;
        const suggestionDiv = document.createElement('div');
        suggestionDiv.className = 'suggestion-item';
        suggestionDiv.setAttribute('role', 'option');
        suggestionDiv.id = `suggestion-${index}`;
        suggestionDiv.dataset.ticker = item.ticker;

        const tickerSpan = document.createElement('span');
        tickerSpan.className = 'suggestion-ticker';
        tickerSpan.textContent = item.ticker;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'suggestion-name';
        nameSpan.textContent = item.name;

        suggestionDiv.appendChild(tickerSpan);
        suggestionDiv.appendChild(nameSpan);

        suggestionDiv.addEventListener('click', function() {
            inputElement.value = item.ticker; // Set only the ticker
            suggestionsContainer.style.display = 'none';
            inputElement.setAttribute('aria-expanded', 'false');
            inputElement.removeAttribute('aria-activedescendant');
            inputElement.dispatchEvent(new Event('change', { bubbles: true })); // Trigger change event if needed
        });

        suggestionsContainer.appendChild(suggestionDiv);
    });

    suggestionsContainer.style.display = 'block';
    inputElement.setAttribute('aria-expanded', 'true');
}

/**
 * Updates the active suggestion during keyboard navigation.
 * @param {HTMLElement} inputElement - The input field.
 * @param {NodeListOf<HTMLElement>} suggestions - The suggestion items.
 * @param {number} index - The index of the suggestion to activate.
 */
function updateActiveSuggestion(inputElement, suggestions, index) {
    suggestions.forEach((item, i) => {
        if (i === index) {
            item.classList.add('active'); // Use CSS class for highlighting
            inputElement.setAttribute('aria-activedescendant', item.id);
        } else {
            item.classList.remove('active');
        }
    });
}

/**
 * Setup benchmark dropdown selector with autocomplete functionality.
 */
export function setupBenchmarkControl() {
    const benchmarkSelect = document.getElementById('benchmark-select');
    const customBenchmarkInput = document.getElementById('custom-benchmark');
    const suggestionsContainer = document.getElementById('ticker-suggestions');
    const benchmarkContainer = document.getElementById('benchmark-container'); // Parent container

    if (!benchmarkSelect || !customBenchmarkInput || !suggestionsContainer || !benchmarkContainer) {
        console.error("Benchmark control elements not found.");
        return;
    }

    // Load ticker data asynchronously
    loadAndPrepareTickers();

    let activeSuggestionIndex = -1;
    let debounceTimer;

    // Autocomplete input handler
    customBenchmarkInput.addEventListener('input', function() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const query = this.value.trim().toUpperCase();
            if (query.length < 2 || !fuseInstance) { // Check query length and if fuse is ready
                suggestionsContainer.style.display = 'none';
                this.setAttribute('aria-expanded', 'false');
                this.removeAttribute('aria-activedescendant');
                activeSuggestionIndex = -1;
                return;
            }
            const results = fuseInstance.search(query);
            displaySuggestions(this, suggestionsContainer, results);
            activeSuggestionIndex = -1; // Reset index on new input
        }, 250); // Debounce input
    });

    // Keyboard navigation for autocomplete
    customBenchmarkInput.addEventListener('keydown', function(e) {
        const suggestions = suggestionsContainer.querySelectorAll('.suggestion-item');
        if (suggestions.length === 0 || suggestionsContainer.style.display === 'none') return;

        let newIndex = activeSuggestionIndex;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            newIndex = (activeSuggestionIndex + 1) % suggestions.length;
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            newIndex = (activeSuggestionIndex - 1 + suggestions.length) % suggestions.length;
        } else if (e.key === 'Enter') {
            if (activeSuggestionIndex >= 0) {
                e.preventDefault(); 
                suggestions[activeSuggestionIndex].click();
                activeSuggestionIndex = -1; 
            }
             // Allow Enter to submit form if no suggestion selected
        } else if (e.key === 'Escape') {
            suggestionsContainer.style.display = 'none';
            this.setAttribute('aria-expanded', 'false');
             this.removeAttribute('aria-activedescendant');
            activeSuggestionIndex = -1; 
        } else if (e.key === 'Tab') {
            // Hide suggestions on Tab out
            suggestionsContainer.style.display = 'none';
            this.setAttribute('aria-expanded', 'false');
            this.removeAttribute('aria-activedescendant');
            activeSuggestionIndex = -1; 
        }

        if (newIndex !== activeSuggestionIndex) {
             activeSuggestionIndex = newIndex;
             updateActiveSuggestion(this, suggestions, activeSuggestionIndex);
        }
    });

    // Handle switching between dropdown and custom input
    benchmarkSelect.addEventListener('change', function() {
        if (this.value === 'custom') {
            customBenchmarkInput.style.display = 'block';
            customBenchmarkInput.value = ''; // Clear previous custom value
            customBenchmarkInput.focus();
            customBenchmarkInput.required = true;
        } else {
            customBenchmarkInput.style.display = 'none';
            customBenchmarkInput.required = false;
            suggestionsContainer.style.display = 'none';
            customBenchmarkInput.setAttribute('aria-expanded', 'false');
             customBenchmarkInput.removeAttribute('aria-activedescendant');
            activeSuggestionIndex = -1;
        }
    });

    // Uppercase on blur
    customBenchmarkInput.addEventListener('blur', function() {
        // Only uppercase if it wasn't selected from suggestions (which sets only ticker)
        if (!this.value.includes('(')) {
             this.value = this.value.toUpperCase();
        }
        // Hide suggestions on blur, slight delay to allow click on suggestion
        setTimeout(() => {
            if (!suggestionsContainer.contains(document.activeElement)) {
                suggestionsContainer.style.display = 'none';
                this.setAttribute('aria-expanded', 'false');
                this.removeAttribute('aria-activedescendant');
                 activeSuggestionIndex = -1;
            }
        }, 150); 
    });

    // Close suggestions when clicking outside the benchmark control area
    document.addEventListener('click', function(e) {
        if (!benchmarkContainer.contains(e.target)) {
            suggestionsContainer.style.display = 'none';
            customBenchmarkInput.setAttribute('aria-expanded', 'false');
            customBenchmarkInput.removeAttribute('aria-activedescendant');
            activeSuggestionIndex = -1;
        }
    });
}

/**
 * Get the selected benchmark ticker.
 * @returns {string} The selected benchmark ticker (uppercase).
 */
export function getBenchmarkTicker() {
    const benchmarkSelect = document.getElementById('benchmark-select');
    const customBenchmarkInput = document.getElementById('custom-benchmark');
    
    if (!benchmarkSelect) return 'SPY'; // Default fallback
    
    let ticker = 'SPY'; // Default

    if (benchmarkSelect.value === 'custom') {
        if (customBenchmarkInput && customBenchmarkInput.value.trim()) {
             // Value should ideally be just the ticker after selection or uppercased input
             ticker = customBenchmarkInput.value.trim().toUpperCase();
             // Remove any potential name part if user typed it manually and didn't select
             if (ticker.includes('(')) {
                 ticker = ticker.split('(')[0].trim();
             }
        }
    } else {
        ticker = benchmarkSelect.value;
    }
    return ticker;
} 