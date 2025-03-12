const express = require('express');
const axios = require('axios');
const router = express.Router();

// Environment variables
const ORS_API_KEY = process.env.ORS_API_KEY || '5b3ce3597851110001cf6248a8b984eb515fa269ac654f12dd724bd41a5e9491c301496e0c2bb558';

// Geocode an address to coordinates
router.post('/', async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }
    
    // Use Nominatim API for geocoding (same as the Python backend)
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
      const location = response.data[0];
      return res.json({
        lat: parseFloat(location.lat),
        lon: parseFloat(location.lon),
        display_name: location.display_name
      });
    } else {
      return res.status(404).json({ error: 'Location not found' });
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({ error: 'Geocoding service error' });
  }
});

// Proxy for OpenRouteService geocoding
router.get('/ors', async (req, res) => {
  try {
    const { text, country } = req.query;
    
    if (!text) {
      return res.status(400).json({ error: 'Text parameter is required' });
    }
    
    const response = await axios.get('https://api.openrouteservice.org/geocode/search', {
      params: {
        api_key: ORS_API_KEY,
        text: text,
        'boundary.country': country || 'US'
      },
      headers: {
        'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8'
      }
    });
    
    console.log('OpenRouteService geocoding response:', response.data);
    return res.json(response.data);
  } catch (error) {
    console.error('OpenRouteService geocoding error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'OpenRouteService geocoding error',
      details: error.response?.data || error.message
    });
  }
});

module.exports = router; 