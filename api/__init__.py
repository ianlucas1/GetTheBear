"""
API Blueprint package for GetTheBear.
This package organizes the application's routes into logical sections.
"""

from flask import Blueprint

# Create main API blueprint
api_bp = Blueprint('api', __name__)

# Import routes from modules
from . import portfolio, auth, user

# Note: The imports are at the bottom to avoid circular imports 