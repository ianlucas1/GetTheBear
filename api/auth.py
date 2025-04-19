"""
Authentication API endpoints.
Handles user registration, login, logout, and token management.
"""

from flask import jsonify, request, current_app
from . import api_bp
from models import db, User
from werkzeug.security import generate_password_hash, check_password_hash

@api_bp.route('/auth/register', methods=['POST'])
def register():
    """Register a new user."""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
        
    # Validate required fields
    required_fields = ['username', 'email', 'password']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400
    
    # Check if user already exists
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 400
        
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already taken'}), 400
    
    # Create new user
    user = User(
        username=data['username'],
        email=data['email'],
        password_hash=generate_password_hash(data['password'])
    )
    
    db.session.add(user)
    db.session.commit()
    
    # Don't return the password hash in the response
    user_data = user.to_dict()
    
    return jsonify(user_data), 201

@api_bp.route('/auth/login', methods=['POST'])
def login():
    """Login a user and return a token."""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
        
    # Validate login credentials
    if 'email' not in data or 'password' not in data:
        return jsonify({'error': 'Email and password are required'}), 400
    
    # Find the user
    user = User.query.filter_by(email=data['email']).first()
    if not user or not check_password_hash(user.password_hash, data['password']):
        return jsonify({'error': 'Invalid email or password'}), 401
    
    # Generate token - in a real app, use JWT or similar
    # This is a placeholder for demo purposes
    token = "sample_token_would_be_jwt_in_production"
    
    return jsonify({
        'token': token,
        'user': user.to_dict()
    }) 