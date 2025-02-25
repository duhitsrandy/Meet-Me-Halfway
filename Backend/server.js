require('dotenv').config();
const express = require('express');
const cors = require('cors');
const NodeCache = require('node-cache');

// Import route modules
const geocodingRoutes = require('./routes/geocoding');
const routingRoutes = require('./routes/routing');
const placesRoutes = require('./routes/places');
const midpointRoutes = require('./routes/midpoint');

const app = express();
let port = parseInt(process.env.PORT || '3001', 10);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// Use route modules
app.use('/api/geocode', geocodingRoutes);
app.use('/api/routing', routingRoutes);
app.use('/api/places', placesRoutes);
app.use('/api/midpoint', midpointRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Server error', 
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
  });
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