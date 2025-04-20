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
    # Install runtime and development dependencies using pip and pyproject.toml
    pip install -e ".[dev]" 
    # If using uv, you might use: uv pip install -e ".[dev]"
    ```

4.  **Environment Variables:**
    *   Create a `.env` file in the root directory.
    *   Add required environment variables (example below):
        ```dotenv
        # Flask secret key (change this to a random string)
        SESSION_SECRET="your-very-strong-random-secret-key"

        # Optional: Override default benchmark
        # BENCHMARK_TICKER="VT"

        # Database connection string (required for caching)
        # Example for PostgreSQL:
        # DATABASE_URL="postgresql://user:password@host:port/database"
        # Example for SQLite (relative path):
        DATABASE_URL="sqlite:///instance/dev.db"
        ```

5.  **Database Setup (using Flask-Migrate):**
    *   Ensure the `DATABASE_URL` is set in your `.env` file.
    *   Initialize the database and apply migrations:
        ```bash
        # One-time setup if the 'migrations' folder doesn't exist:
        # flask db init 

        # Create an initial migration (or subsequent migrations if models change):
        # flask db migrate -m "Initial migration with CacheEntry model."

        # Apply the migration to the database:
        flask db upgrade
        ```
    *   Run `flask db migrate` and `flask db upgrade` whenever you change your SQLAlchemy models (`models.py`).

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
*   **Database Cache:** The application uses Flask-SQLAlchemy for caching analysis results to a database.
    *   It requires the `DATABASE_URL` environment variable to be set with a valid SQLAlchemy connection string (e.g., `postgresql://...` or `sqlite:///instance/dev.db`).
    *   Database schema setup and updates are managed using **Flask-Migrate**. You must run `flask db upgrade` after setting up your environment or pulling changes that include database model updates (see Database Setup section).
    *   While tested with PostgreSQL (requires `psycopg2-binary`), it uses a generic JSON type and should work with other SQLAlchemy-supported databases like SQLite.

## TODO / Future Enhancements

*   Implement more comprehensive backend tests (unit, integration). (Current `tests/` directory exists).
*   Further enhance input validation edge cases. (Basic validation exists).
*   Add user accounts/authentication.
*   Improve UI/UX further.
*   Database migration management is implemented via Flask-Migrate.
