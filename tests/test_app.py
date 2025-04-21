import pytest
from app import create_app # Import the factory function
import json # Import json for request data
import pandas as pd # Import pandas for DataFrame operations
import io # For mocking StringIO
from flask import current_app

# Fixtures 'app' and 'client' are used from conftest.py or defined here if needed

# --- Basic Tests ---

def test_index_route(client):
    """Test if the index route ('/') loads successfully."""
    response = client.get('/')
    assert response.status_code == 200
    # Check if some expected text is in the response
    assert b"Portfolio Setup" in response.data

def test_404_not_found(client):
    """Test if accessing a non-existent route returns a 404 JSON error."""
    response = client.get('/non-existent-path')
    assert response.status_code == 404
    assert response.content_type == 'application/json'
    json_data = response.get_json()
    assert 'error' in json_data
    # Make assertion less brittle: check for keyword instead of exact default message
    assert "not found" in json_data['error'].lower()

def test_app_creation(app):
    """Test if the Flask app instance is created."""
    assert app is not None

def test_testing_config(app):
    """Test if the app is loaded with the TestingConfig."""
    assert app.config['TESTING'] is True
    assert not app.config['DEBUG']
    # Check for other testing config values if they are critical
    # assert app.config['WTF_CSRF_ENABLED'] is False # This was moved to test_config in app factory
    assert 'SECRET_KEY' in app.config
    assert 'SQLALCHEMY_DATABASE_URI' in app.config

# Route-specific tests have been moved to tests/test_routes.py