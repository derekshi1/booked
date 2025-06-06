from flask import Blueprint, jsonify
from ..series_recommendations import get_series_recommendations

series_bp = Blueprint('series', __name__)

@series_bp.route('/api/series-recommendations', methods=['GET'])
def series_recommendations():
    """API endpoint for series recommendations."""
    result = get_series_recommendations()
    return jsonify(result) 