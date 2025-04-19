# Get The Bear - Portfolio Analysis Tool

This is a Flask web application designed for analyzing stock portfolio performance against benchmarks.

## Features

*   Input portfolio tickers and weights.
*   Select start and end dates for analysis.
*   Choose a standard benchmark (e.g., SPY) or enter a custom ticker.
*   Calculates various performance metrics (CAGR, Volatility, Sharpe, Max Drawdown, etc.).
*   Compares portfolio performance against the chosen benchmark.
*   Displays results via tables and interactive charts (Equity Curve, Drawdown, Annual Returns, Allocation, Correlation).
*   Allows downloading of monthly and annual return data as a CSV file.

## Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/ianlucas1/GetTheBear.git
    cd GetTheBear
    ```

2.  **Create a virtual environment (recommended):**
    ```bash
    python -m venv .venv
    source .venv/bin/activate  # On Windows use `.venv\Scripts\activate`
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Environment Variables:**
    *   Create a `.env` file in the root directory.
    *   Add required environment variables (example below):
        ```dotenv
        # Flask secret key (change this to a random string)
        SESSION_SECRET="your-very-strong-random-secret-key"

        # Optional: Override default benchmark
        # BENCHMARK_TICKER="VT"

        # Optional: Database connection string if using PostgreSQL cache
        # DATABASE_URL="postgresql://user:password@host:port/database"
        ```

## Running the Application

1.  Ensure your virtual environment is activated.
2.  Run the Flask development server:
    ```bash
    flask run
    # Or directly:
    # python app.py
    ```
3.  Open your web browser and navigate to `http://127.0.0.1:5000` (or the address provided by Flask).

## Configuration

*   **Default Benchmark:** The default benchmark is SPY. This can be overridden by setting the `BENCHMARK_TICKER` environment variable.
*   **Secret Key:** The Flask `SECRET_KEY` is loaded from the `SESSION_SECRET` environment variable. Ensure this is set to a strong, unique value, especially for production.
*   **Database Cache:** The application attempts to connect to a PostgreSQL database for caching if `setup_cache_table()` is called and requires connection details (likely via `DATABASE_URL` environment variable, though implementation details are in `analytics.py`).

## TODO / Future Enhancements

*   Implement comprehensive backend tests (unit, integration).
*   Refactor database interactions (consider SQLAlchemy ORM, migrations).
*   Enhance input validation (tickers, weights).
*   Add user accounts/authentication.
*   Improve UI/UX further. 