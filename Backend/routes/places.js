const express = require('express');
const axios = require('axios');
const router = express.Router();

// Find nearby places of interest
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lon, radius = 1500, types = 'restaurant,cafe,bar,park' } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }
    
    // Use Overpass API to find POIs (similar to the Python backend)
    const overpassUrl = "https://overpass-api.de/api/interpreter";
    const typeArray = types.split(',');
    
    // Build the Overpass query
    let overpassQuery = `
      [out:json][timeout:25];
      (
    `;
    
    // Add each type to the query
    typeArray.forEach(type => {
      overpassQuery += `
        node["amenity"="${type}"](around:${radius},${lat},${lon});
        way["amenity"="${type}"](around:${radius},${lat},${lon});
      `;
    });
    
    overpassQuery += `
      );
      out body;
      >;
      out skel qt;
    `;
    
    const response = await axios.post(overpassUrl, { data: overpassQuery });
    
    if (response.data && response.data.elements) {
      const pois = response.data.elements
        .filter(element => element.tags)
        .map(element => ({
          id: element.id,
          type: element.tags.amenity || element.tags.shop || element.tags.leisure || 'place',
          name: element.tags.name || 'Unnamed Location',
          lat: element.lat,
          lon: element.lon,
          address: element.tags['addr:street'] ? 
            `${element.tags['addr:housenumber'] || ''} ${element.tags['addr:street'] || ''}` : 
            (element.tags.address || '')
        }));
      
      return res.json({ pois });
    } else {
      return res.json({ pois: [] });
    }
  } catch (error) {
    console.error('Places API error:', error);
    res.status(500).json({ error: 'Places service error' });
  }
});

module.exports = router; 