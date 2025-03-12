from flask import Flask, request, jsonify
from flask_cors import CORS  # Allows frontend to call backend
import os
from utils.geocoding import geocode_address
from utils.routing import calculate_midpoint

app = Flask(__name__)
CORS(app)  # Enable Cross-Origin Resource Sharing

@app.route('/api/midpoint', methods=['POST'])
def midpoint():
    data = request.json
    location1 = data.get('location1')
    location2 = data.get('location2')

    if not location1 or not location2:
        return jsonify({'error': 'Missing locations'}), 400

    coords1 = geocode_address(location1)
    coords2 = geocode_address(location2)

    if not coords1 or not coords2:
        return jsonify({'error': 'Invalid locations'}), 400

    midpoint = calculate_midpoint(coords1, coords2)
    
    return jsonify({'midpoint': midpoint})

if __name__ == '__main__':
    app.run(debug=True, port=5001)
