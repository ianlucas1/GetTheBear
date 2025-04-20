"""
Portfolio API endpoints.
Handles creating, retrieving, updating and analyzing portfolios.
"""

from flask import jsonify, request, current_app
from . import api_bp
from models import db, Portfolio, Security

@api_bp.route('/portfolios', methods=['GET'])
def get_portfolios():
    """Get all portfolios for the current user."""
    # TODO: Add user authentication
    portfolios = Portfolio.query.all()
    return jsonify([p.to_dict() for p in portfolios])

@api_bp.route('/portfolios', methods=['POST'])
def create_portfolio():
    """Create a new portfolio."""
    data = request.get_json()
    
    if not data or 'name' not in data:
        return jsonify({'error': 'Name is required'}), 400
        
    portfolio = Portfolio(
        name=data['name'],
        description=data.get('description', '')
    )
    
    db.session.add(portfolio)
    db.session.commit()
    
    return jsonify(portfolio.to_dict()), 201

@api_bp.route('/portfolios/<int:id>', methods=['GET'])
def get_portfolio(id):
    """Get a specific portfolio by ID."""
    portfolio = Portfolio.query.get_or_404(id)
    return jsonify(portfolio.to_dict())

@api_bp.route('/portfolios/<int:id>/analysis', methods=['GET'])
def analyze_portfolio(id):
    """Run portfolio analysis for a specific portfolio."""
    portfolio = Portfolio.query.get_or_404(id)
    securities = portfolio.securities
    
    # TODO: Implement actual portfolio analysis 
    # This would use the analytics module
    
    return jsonify({
        'portfolio': portfolio.to_dict(),
        'analysis': {
            'sharpe_ratio': 1.2,
            'sortino_ratio': 1.5,
            'max_drawdown': -0.15,
            'annualized_return': 0.08
        }
    }) 