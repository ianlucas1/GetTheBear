from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.types import JSON # Import generic JSON type
from datetime import datetime, timezone

# Initialize SQLAlchemy object. 
# This will be bound to the Flask app in app.py using db.init_app(app)
db = SQLAlchemy()

class CacheEntry(db.Model):
    """Model for storing cached analysis results."""
    __tablename__ = 'portfolio_cache' # Explicit table name

    # Using a hash of the request parameters as the primary key
    id = db.Column(db.String(64), primary_key=True) 
    
    # Use generic JSON type for broader compatibility (SQLite, PostgreSQL)
    data = db.Column(db.JSON, nullable=False) 
    
    # Timestamp for cache entry creation (UTC)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f'<CacheEntry {self.id}>' 