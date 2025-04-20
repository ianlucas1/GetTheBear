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

# Import the blueprint and config
from portfolio_routes import bp as portfolio_bp
from config import ActiveConfig # Import the active config

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
    if test_config is None:
        # Load configuration from config.py based on FLASK_CONFIG env var
        app.config.from_object(ActiveConfig)

        # --- Runtime Production Checks ---
        # Check for essential configs ONLY when running in a non-testing, non-debug context
        if not app.testing and not app.debug:
            # Check SECRET_KEY (should not be the default value)
            if app.config.get('SECRET_KEY') == 'default-secret-key-for-dev-change-me':
                raise RuntimeError(
                    "FATAL: SESSION_SECRET environment variable must be set and different from the default in production."
                )
            # Check DATABASE_URL (should exist and not be the default SQLite path if a real DB is expected)
            db_uri = app.config.get('SQLALCHEMY_DATABASE_URI')
            if not db_uri or 'instance/dev.db' in db_uri: # Check if it's missing or still the default SQLite
                # You might want to make this check more specific if using SQLite in prod is acceptable
                app.logger.warning("Potential Production Issue: DATABASE_URL is not set or uses the default SQLite path.")
                # Uncomment the line below to make a non-default DATABASE_URL mandatory for production:
                # raise RuntimeError("FATAL: DATABASE_URL environment variable must be set to a non-default value in production.")
    else:
        # Load the test configuration if passed in
        app.config.from_mapping(test_config)
        # Ensure test config provides essential keys if overriding
        if 'SECRET_KEY' not in app.config:
            raise RuntimeError('SECRET_KEY must be set in test_config')
        if 'SQLALCHEMY_DATABASE_URI' not in app.config:
            # Use testing default if not provided explicitly in test_config
            app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        if 'BENCHMARK_TICKER' not in app.config:
             app.config['BENCHMARK_TICKER'] = 'SPY' # Default for tests


    # --- CSRF ---
    csrf = CSRFProtect()
    csrf.init_app(app)

    # --- Logging ---
    # Configure logging based on environment
    log_level = logging.DEBUG if app.debug else logging.INFO
    log_format = '[%(asctime)s] %(levelname)s in %(module)s: %(message)s'

    # Check for Gunicorn logger first
    gunicorn_logger = logging.getLogger('gunicorn.error')
    if gunicorn_logger.handlers and len(gunicorn_logger.handlers) > 0:
        # Use Gunicorn's handlers and level if available
        app.logger.handlers = gunicorn_logger.handlers
        app.logger.setLevel(gunicorn_logger.level)
        # Optionally, apply consistent format to gunicorn handler(s)
        for handler in app.logger.handlers:
             handler.setFormatter(logging.Formatter(log_format))
        app.logger.info("Inherited Gunicorn logger configuration.")
    else:
        # If not running with Gunicorn or Gunicorn logger not configured, set up default stream handler
        stream_handler = logging.StreamHandler()
        stream_handler.setFormatter(logging.Formatter(log_format))
        # Remove default Flask handlers if they exist
        # for handler in app.logger.handlers[:]:
        #      app.logger.removeHandler(handler)
        if not app.logger.handlers: # Add handler only if no other handlers are present
            app.logger.addHandler(stream_handler)
            app.logger.setLevel(log_level)
            app.logger.info(f"Configured default stream logger at level {logging.getLevelName(log_level)}.")

    app.logger.info(f"Flask app '{app.name}' created with config: {type(ActiveConfig).__name__}")

    # --- Initialize Extensions ---
    db.init_app(app)

    # --- Database Migrations Info ---
    if not app.config.get('SQLALCHEMY_DATABASE_URI') or 'sqlite:///:memory:' in app.config.get('SQLALCHEMY_DATABASE_URI'):
        if not app.testing: # Don't warn during tests using in-memory db
             app.logger.warning("DATABASE_URL not set or using in-memory DB. Database features (caching) may be limited or disabled.")
    else:
       app.logger.info(f"Database configured at {app.config.get('SQLALCHEMY_DATABASE_URI')}. Use 'flask db upgrade' to initialize/update schema.")

    # --- Register Error Handlers ---
    @app.errorhandler(400)
    def bad_request(error):
        # Ensure error has a description attribute, default if not
        error_desc = getattr(error, 'description', str(error))
        app.logger.warning(f"Bad Request (400): {error_desc}") # Log 400 errors
        return jsonify(error=error_desc), 400

    @app.errorhandler(404)
    def not_found(error):
        error_desc = getattr(error, 'description', "Not Found: The requested URL was not found on the server.")
        app.logger.warning(f"Not Found (404): {error_desc} - URL: {request.url if 'request' in globals() else 'N/A'}") # Log 404
        return jsonify(error=error_desc), 404

    @app.errorhandler(500)
    def internal_server_error(error):
        # Log the exception with traceback
        app.logger.error(f"Internal Server Error (500): {error}", exc_info=True)
        # Use a generic error message for 500 responses
        return jsonify(error="Internal Server Error: An unexpected error occurred."), 500

    # --- Register Blueprints ---
    app.register_blueprint(portfolio_bp)
    app.logger.info(f"Registered blueprint: {portfolio_bp.name}")
    # Add other blueprints here if needed

    # --- App Context Processor (Optional: make config accessible in templates) ---
    # @app.context_processor
    # def inject_config():
    #     return dict(config=app.config)

    # Removed route definitions (index, analyze_portfolio, download_returns)
    # Removed _clean helper function

    # Return the configured app instance
    app.logger.info("Flask app configuration complete.")
    return app

# --- Main Execution ---
# Use 'flask run' command instead of this block for development server
# The 'flask run' command uses the app factory automatically
if __name__ == "__main__":
    # This block might still be useful for specific deployment scenarios (e.g., simple scripts)
    # But typically 'flask run' or a WSGI server (like gunicorn) is preferred.
    print("Starting Flask app directly via app.py (Use 'flask run' or a WSGI server for most cases)")
    app = create_app()
    # Debug and host settings are now primarily controlled by FLASK_DEBUG env var and 'flask run' args
    # app.run() # Basic run, often needs host/port/debug adjusted
    app.run(host="0.0.0.0", port=5000) # Keep explicit host/port for direct run case
