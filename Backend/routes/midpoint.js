const express = require('express');
const axios = require('axios');
const router = express.Router();

// Calculate midpoint between two locations
router.post('/', async (req, res) => {
  try {
    const { location1, location2 } = req.body;
    
    if (!location1 || !location2) {
      return res.status(400).json({ error: 'Both locations are required' });
    }
    
    // First, geocode both locations
    const geocodeLocation = async (address) => {
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: address,
          format: 'json',
          limit: 1
        },
        headers: {
          'User-Agent': 'meet-me-halfway-app'
        }
      });
      
      if (response.data && response.data.length > 0) {
        return [
          parseFloat(response.data[0].lat),
          parseFloat(response.data[0].lon)
        ];
      }
      return null;
    };
    
    const point1 = await geocodeLocation(location1);
    const point2 = await geocodeLocation(location2);
    
    if (!point1 || !point2) {
      return res.status(400).json({ error: 'Could not geocode one or both locations' });
    }
    
    // Calculate route between the points
    const routeResponse = await axios.get(
      `https://router.project-osrm.org/route/v1/driving/${point1[1]},${point1[0]};${point2[1]},${point2[0]}`,
      {
        params: {
          steps: true,
          geometries: 'geojson',
          overview: 'full'
        }
      }
    );
    
    if (routeResponse.data && routeResponse.data.routes && routeResponse.data.routes.length > 0) {
      // Get the route coordinates
      const route = routeResponse.data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
      
      // Find the midpoint (approximately halfway along the route)
      const midpointIndex = Math.floor(route.length / 2);
      const midpoint = route[midpointIndex];
      
      // Find nearby POIs
      const nearbyResponse = await axios.get(`http://localhost:3001/api/places/nearby`, {
        params: {
          lat: midpoint[0],
          lon: midpoint[1],
          radius: 1500,
          types: 'restaurant,cafe,bar,park'
        }
      });
      
      return res.json({
        midpoint: midpoint,
        route: route,
        pois: nearbyResponse.data.pois || []
      });
    } else {
      return res.status(404).json({ error: 'Could not calculate route between locations' });
    }
  } catch (error) {
    console.error('Midpoint calculation error:', error);
    res.status(500).json({ error: 'Error calculating midpoint' });
  }
});

module.exports = router; 