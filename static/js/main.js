/**
 * Get the Bear – Portfolio Analysis Tool
 * Main JavaScript (2025‑04‑18 full‑file swap)
 */

document.addEventListener('DOMContentLoaded', () => {
  initializeDatePicker();
  setupTickerControls();
  setupBenchmarkControl();
  setupAnalysisForm();
});

/* ─────────────────────────  DATE‑PICKER  ───────────────────────── */

function initializeDatePicker() {
  const today          = new Date();
  const endDateInput   = document.getElementById('end-date');
  const startDateInput = document.getElementById('start-date');

  const endDateStr   = today.toISOString().split('T')[0];
  endDateInput.value = endDateStr;

  const startDate = new Date(today);
  startDate.setFullYear(today.getFullYear() - 5);
  startDateInput.value = startDate.toISOString().split('T')[0];

  endDateInput.max   = endDateStr;
  startDateInput.max = endDateStr;
}

/* ─────────────────────  TICKER / WEIGHT CONTROLS  ─────────────────── */

function setupTickerControls() {
  const addTickerBtn        = document.getElementById('add-ticker');
  const tickerInputs        = document.getElementById('ticker-inputs');
  const equalWeightsBtn     = document.getElementById('btn-equal-weights');

  addTickerRow();                            // start with one empty row
  updateWeightSum();

  /* add/remove rows -------------------------------------------------- */
  addTickerBtn.addEventListener('click', addTickerRow);

  tickerInputs.addEventListener('click', e => {
    if (e.target.classList.contains('remove-ticker')) {
      const rows = tickerInputs.querySelectorAll('.ticker-item');
      if (rows.length > 1) {
        e.target.closest('.ticker-item').remove();
        updateWeightSum();
      } else {
        showError('Portfolio must contain at least one ticker');
      }
    }
  });

  /* auto‑uppercase ticker codes -------------------------------------- */
  tickerInputs.addEventListener('blur', e => {
    if (e.target.classList.contains('ticker-input')) {
      e.target.value = e.target.value.toUpperCase();
    }
  }, true);

  /* live sum / validation ------------------------------------------- */
  tickerInputs.addEventListener('input', e => {
    if (e.target.classList.contains('weight-input')) updateWeightSum();
  });

  /* equal‑weights button -------------------------------------------- */
  equalWeightsBtn.addEventListener('click', () => {
    const weightInputs = tickerInputs.querySelectorAll('.weight-input');
    const n = weightInputs.length;
    if (!n) return;

    const base = Math.floor((100 / n) * 100) / 100;   // 2‑dp floor
    const weights = Array(n).fill(base);
    const remainder = +(100 - base * n).toFixed(2);   // what’s left

    // distribute remainder one cent at a time
    let cents = Math.round(remainder * 100);
    for (let i = 0; cents > 0; i = (i + 1) % n, cents--) {
      weights[i] += 0.01;
    }

    weightInputs.forEach((inp, idx) => {
      inp.value = weights[idx].toFixed(2);
    });
    updateWeightSum();
  });
}

/* calc and colour‑code the weight total ----------------------------- */
function updateWeightSum() {
  const pill   = document.getElementById('weight-sum');
  const inputs = [...document.querySelectorAll('.weight-input')];

  const total  = inputs.reduce((s, i) => s + (+i.value || 0), 0);
  pill.textContent = `Total: ${total.toFixed(1)}%`;

  const valid = Math.abs(total - 100) < 0.1;          // ±0.1 %
  pill.classList.toggle('valid',   valid);
  pill.classList.toggle('invalid', !valid);

  inputs.forEach(inp => {
    inp.setCustomValidity(valid ? '' : 'Weights must sum to 100 %');
  });
}

/* add a new blank row ------------------------------------------------ */
function addTickerRow() {
  const wrap = document.getElementById('ticker-inputs');

  const row = document.createElement('div');
  row.className = 'ticker-item';

  row.innerHTML = `
    <div class="ticker-symbol">
      <input type="text" class="ticker-input" placeholder="Ticker Symbol (e.g., AAPL)" required>
    </div>
    <div class="ticker-weight">
      <input type="number" class="weight-input" placeholder="e.g. 25" min="0" step="0.01" required>
    </div>
    <button type="button" class="btn btn-danger btn-sm remove-ticker">×</button>
  `;
  wrap.appendChild(row);
}

/* ───────────────────────────  BENCHMARK  ─────────────────────────── */

function setupBenchmarkControl() {
  const benchmarkSelect      = document.getElementById('benchmark-select');
  const customBenchmarkInput = document.getElementById('custom-benchmark');
  const suggestionsContainer = document.getElementById('ticker-suggestions');

  /* load tickers for Fuse.js ---------------------------------------- */
  fetch('/static/data/tickers.csv')
    .then(r => r.text())
    .then(csv => {
      const fuse = new Fuse(
        csv.trim().split('\n').slice(1).map(line => {
          const [ticker, name] = line.split(',');
          return { ticker, name };
        }),
        { includeScore: true, keys: ['ticker', 'name'], threshold: 0.3 }
      );

      customBenchmarkInput.addEventListener('input', function () {
        const q = this.value.trim();
        if (q.length < 1) return (suggestionsContainer.style.display = 'none');

        const html = fuse.search(q).slice(0, 10).map(r => `
          <div class="suggestion-item" data-ticker="${r.item.ticker}">
            <span class="suggestion-ticker">${r.item.ticker}</span>
            <span class="suggestion-name">${r.item.name}</span>
          </div>`).join('');

        suggestionsContainer.innerHTML = html;
        suggestionsContainer.style.display = html ? 'block' : 'none';
      });

      suggestionsContainer.addEventListener('click', e => {
        const item = e.target.closest('.suggestion-item');
        if (!item) return;
        customBenchmarkInput.value = item.dataset.ticker;
        suggestionsContainer.style.display = 'none';
      });
    });

  /* dropdown ↔ custom input ----------------------------------------- */
  benchmarkSelect.addEventListener('change', function () {
    const custom = this.value === 'custom';
    customBenchmarkInput.style.display = custom ? 'block' : 'none';
    customBenchmarkInput.required      = custom;
    if (custom) customBenchmarkInput.focus();
  });
}

/* ──────────────────────────  FORM / TABS  ────────────────────────── */

function setupAnalysisForm() {
  const form        = document.getElementById('analysis-form');
  const downloadBtn = document.getElementById('download-returns-btn');

  form.addEventListener('submit', e => { e.preventDefault(); analyzePortfolio(); });
  downloadBtn.addEventListener('click', downloadReturns);

  /* simple tab switcher --------------------------------------------- */
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const id = tab.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === id));
    });
  });
}

/* ───────────────────────────  UTILITIES  ─────────────────────────── */

function showError(msg) {
  const el = document.getElementById('error-message');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => (el.style.display = 'none'), 5000);
}

function showLoading(show) {
  document.getElementById('loader').style.display = show ? 'block' : 'none';
}

/**
 * Analyze portfolio
 */
function analyzePortfolio() {
    // Hide any previous errors and results
    document.getElementById('error-message').style.display = 'none';
    document.getElementById('results-container').style.display = 'none';
    
    // Show loading indicator
    showLoading(true);
    
    // Gather form data
    const formData = getFormData();
    
    // Validate form data
    if (!formData) {
        showLoading(false);
        return;
    }
    
    // Send request to server
    fetch('/analyze_portfolio', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
    })
    .then(response => response.json())
    .then(data => {
        showLoading(false);
        
        if (data.error) {
            showError(data.error);
            return;
        }
        
        // Display results
        displayResults(data);
    })
    .catch(error => {
        showLoading(false);
        showError('An error occurred while analyzing the portfolio. Please try again.');
        console.error('Error:', error);
    });
}

/**
 * Gather form data for analysis
 */
function getFormData() {
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
    
    // Validate
    if (tickers.length === 0) {
        showError('Please add at least one valid ticker symbol');
        return null;
    }
    
    // Validate weight total is exactly 100% (with a stricter tolerance of 0.05%)
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (Math.abs(totalWeight - 100) > 0.05) {
        showError(`Weights must sum to 100% - your total is ${totalWeight.toFixed(1)}%`);
        return null;
    }
    
    // Get date range
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    
    if (!startDate || !endDate) {
        showError('Please select a valid date range');
        return null;
    }
    
    if (new Date(startDate) >= new Date(endDate)) {
        showError('Start date must be before end date');
        return null;
    }
    
    // Get benchmark ticker
    let benchmarkTicker;
    const benchmarkSelect = document.getElementById('benchmark-select');
    
    if (benchmarkSelect.value === 'custom') {
        let customValue = document.getElementById('custom-benchmark').value.trim().toUpperCase();
        
        if (!customValue) {
            showError('Please enter a custom benchmark ticker');
            return null;
        }
        
        // Extract just the ticker if it's in "TICKER (Fund Name)" format
        if (customValue.includes('(')) {
            benchmarkTicker = customValue.split('(')[0].trim();
        } else {
            benchmarkTicker = customValue;
        }
    } else {
        benchmarkTicker = benchmarkSelect.value;
    }
    
    return {
        tickers: tickers,
        weights: weights,
        start_date: startDate,
        end_date: endDate,
        benchmark_ticker: benchmarkTicker
    };
}

/**
 * Display analysis results
 */
function displayResults(data) {
    // Show results container
    document.getElementById('results-container').style.display = 'block';
    
    // Enable download button
    document.getElementById('download-returns-btn').disabled = false;
    
    // Get the benchmark ticker name to display
    const benchmarkTicker = data.chart_data.benchmark_ticker || 'SPY';
    
    // Update benchmark header in the metrics table
    document.getElementById('benchmark-header').textContent = `Benchmark (${benchmarkTicker})`;

    // Display metrics for portfolio and benchmark
    displayMetrics(data.metrics, data.benchmark_metrics);
    
    // Handle the benchmark in portfolio notice
    const benchmarkNotice = document.getElementById('benchmark-in-portfolio-notice');
    const benchmarkNameNotice = document.getElementById('benchmark-name-notice');
    
    if (data.chart_data.benchmark_in_portfolio) {
        // Update the notice text with the benchmark ticker
        benchmarkNameNotice.textContent = benchmarkTicker;
        benchmarkNotice.style.display = 'block';
        
        // Add "(Benchmark)" label to ticker in the portfolio
        if (data.chart_data.benchmark_index >= 0) {
            const tickerRows = document.querySelectorAll('.ticker-item');
            if (tickerRows.length > data.chart_data.benchmark_index) {
                const benchmarkRow = tickerRows[data.chart_data.benchmark_index];
                const tickerInput = benchmarkRow.querySelector('.ticker-input');
                if (tickerInput) {
                    // Make sure we don't add the label multiple times
                    if (!tickerInput.value.includes('(BENCHMARK)')) {
                        tickerInput.value = `${tickerInput.value.toUpperCase()} (BENCHMARK)`;
                    }
                }
            }
        }
    } else {
        benchmarkNotice.style.display = 'none';
    }
    
    // Get the original tickers and weights from the form
    const originalTickers = [];
    const originalWeights = [];
    
    document.querySelectorAll('.ticker-item').forEach(item => {
        const ticker = item.querySelector('.ticker-input').value.trim().split(' (')[0];
        const weight = parseFloat(item.querySelector('.weight-input').value);
        if (ticker && !isNaN(weight) && weight > 0) {
            originalTickers.push(ticker);
            originalWeights.push(weight);
        }
    });
    
    // Normalize weights to sum to 1 for pie chart
    const totalWeight = originalWeights.reduce((a, b) => a + b, 0);
    const normalizedWeights = originalWeights.map(w => w / totalWeight);
    
    // Create charts
    createEquityCurveChart('equity-chart', data.chart_data);
    createDrawdownChart('drawdown-chart', data.chart_data);
    createAnnualReturnsChart('returns-chart', data.chart_data);
    
    // Create allocation pie chart
    createAllocationChart('allocation-chart', 'allocation-legend', originalTickers, normalizedWeights);
    
    // Create correlation heatmap if data is available
    if (data.correlation_matrix && data.correlation_matrix.tickers && data.correlation_matrix.tickers.length > 1) {
        createCorrelationChart('correlation-chart', data.correlation_matrix);
    }
    
    // Create summary view with key metrics
    createSummaryView(data.metrics, data.benchmark_metrics);
    
    // Scroll to results
    document.getElementById('results-container').scrollIntoView({
        behavior: 'smooth'
    });
}

/**
 * Display metrics in the metrics table
 */
function displayMetrics(portfolioMetrics, benchmarkMetrics) {
    // Make sure all value cells are right-aligned
    const allValueCells = document.querySelectorAll('.metrics-table td.value-cell');
    allValueCells.forEach(cell => {
        cell.classList.add('text-end');
    });
    
    // Portfolio metrics - existing metrics
    document.getElementById('cagr-value').textContent = portfolioMetrics.cagr;
    document.getElementById('volatility-value').textContent = portfolioMetrics.volatility;
    document.getElementById('sharpe-value').textContent = portfolioMetrics.sharpe_ratio;
    document.getElementById('max-drawdown-value').textContent = portfolioMetrics.max_drawdown;
    document.getElementById('best-month-value').textContent = portfolioMetrics.best_month;
    document.getElementById('worst-month-value').textContent = portfolioMetrics.worst_month;
    document.getElementById('total-return-value').textContent = portfolioMetrics.total_return;
    document.getElementById('period-value').textContent = `${portfolioMetrics.years} years`;
    
    // Portfolio metrics - new metrics
    document.getElementById('sortino-ratio-value').textContent = portfolioMetrics.sortino_ratio;
    document.getElementById('calmar-ratio-value').textContent = portfolioMetrics.calmar_ratio;
    document.getElementById('max-drawdown-duration-value').textContent = portfolioMetrics.max_drawdown_duration;
    document.getElementById('rolling-volatility-value').textContent = portfolioMetrics.rolling_volatility;
    document.getElementById('rolling-return-value').textContent = portfolioMetrics.rolling_return;
    
    // Benchmark metrics if available
    if (benchmarkMetrics) {
        // Existing benchmark metrics
        document.getElementById('benchmark-cagr-value').textContent = benchmarkMetrics.cagr;
        document.getElementById('benchmark-volatility-value').textContent = benchmarkMetrics.volatility;
        document.getElementById('benchmark-sharpe-value').textContent = benchmarkMetrics.sharpe_ratio;
        document.getElementById('benchmark-max-drawdown-value').textContent = benchmarkMetrics.max_drawdown;
        document.getElementById('benchmark-best-month-value').textContent = benchmarkMetrics.best_month;
        document.getElementById('benchmark-worst-month-value').textContent = benchmarkMetrics.worst_month;
        document.getElementById('benchmark-total-return-value').textContent = benchmarkMetrics.total_return;
        
        // New benchmark metrics
        document.getElementById('benchmark-sortino-ratio-value').textContent = benchmarkMetrics.sortino_ratio;
        document.getElementById('benchmark-calmar-ratio-value').textContent = benchmarkMetrics.calmar_ratio;
        document.getElementById('benchmark-max-drawdown-duration-value').textContent = benchmarkMetrics.max_drawdown_duration;
        document.getElementById('benchmark-rolling-volatility-value').textContent = benchmarkMetrics.rolling_volatility;
        document.getElementById('benchmark-rolling-return-value').textContent = benchmarkMetrics.rolling_return;
        
        // Add color classes to benchmark values - existing metrics
        colorizeValue('benchmark-total-return-value', benchmarkMetrics.total_return);
        colorizeValue('benchmark-cagr-value', benchmarkMetrics.cagr);
        colorizeValue('benchmark-max-drawdown-value', benchmarkMetrics.max_drawdown);
        colorizeValue('benchmark-best-month-value', benchmarkMetrics.best_month);
        colorizeValue('benchmark-worst-month-value', benchmarkMetrics.worst_month);
        
        // Add color classes to benchmark values - new ratio metrics
        colorizeValue('benchmark-sortino-ratio-value', benchmarkMetrics.sortino_ratio);
        colorizeValue('benchmark-calmar-ratio-value', benchmarkMetrics.calmar_ratio);
        colorizeValue('benchmark-rolling-return-value', benchmarkMetrics.rolling_return);
    } else {
        // If no benchmark data, display N/A for all benchmark metrics
        const benchmarkElements = [
            // Existing benchmark metrics
            'benchmark-cagr-value', 'benchmark-volatility-value', 'benchmark-sharpe-value',
            'benchmark-max-drawdown-value', 'benchmark-best-month-value', 'benchmark-worst-month-value',
            'benchmark-total-return-value',
            // New benchmark metrics
            'benchmark-sortino-ratio-value', 'benchmark-calmar-ratio-value', 
            'benchmark-max-drawdown-duration-value', 'benchmark-rolling-volatility-value',
            'benchmark-rolling-return-value'
        ];
        benchmarkElements.forEach(elementId => {
            document.getElementById(elementId).textContent = 'N/A';
        });
    }
    
    // Add color classes to portfolio values - existing metrics
    colorizeValue('total-return-value', portfolioMetrics.total_return);
    colorizeValue('cagr-value', portfolioMetrics.cagr);
    colorizeValue('max-drawdown-value', portfolioMetrics.max_drawdown);
    colorizeValue('best-month-value', portfolioMetrics.best_month);
    colorizeValue('worst-month-value', portfolioMetrics.worst_month);
    
    // Add color classes to portfolio values - new ratio metrics
    colorizeValue('sortino-ratio-value', portfolioMetrics.sortino_ratio);
    colorizeValue('calmar-ratio-value', portfolioMetrics.calmar_ratio);
    colorizeValue('rolling-return-value', portfolioMetrics.rolling_return);
}

/**
 * Create summary view with key metrics
 */
function createSummaryView(portfolioMetrics, benchmarkMetrics) {
    const summaryContainer = document.getElementById('summary-metrics');
    if (!summaryContainer) return;
    
    summaryContainer.innerHTML = ''; // Clear any existing content
    
    // Key metrics to display in the summary
    const keyMetrics = [
        { id: 'total-return', label: 'Total Return', value: portfolioMetrics.total_return },
        { id: 'cagr', label: 'CAGR', value: portfolioMetrics.cagr },
        { id: 'volatility', label: 'Volatility', value: portfolioMetrics.volatility },
        { id: 'sharpe', label: 'Sharpe Ratio', value: portfolioMetrics.sharpe_ratio },
        { id: 'max-drawdown', label: 'Max Drawdown', value: portfolioMetrics.max_drawdown },
        { id: 'sortino', label: 'Sortino Ratio', value: portfolioMetrics.sortino_ratio },
        { id: 'calmar', label: 'Calmar Ratio', value: portfolioMetrics.calmar_ratio },
        { id: 'rolling-return', label: 'TTM Return', value: portfolioMetrics.rolling_return }
    ];
    
    // Add each metric to the summary
    keyMetrics.forEach(metric => {
        const metricElement = document.createElement('div');
        metricElement.className = 'metric-card';
        
        const metricTitle = document.createElement('div');
        metricTitle.className = 'metric-title';
        metricTitle.textContent = metric.label;
        
        const metricValue = document.createElement('div');
        metricValue.className = 'metric-value';
        metricValue.textContent = metric.value;
        
        // Add color class
        if (metric.value !== 'N/A') {
            const numValue = parseFloat(metric.value.replace('%', ''));
            if (!isNaN(numValue)) {
                // For drawdown, negative is actually positive (less drawdown is good)
                if (metric.id === 'max-drawdown') {
                    metricValue.classList.add(numValue > -10 ? 'positive' : 'negative');
                } else {
                    metricValue.classList.add(numValue >= 0 ? 'positive' : 'negative');
                }
            }
        }
        
        const benchmarkValue = document.createElement('div');
        benchmarkValue.className = 'benchmark-value';
        
        if (benchmarkMetrics) {
            const benchmarkKey = metric.id.replace(/-/g, '_');
            const benchmarkMetricValue = benchmarkMetrics[benchmarkKey] || 'N/A';
            benchmarkValue.textContent = `Benchmark: ${benchmarkMetricValue}`;
        } else {
            benchmarkValue.textContent = 'Benchmark: N/A';
        }
        
        metricElement.appendChild(metricTitle);
        metricElement.appendChild(metricValue);
        metricElement.appendChild(benchmarkValue);
        
        summaryContainer.appendChild(metricElement);
    });
}

/**
 * Add positive/negative color classes to values
 */
function colorizeValue(elementId, value) {
    const element = document.getElementById(elementId);
    element.classList.remove('positive', 'negative');
    
    if (value !== 'N/A') {
        // Extract numeric part from percentage string
        const numValue = parseFloat(value.replace('%', ''));
        
        if (!isNaN(numValue)) {
            // For drawdown, negative is actually positive (less drawdown is good)
            if (elementId === 'max-drawdown-value' || elementId === 'benchmark-max-drawdown-value') {
                element.classList.add(numValue > -10 ? 'positive' : 'negative');
            } else {
                element.classList.add(numValue >= 0 ? 'positive' : 'negative');
            }
        }
    }
}

/**
 * Download returns CSV with portfolio and benchmark data
 */
function downloadReturns() {
    showLoading(true);
    
    // Gather form data
    const formData = getFormData();
    
    // Validate form data
    if (!formData) {
        showLoading(false);
        return;
    }
    
    // Get the benchmark ticker
    const benchmarkTicker = formData.benchmark_ticker;
    
    // Construct URL with query parameters
    const url = `/download_returns?tickers=${formData.tickers.join(',')}&weights=${formData.weights.join(',')}&start_date=${formData.start_date}&end_date=${formData.end_date}&benchmark_ticker=${benchmarkTicker}`;
    
    // Create filename with benchmark ticker
    const filename = `portfolio_vs_${benchmarkTicker}_returns.csv`;
    
    // Create temporary link to download the file
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.download = filename;
    
    // Append to document, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showLoading(false);
}
