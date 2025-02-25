/**
 * Utility functions for location-based operations
 */

import axios from 'axios';

/**
 * Calculates the midpoint between two locations
 * @param {string} location1 - First location address or coordinates
 * @param {string} location2 - Second location address or coordinates
 * @returns {Object} Midpoint coordinates {lat, lng}
 */
export const calculateMidpoint = async (location1, location2) => {
  try {
    // First, geocode the locations if they're not already coordinates
    const loc1Coords = await geocodeLocation(location1);
    const loc2Coords = await geocodeLocation(location2);
    
    // Calculate the midpoint
    const lat = (loc1Coords.lat + loc2Coords.lat) / 2;
    const lng = (loc1Coords.lng + loc2Coords.lng) / 2;
    
    return { lat, lng };
  } catch (error) {
    console.error('Error calculating midpoint:', error);
    throw new Error('Failed to calculate midpoint between locations');
  }
};

/**
 * Geocodes an address to coordinates
 * @param {string} address - The address to geocode
 * @returns {Object} Coordinates {lat, lng}
 */
export const geocodeLocation = async (address) => {
  // If the address is already in coordinate format (lat,lng), parse it
  if (/^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/.test(address)) {
    const [lat, lng] = address.split(',').map(coord => parseFloat(coord.trim()));
    return { lat, lng };
  }
  
  try {
    // Use Nominatim (OpenStreetMap) for geocoding
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: address,
        format: 'json',
        limit: 1
      },
      headers: {
        'User-Agent': 'MeetInTheMiddle/1.0'
      }
    });
    
    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon)
      };
    } else {
      throw new Error(`Location not found: ${address}`);
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    throw new Error(`Failed to geocode address: ${address}`);
  }
};

/**
 * Fetches places near a given location
 * @param {Object} location - The location coordinates {lat, lng}
 * @param {number} radius - Search radius in kilometers (default: 1)
 * @param {string} type - Type of places to search for (default: 'restaurant')
 * @returns {Array} Array of place objects
 */
export const fetchPlaces = async (location, radius = 1, type = 'restaurant') => {
  try {
    // Use Overpass API (OpenStreetMap) to find places
    const query = `
      [out:json];
      node["amenity"="${type}"](around:${radius * 1000},${location.lat},${location.lng});
      out body;
    `;
    
    const response = await axios.post('https://overpass-api.de/api/interpreter', query, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    if (response.data && response.data.elements) {
      return response.data.elements.map(element => ({
        id: element.id,
        name: element.tags.name || 'Unnamed Place',
        location: {
          lat: element.lat,
          lng: element.lon
        },
        category: type,
        address: element.tags['addr:street'] ? 
          `${element.tags['addr:housenumber'] || ''} ${element.tags['addr:street'] || ''}` : 
          'No address available',
        // Mock drive times for demo purposes
        driveTimes: {
          from1: Math.floor(Math.random() * 30) + 5,
          from2: Math.floor(Math.random() * 30) + 5
        },
        // Generate map links
        mapLinks: {
          google: `https://www.google.com/maps/search/?api=1&query=${element.lat},${element.lon}`,
          apple: `https://maps.apple.com/?q=${element.lat},${element.lon}`,
          waze: `https://waze.com/ul?ll=${element.lat},${element.lon}&navigate=yes`
        }
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching places:', error);
    return [];
  }
};

/**
 * Calculates the distance between two points in kilometers
 * @param {Object} point1 - First point coordinates {lat, lng}
 * @param {Object} point2 - Second point coordinates {lat, lng}
 * @returns {number} Distance in kilometers
 */
export const calculateDistance = (point1, point2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (point2.lat - point1.lat) * Math.PI / 180;
  const dLon = (point2.lng - point1.lng) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return distance;
};

/**
 * Calculates bounds for a set of points
 * @param {Array} points - Array of [lat, lng] coordinates
 * @returns {Array} Bounds in format [[south, west], [north, east]]
 */
export const calculateBoundsForPoints = (points) => {
  if (!points || points.length === 0) {
    return [[0, 0], [0, 0]];
  }
  
  let minLat = points[0][0];
  let maxLat = points[0][0];
  let minLng = points[0][1];
  let maxLng = points[0][1];
  
  points.forEach(point => {
    minLat = Math.min(minLat, point[0]);
    maxLat = Math.max(maxLat, point[0]);
    minLng = Math.min(minLng, point[1]);
    maxLng = Math.max(maxLng, point[1]);
  });
  
  // Add padding
  const latPadding = (maxLat - minLat) * 0.1;
  const lngPadding = (maxLng - minLng) * 0.1;
  
  return [
    [minLat - latPadding, minLng - lngPadding],
    [maxLat + latPadding, maxLng + lngPadding]
  ];
}; 