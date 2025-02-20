require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const NodeCache = require('node-cache');

const app = express();
let port = parseInt(process.env.PORT || '3001', 10); // Explicitly parse as integer

const routeCache = new NodeCache({ stdTTL: 3600 }); // Cache for 1 hour

// Update CORS configuration to be more specific
app.use(cors({
  origin: 'http://localhost:3000',  // Frontend URL
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Find midpoint and POIs using OpenRouteService
app.post('/api/find-midpoint', async (req, res) => {
  try {
    const { location1, location2 } = req.body;
    const orsApiKey = process.env.ORS_API_KEY;

    // Get coordinates for both locations using ORS geocoding
    const [loc1Response, loc2Response] = await Promise.all([
      axios.get(`https://api.openrouteservice.org/geocode/search?api_key=${orsApiKey}&text=${encodeURIComponent(location1)}`),
      axios.get(`https://api.openrouteservice.org/geocode/search?api_key=${orsApiKey}&text=${encodeURIComponent(location2)}`)
    ]);

    const point1 = loc1Response.data.features[0].geometry.coordinates;
    const point2 = loc2Response.data.features[0].geometry.coordinates;

    // Get route between points
    const routeResponse = await axios.post(
      'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
      {
        coordinates: [point1, point2]
      },
      {
        headers: {
          'Authorization': orsApiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    // Calculate midpoint from the route
    const coordinates = routeResponse.data.features[0].geometry.coordinates;
    const midIndex = Math.floor(coordinates.length / 2);
    const midpoint = coordinates[midIndex];

    // Search for POIs near midpoint using ORS
    const poisResponse = await axios.post(
      'https://api.openrouteservice.org/pois',
      {
        request: 'pois',
        geojson: {
          type: 'Point',
          coordinates: midpoint
        },
        filters: {
          category_ids: [569], // restaurants
        },
        radius: 2000
      },
      {
        headers: {
          'Authorization': orsApiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      midpoint: {
        lat: midpoint[1],
        lng: midpoint[0]
      },
      places: poisResponse.data.features.map(feature => ({
        name: feature.properties.name,
        location: {
          lat: feature.geometry.coordinates[1],
          lng: feature.geometry.coordinates[0]
        },
        category: feature.properties.category_name
      }))
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Update the calculate-drive-time endpoint
app.post('/api/calculate-drive-time', async (req, res) => {
  try {
    const { startPoint, endPoint } = req.body;
    const response = await axios({
      method: 'post',
      url: 'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
      headers: {
        'Authorization': process.env.ORS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      data: {
        coordinates: [
          [startPoint.lng, startPoint.lat],
          [endPoint.lng, endPoint.lat]
        ]
      }
    });

    if (response.data.features && 
        response.data.features[0] && 
        response.data.features[0].properties && 
        response.data.features[0].properties.segments) {
      const duration = Math.round(response.data.features[0].properties.segments[0].duration / 60);
      res.json({ duration });
    } else {
      res.json({ duration: 'Unknown' });
    }
  } catch (error) {
    console.error('Drive time calculation error:', error);
    res.status(500).json({ duration: 'Unknown' });
  }
});

app.post('/api/route', async (req, res) => {
  const cacheKey = `route-${JSON.stringify(req.body)}`;
  const cachedResult = routeCache.get(cacheKey);
  
  if (cachedResult) {
    return res.json(cachedResult);
  }

  // ... calculate route
  routeCache.set(cacheKey, result);
  res.json(result);
});

const startServer = (portNumber) => {
  app.listen(portNumber, () => {
    console.log(`Server running on port ${portNumber}`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${portNumber} is busy, trying ${portNumber + 1}`);
      startServer(portNumber + 1);
    } else {
      console.error(err);
    }
  });
};

startServer(port); 