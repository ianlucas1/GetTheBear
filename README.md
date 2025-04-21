# Get The Bear - Portfolio Analysis Tool

This is a Flask web application designed for analyzing stock portfolio performance against benchmarks.

## Features

*   Input portfolio tickers and weights.
*   Select start and end dates for analysis.
*   Choose a standard benchmark (e.g., SPY) or enter a custom ticker with autocomplete.
*   Calculates various performance metrics (CAGR, Volatility, Sharpe, Sortino, Calmar, Max Drawdown, etc.).
*   Compares portfolio performance against the chosen benchmark.
*   Displays results via tables and interactive charts (Equity Curve, Drawdown, Annual Returns, Allocation, Correlation).
*   Allows downloading of monthly and annual return data as a CSV file.

## Requirements

*   Python 3.11+ (as specified in `pyproject.toml`)
*   A virtual environment tool (e.g., `venv`, `conda`)

## Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/ianlucas1/GetTheBear.git
    cd GetTheBear
    ```

2.  **Create and activate a virtual environment:**
    ```bash
    # Using venv (recommended)
    python -m venv .venv
    source .venv/bin/activate  # On Windows use `.venv\Scripts\activate`
    ```

3.  **Install dependencies:**
    *   This project uses `pyproject.toml` for dependency management.
    *   The `[project.dependencies]` section lists runtime dependencies.
    *   The `[project.optional-dependencies]` section (specifically `dev`) lists development/testing dependencies.
    ```bash
    # Install runtime and development dependencies
    pip install -e ".[dev]" 
    # Alternatively, for production only:
    # pip install -e .
    # If using uv:
    # uv pip install -e ".[dev]"
    ```

4.  **Environment Variables:**
    *   Create a `.env` file in the root directory by copying `.env.example` (if provided) or creating it manually.
    *   Set required environment variables:
        ```dotenv
        # Flask Configuration
        FLASK_CONFIG="development" # or "production", "testing"
        FLASK_DEBUG=1              # 1 for development, 0 for production
        
        # IMPORTANT: Change this to a long, random, secret string!
        SESSION_SECRET="your-very-strong-random-secret-key"

        # Optional: Override default benchmark (default is SPY)
        # BENCHMARK_TICKER="VT"

        # Database connection string (required for caching)
        # See SQLAlchemy documentation for connection string formats.
        # Example for PostgreSQL (requires psycopg2-binary):
        # DATABASE_URL="postgresql://user:password@host:port/database"
        # Example for SQLite (creates instance/dev.db if not set):
        DATABASE_URL="sqlite:///instance/dev.db"
        ```
    *   **Security Note:** Ensure `SESSION_SECRET` is strong and kept private, especially in production. Do not commit the actual secret to version control.

5.  **Database Setup (using Flask-Migrate):**
    *   Ensure the `DATABASE_URL` is correctly set in your `.env` file.
    *   Apply database migrations:
        ```bash
        # Apply any existing migrations to set up the schema
        flask db upgrade
        ```
    *   **When Models Change:** If you modify the SQLAlchemy models (`models.py`), you need to generate a new migration script and apply it:
        ```bash
        flask db migrate -m "Brief description of model changes"
        flask db upgrade
        ```
    *   **Initial Setup:** If the `migrations` folder does not exist, you might need to run `flask db init` once before the first migrate/upgrade.

## Running the Application

1.  Ensure your virtual environment is activated (`source .venv/bin/activate`).
2.  Ensure necessary environment variables are set (e.g., loaded from `.env`).
3.  Run the Flask development server:
    ```bash
    flask run
    # The server will typically run on http://127.0.0.1:5000
    ```
4.  Open your web browser and navigate to the address provided by Flask.

## Configuration Details

*   **Environment:** Set `FLASK_CONFIG` environment variable to `development`, `production`, or `testing` to load the appropriate configuration from `config.py`.
*   **Default Benchmark:** `BENCHMARK_TICKER` in `.env` or defaults to "SPY".
*   **Secret Key:** `SESSION_SECRET` in `.env` is crucial for session security.
*   **Database Cache:** Requires `DATABASE_URL`. Uses Flask-Migrate for schema management. See `models.py` for the `CacheEntry` model.

## Development

*   **Testing:** 
    *   Ensure you have installed the development dependencies (`pip install -e ".[dev]"`).
    *   Run tests from the project root directory using `pytest`:
        ```bash
        pytest
        # Or for more verbose output:
        # pytest -v
        ```
    *   Tests are located in the `tests/` directory and utilize `pytest-flask` and `pytest-mock`.
    *   Current tests cover basic app setup and API endpoint validation (success/failure cases) by mocking the core analysis logic.
*   **Linting/Formatting:** Consider adding tools like `flake8`, `black`, `isort` and integrating them into a pre-commit hook for consistency.

## TODO / Future Enhancements

*   Implement more comprehensive backend tests (unit, integration). (Current `tests/` directory exists).
*   Further enhance input validation edge cases.
*   Add user accounts/authentication.
*   Improve UI/UX further.
*   Database migration management is implemented via Flask-Migrate.

<!-- Test change -->
