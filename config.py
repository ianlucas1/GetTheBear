import os

class Config:
    """Base configuration."""
    SECRET_KEY = os.getenv('SESSION_SECRET', 'default-secret-key-for-dev-change-me')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    DEBUG = False
    TESTING = False

    # Application specific constants
    BENCHMARK_TICKER = os.getenv("BENCHMARK_TICKER", "SPY")
    DATE_FORMAT = '%Y-%m-%d'
    WEIGHT_TOLERANCE = 0.05
    TICKER_REGEX_PATTERN = r"^[A-Z0-9.-]+$"

    # Determine DB URL based on environment or default to SQLite
    DATABASE_URL = os.getenv('DATABASE_URL')
    if not DATABASE_URL:
        # Default to a SQLite database in the instance folder if DATABASE_URL not set
        instance_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance')
        os.makedirs(instance_path, exist_ok=True)
        DATABASE_URL = f"sqlite:///{os.path.join(instance_path, 'dev.db')}"
        print(f"DATABASE_URL not set, defaulting to SQLite at: {DATABASE_URL}") # Use print for visibility

    SQLALCHEMY_DATABASE_URI = DATABASE_URL

class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    # Ensure SECRET_KEY is set strongly in development, even if defaulting
    if Config.SECRET_KEY == 'default-secret-key-for-dev-change-me':
        print("WARNING: Using default SECRET_KEY. Set SESSION_SECRET environment variable.") # Use print

class TestingConfig(Config):
    """Testing configuration."""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.getenv('TEST_DATABASE_URL', 'sqlite:///:memory:')
    SECRET_KEY = 'test-secret-key' # Fixed secret key for tests
    WTF_CSRF_ENABLED = False # Disable CSRF for testing forms

class ProductionConfig(Config):
    """Production configuration."""
    # Ensure SECRET_KEY is set in production
    if not os.getenv('SESSION_SECRET'):
        raise RuntimeError("FATAL: SESSION_SECRET environment variable must be set in production.")
    # Ensure DATABASE_URL is set in production
    if not os.getenv('DATABASE_URL'):
        raise RuntimeError("FATAL: DATABASE_URL environment variable must be set in production.")

# Function to get the appropriate config based on environment variable
def get_config():
    config_name = os.getenv('FLASK_CONFIG', 'development').lower()
    if config_name == 'production':
        return ProductionConfig
    elif config_name == 'testing':
        return TestingConfig
    else: # Default to development
        return DevelopmentConfig

# Load the configuration object
ActiveConfig = get_config() 