import os
import logging
import re # Import regex module
from flask import Flask, jsonify, current_app # Removed unused imports
# Removed pandas, io, math, datetime, Response, render_template, request imports
# Removed direct analytics imports (now used in blueprint)
from flask_wtf import CSRFProtect
from models import db # Removed CacheEntry import (not used directly here)
from flask.cli import with_appcontext
import click

# Import the blueprint
from portfolio_routes import bp as portfolio_bp

# Constants removed (moved to config.py)
# DATE_FORMAT = '%Y-%m-%d'
# WEIGHT_TOLERANCE = 0.05
# TICKER_REGEX_PATTERN = r"^[A-Z0-9.-]+$"

# Removed validate_portfolio_input function (moved to blueprint)

# --- Application Factory ---
def create_app(test_config=None):
    """Create and configure an instance of the Flask application."""
    app = Flask(__name__, instance_relative_config=True)

    # --- Configuration ---
    app.config.from_mapping(
        BENCHMARK_TICKER=os.getenv("BENCHMARK_TICKER", "SPY"),
        SQLALCHEMY_DATABASE_URI=os.getenv("DATABASE_URL"),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        # Removed constants from here - they are loaded via from_pyfile
        # DATE_FORMAT=DATE_FORMAT,
        # WEIGHT_TOLERANCE=WEIGHT_TOLERANCE,
        # TICKER_REGEX_PATTERN=TICKER_REGEX_PATTERN
    )

    if test_config is None:
        # Load the instance config (config.py), if it exists
        # This will load DATE_FORMAT, WEIGHT_TOLERANCE, TICKER_REGEX_PATTERN
        app.config.from_pyfile('config.py', silent=True)
        secret = os.getenv("SESSION_SECRET")
        if not secret:
            raise RuntimeError(
                "SESSION_SECRET environment variable is required. "
                "Export it or add it to .env before starting the app."
            )
        app.config["SECRET_KEY"] = secret
    else:
        app.config.from_mapping(test_config)
        if 'SECRET_KEY' not in app.config:
            raise RuntimeError('SECRET_KEY must be set in test_config')

    # --- CSRF ---
    csrf = CSRFProtect()
    csrf.init_app(app)

    # --- Logging ---
    logging.basicConfig(level=logging.DEBUG)
    gunicorn_logger = logging.getLogger('gunicorn.error')
    if gunicorn_logger.handlers: # Check if handlers exist
        app.logger.handlers = gunicorn_logger.handlers
        app.logger.setLevel(gunicorn_logger.level)
    else:
         app.logger.setLevel(logging.DEBUG)

    app.logger.info('Flask app created')

    # --- Initialize Extensions ---
    db.init_app(app)

    # --- Database Migrations Info ---
    if not app.config.get('SQLALCHEMY_DATABASE_URI'):
        app.logger.warning("DATABASE_URL not set. Database features (caching) will be disabled.")
    else:
       app.logger.info("Database configured. Use 'flask db upgrade' to initialize/update schema.")

    # --- Register Error Handlers ---
    @app.errorhandler(400)
    def bad_request(error):
        # Ensure error has a description attribute, default if not
        error_desc = getattr(error, 'description', str(error))
        return jsonify(error=error_desc), 400

    @app.errorhandler(404)
    def not_found(error):
        error_desc = getattr(error, 'description', "Not Found: The requested URL was not found on the server.")
        return jsonify(error=error_desc), 404

    @app.errorhandler(500)
    def internal_server_error(error):
        app.logger.error(f"Internal Server Error: {error}", exc_info=True)
        # Use a generic error message for 500 responses
        return jsonify(error="Internal Server Error: An unexpected error occurred."), 500

    # --- Register Blueprints ---
    app.register_blueprint(portfolio_bp)
    # Add other blueprints here if needed

    # Removed route definitions (index, analyze_portfolio, download_returns)
    # Removed _clean helper function

    # Return the configured app instance
    return app

# --- Main Execution ---
if __name__ == "__main__":
    app = create_app()
    is_debug = os.environ.get('FLASK_DEBUG') == '1'
    app.run(host="0.0.0.0", port=5000, debug=is_debug)
