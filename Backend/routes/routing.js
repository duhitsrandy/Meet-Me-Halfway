const express = require('express');
const axios = require('axios');
const router = express.Router();

// Environment variables
const ORS_API_KEY = process.env.ORS_API_KEY || '5b3ce3597851110001cf6248a8b984eb515fa269ac654f12dd724bd41a5e9491c301496e0c2bb558';

// Calculate a route between two points
router.post('/', async (req, res) => {
  try {
    const { origin, destination, alternatives } = req.body;
    
    if (!origin || !destination) {
      return res.status(400).json({ error: 'Origin and destination are required' });
    }
    
    // Use OSRM API for routing (similar to the Python backend)
    const response = await axios.get(`https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${destination[1]},${destination[0]}`, {
      params: {
        alternatives: alternatives ? true : false,
        steps: true,
        geometries: 'geojson',
        overview: 'full'
      }
    });
    
    if (response.data && response.data.routes && response.data.routes.length > 0) {
      const routes = response.data.routes.map(route => ({
        distance: route.distance,
        duration: route.duration,
        geometry: route.geometry.coordinates.map(coord => [coord[1], coord[0]]) // Convert to [lat, lon] format
      }));
      
      return res.json({ routes });
    } else {
      return res.status(404).json({ error: 'No route found' });
    }
  } catch (error) {
    console.error('Routing error:', error);
    res.status(500).json({ error: 'Routing service error' });
  }
});

// Proxy for OpenRouteService directions
router.post('/ors', async (req, res) => {
  try {
    const { coordinates, profile = 'driving-car', format = 'geojson' } = req.body;
    
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
      return res.status(400).json({ error: 'Valid coordinates array is required' });
    }
    
    console.log('Routing request:', req.body);
    
    const response = await axios.post(
      `https://api.openrouteservice.org/v2/directions/${profile}/${format}`,
      req.body,
      {
        headers: {
          'Authorization': ORS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8'
        }
      }
    );
    
    console.log('OpenRouteService routing response received');
    return res.json(response.data);
  } catch (error) {
    console.error('OpenRouteService routing error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'OpenRouteService routing error',
      details: error.response?.data || error.message
    });
  }
});

module.exports = router; 