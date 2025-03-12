import axios from 'axios';

// Test the OpenRouteService API directly
const testOpenRouteService = async () => {
  const apiKey = '5b3ce3597851110001cf6248a8b984eb515fa269ac654f12dd724bd41a5e9491c301496e0c2bb558';
  
  try {
    console.log('Testing geocoding...');
    const geocodeResponse = await axios.get(
      'https://api.openrouteservice.org/geocode/search',
      {
        params: {
          api_key: apiKey,
          text: 'New York, NY',
          'boundary.country': 'US'
        }
      }
    );
    
    console.log('Geocoding response:', geocodeResponse.data);
    
    if (geocodeResponse.data.features?.length > 0) {
      const [lng, lat] = geocodeResponse.data.features[0].geometry.coordinates;
      console.log('Coordinates:', { lat, lng });
      
      console.log('Testing routing...');
      const routeResponse = await axios.post(
        'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
        {
          coordinates: [
            [lng, lat],
            [-73.9857, 40.7484] // Times Square coordinates
          ]
        },
        {
          headers: {
            'Authorization': apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Routing response:', routeResponse.data);
    }
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
};

// Run the test
testOpenRouteService();

export default testOpenRouteService; 