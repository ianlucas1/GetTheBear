# Configuration constants

# Date format used for input validation and display
DATE_FORMAT = '%Y-%m-%d'

# Tolerance for checking if portfolio weights sum to 100%
WEIGHT_TOLERANCE = 0.05

# Regex pattern for validating ticker symbols
TICKER_REGEX_PATTERN = r"^[A-Z0-9.-]+$"

# Add other configuration like SECRET_KEY or DATABASE_URL here if not using .env
# Example:
# SECRET_KEY = "your-secret-key-here"
# DATABASE_URL="sqlite:///instance/dev.db" 