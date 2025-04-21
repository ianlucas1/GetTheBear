# analytics/caching.py
import json
import hashlib
from datetime import timedelta

# Cache duration (e.g., 1 day)
CACHE_DURATION = timedelta(days=1)

# --- Helper Function for Cache Key ---
def generate_cache_key(prefix, params):
    """Generates a deterministic cache key (SHA256 hash)."""
    # Sort params dict by key for consistent hashing
    sorted_params_str = json.dumps(params, sort_keys=True)
    key_string = f"{prefix}:{sorted_params_str}"
    return hashlib.sha256(key_string.encode('utf-8')).hexdigest() 