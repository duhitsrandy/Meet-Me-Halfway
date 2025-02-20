import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

// Fix for default marker icon in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const MapComponent = lazy(() => import('./components/MapComponent').then(module => {
  return { default: module.default };
}));

class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div className="error">Something went wrong. Please try again.</div>;
    }
    return this.props.children;
  }
}

function App() {
  const [location1, setLocation1] = useState('');
  const [location2, setLocation2] = useState('');
  const [mapCenter, setMapCenter] = useState([40.7128, -74.0060]); // NYC default
  const [midpoint, setMidpoint] = useState(null);
  const [places, setPlaces] = useState([]);
  const [error, setError] = useState(null);
  const [startPoints, setStartPoints] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState(null);
  const [mapBounds, setMapBounds] = useState(null);
  const [poiCategories] = useState([
    { id: 'restaurant', name: 'Restaurants', orsCategory: 569 },
    { id: 'cafe', name: 'Cafes', orsCategory: 567 },
    { id: 'bar', name: 'Bars', orsCategory: 564 },
    { id: 'park', name: 'Parks', orsCategory: 620 },
    { id: 'shopping', name: 'Shopping', orsCategory: 579 },
    { id: 'entertainment', name: 'Entertainment', orsCategory: 622 },
    { id: 'hotel', name: 'Hotels', orsCategory: 563 },
    { id: 'parking', name: 'Parking', orsCategory: 571 }
  ]);
  const [alternateRouteCoordinates, setAlternateRouteCoordinates] = useState(null);
  const [alternateMidpoint, setAlternateMidpoint] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState('main'); // 'main' or 'alternate'
  const [loadingPOIs, setLoadingPOIs] = useState(false);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [arePlacesLoading, setArePlacesLoading] = useState(true);

  // Add this near the top of your component
  const driveTimeCache = new Map();

  // Add validation state
  const [formErrors, setFormErrors] = useState({
    location1: '',
    location2: ''
  });

  // Add dark mode state
  const [darkMode, setDarkMode] = useState(() => {
    // Check if there's a saved preference, otherwise default to light mode
    const savedMode = localStorage.getItem('darkMode');
    return savedMode ? JSON.parse(savedMode) : false;
  });

  // Add useEffect to handle theme changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  // Add validation function
  const validateForm = () => {
    const errors = {
      location1: '',
      location2: ''
    };
    
    if (!location1.trim()) {
      errors.location1 = 'Please enter the first location';
    }
    if (!location2.trim()) {
      errors.location2 = 'Please enter the second location';
    }
    
    setFormErrors(errors);
    return !errors.location1 && !errors.location2;
  };

  const geocodeLocation = async (location) => {
    try {
      console.log('Geocoding location:', location);
      const response = await axios.get(
        'https://api.openrouteservice.org/geocode/search',
        {
          params: {
            api_key: process.env.REACT_APP_ORS_API_KEY,
            text: location,
            'boundary.country': 'US'
          }
        }
      );
      
      if (response.data.features && response.data.features.length > 0) {
        const [lng, lat] = response.data.features[0].geometry.coordinates;
        console.log('Geocoded coordinates:', { lat, lng });
        return { lat, lng };
      }
      throw new Error('Location not found');
    } catch (error) {
      console.error('Geocoding error:', error);
      throw new Error(`Could not find location. Please try a different address.`);
    }
  };

  const calculateBestMidpoint = (coordinates) => {
    const percentages = [0.3, 0.4, 0.45, 0.5, 0.55, 0.6, 0.7];
    let bestPoint = null;
    
    // For now, we'll use the 50% point, but this could be enhanced
    // to calculate actual travel times like the Python version
    const midIndex = Math.floor(coordinates.length * 0.5);
    const [midLng, midLat] = coordinates[midIndex];
    
    return { lat: midLat, lng: midLng };
  };

  const generateMapLinks = (lat, lng, name, address) => {
    const encodedName = encodeURIComponent(name);
    const encodedAddress = encodeURIComponent(`${name}, ${address || ''}`);
    return {
      google: `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`,
      apple: `http://maps.apple.com/?address=${encodedAddress}`,
      waze: `https://waze.com/ul?q=${encodedAddress}&navigate=yes`
    };
  };

  // Add this helper function for the Haversine calculation
  const calculateDistance = (point1, point2) => {
    const R = 6371; // Earth's radius in km
    const lat1 = point1.lat * Math.PI / 180;
    const lat2 = point2.lat * Math.PI / 180;
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLon = (point2.lng - point1.lng) * Math.PI / 180;

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
             Math.cos(lat1) * Math.cos(lat2) *
             Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    // Adjust speed based on distance
    let avgSpeed;
    if (distance < 5) {
      avgSpeed = 40; // City driving
    } else if (distance < 20) {
      avgSpeed = 55; // Mixed roads
    } else {
      avgSpeed = 70; // Highway
    }

    return Math.round((distance / avgSpeed) * 60);
  };

  // Memoize the drive time calculation
  const calculateDriveTime = useCallback(async (startPoint, endPoint) => {
    const cacheKey = `${startPoint.lat},${startPoint.lng}-${endPoint.lat},${endPoint.lng}`;
    
    if (driveTimeCache.has(cacheKey)) {
      return driveTimeCache.get(cacheKey);
    }

    try {
      const estimatedMinutes = calculateDistance(startPoint, endPoint);
      const variation = (Math.random() * 0.2) - 0.1;
      const adjustedTime = Math.round(estimatedMinutes * (1 + variation));
      
      driveTimeCache.set(cacheKey, adjustedTime);
      return adjustedTime;
    } catch (error) {
      console.error('Error calculating drive time:', error);
      return 'Unknown';
    }
  }, []);

  const getDriveTimeClass = (minutes) => {
    if (minutes < 15) return 'quick';
    if (minutes < 30) return 'moderate';
    return 'long';
  };

  // Add debounce utility
  const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  // Debounce geocoding requests
  const debouncedGeocode = useCallback(
    debounce(async (location) => {
      try {
        const result = await geocodeLocation(location);
        return result;
      } catch (error) {
        console.error('Geocoding error:', error);
      }
    }, 300),
    []
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    console.log('Starting handleSubmit with locations:', { location1, location2 });
    
    try {
      // Geocode both locations
      console.log('Attempting to geocode locations...');
      const point1 = await geocodeLocation(location1);
      console.log('Point 1:', point1);
      const point2 = await geocodeLocation(location2);
      console.log('Point 2:', point2);

      // Store start points
      setStartPoints([
        { 
          name: location1,
          location: point1,
          category: 'Start Location'
        },
        {
          name: location2,
          location: point2,
          category: 'Start Location'
        }
      ]);

      // Get main route (fastest route)
      const mainRouteResponse = await axios.post(
        'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
        {
          coordinates: [
            [point1.lng, point1.lat],
            [point2.lng, point2.lat]
          ]
        },
        {
          headers: {
            'Authorization': process.env.REACT_APP_ORS_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );

      // Get alternate route with different parameters
      const alternateRouteResponse = await axios.post(
        'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
        {
          coordinates: [[point1.lng, point1.lat], [point2.lng, point2.lat]],
          radiuses: [-1],
          preference: 'shortest',
          instructions: false,
          geometry_simplify: false
        },
        {
          headers: {
            'Authorization': process.env.REACT_APP_ORS_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );

      // Process main route
      const mainCoordinates = mainRouteResponse.data.features[0].geometry.coordinates;
      const mainMidpointLocation = calculateBestMidpoint(mainCoordinates);
      const mainRouteLatLngs = mainCoordinates.map(([lng, lat]) => [lat, lng]);
      setRouteCoordinates(mainRouteLatLngs);
      setMidpoint(mainMidpointLocation);

      // Process alternate route
      const alternateCoordinates = alternateRouteResponse.data.features[0].geometry.coordinates;
      const alternateMidpointLocation = calculateBestMidpoint(alternateCoordinates);
      const alternateRouteLatLngs = alternateCoordinates.map(([lng, lat]) => [lat, lng]);
      setAlternateRouteCoordinates(alternateRouteLatLngs);
      setAlternateMidpoint(alternateMidpointLocation);

      // Get POIs for both midpoints (reduce limit to 5 for each)
      const [mainPOIs, alternatePOIs] = await Promise.all([
        searchPOIs(mainMidpointLocation, 5, point1, point2),
        alternateMidpointLocation ? searchPOIs(alternateMidpointLocation, 5, point1, point2) : Promise.resolve([])
      ]);

      // Combine and set places
      setPlaces([
        ...mainPOIs.map(poi => ({ ...poi, route: 'main' })),
        ...alternatePOIs.map(poi => ({ ...poi, route: 'alternate' }))
      ]);

      // Set initial map view to show both routes
      const allPoints = [
        [point1.lat, point1.lng],
        [point2.lat, point2.lng],
        [mainMidpointLocation.lat, mainMidpointLocation.lng],
        ...(alternateMidpointLocation ? [[alternateMidpointLocation.lat, alternateMidpointLocation.lng]] : [])
      ];
      
      setMapBounds(calculateBoundsForPoints(allPoints));
      setMapCenter([mainMidpointLocation.lat, mainMidpointLocation.lng]);
    } catch (error) {
      console.error('Detailed error:', error);
      setError(
        error.response?.data?.error?.message || 
        error.message || 
        'An error occurred while finding the meeting point'
      );
      setStartPoints([]);
      setMidpoint(null);
      setRouteCoordinates(null);
      setAlternateRouteCoordinates(null);
      setAlternateMidpoint(null);
      setPlaces([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewOnMap = (location) => {
    // Scroll to map
    document.querySelector('.map-container').scrollIntoView({ 
      behavior: 'smooth',
      block: 'center'
    });
    
    // Center map on location with zoom
    setMapCenter([location.lat, location.lng]);
    // Optional: You can also update the map bounds to focus on this area
    setMapBounds([
      [location.lat - 0.01, location.lng - 0.01],
      [location.lat + 0.01, location.lng + 0.01]
    ]);
  };

  // Update the searchPOIs function to handle multiple categories
  const searchPOIs = async (midpoint, limit = 5, point1, point2) => {
    // Build a more comprehensive query
    const overpassQuery = `
      [out:json][timeout:25];
      (
        // Restaurants, Cafes, and Bars
        node["amenity"~"restaurant|cafe|bar|pub"](around:2000,${midpoint.lat},${midpoint.lng});
        way["amenity"~"restaurant|cafe|bar|pub"](around:2000,${midpoint.lat},${midpoint.lng});
        
        // Shopping
        node["shop"~"mall|department_store|supermarket|convenience|clothing"](around:2000,${midpoint.lat},${midpoint.lng});
        way["shop"~"mall|department_store|supermarket|convenience|clothing"](around:2000,${midpoint.lat},${midpoint.lng});
        
        // Entertainment
        node["leisure"~"cinema|theatre|arts_centre|entertainment"](around:2000,${midpoint.lat},${midpoint.lng});
        way["leisure"~"cinema|theatre|arts_centre|entertainment"](around:2000,${midpoint.lat},${midpoint.lng});
        
        // Hotels
        node["tourism"="hotel"](around:2000,${midpoint.lat},${midpoint.lng});
        way["tourism"="hotel"](around:2000,${midpoint.lat},${midpoint.lng});
        
        // Parking
        node["amenity"="parking"](around:2000,${midpoint.lat},${midpoint.lng});
        way["amenity"="parking"](around:2000,${midpoint.lat},${midpoint.lng});
        
        // Parks
        node["leisure"="park"](around:2000,${midpoint.lat},${midpoint.lng});
        way["leisure"="park"](around:2000,${midpoint.lat},${midpoint.lng});
      );
      out center ${limit};
    `;

    console.log('Overpass Query:', overpassQuery);

    const response = await axios.get('https://overpass-api.de/api/interpreter', {
      params: { data: overpassQuery }
    });

    console.log('Found locations:', response.data.elements.length);
    return processAndCalculateDriveTimes(response.data.elements, midpoint, point1, point2);
  };

  const processAndCalculateDriveTimes = async (elements, midpoint, point1, point2) => {
    console.log('Processing elements:', elements);
    
    return Promise.all(
      elements
        .filter(element => (
          element.tags && 
          element.tags.name && 
          element.lat && 
          element.lon
        ))
        .map(async element => {
          const location = {
            lat: Number(element.lat),
            lng: Number(element.lon)
          };

          const [timeFrom1, timeFrom2] = await Promise.all([
            calculateDriveTime(point1, location),
            calculateDriveTime(point2, location)
          ]);

          // Enhanced category determination
          let category;
          if (element.tags.shop) {
            category = 'shopping';
          } else if (element.tags.leisure === 'park') {
            category = 'park';
          } else if (element.tags.leisure && ['cinema', 'theatre', 'arts_centre'].includes(element.tags.leisure)) {
            category = 'entertainment';
          } else if (element.tags.tourism === 'hotel') {
            category = 'hotel';
          } else if (element.tags.amenity === 'parking') {
            category = 'parking';
          } else if (element.tags.amenity === 'restaurant') {
            category = 'restaurant';
          } else if (element.tags.amenity === 'cafe') {
            category = 'cafe';
          } else if (element.tags.amenity === 'bar' || element.tags.amenity === 'pub') {
            category = 'bar';
          } else {
            console.log('Uncategorized place:', element.tags);
            category = 'other';
          }

          console.log(`Processed place: ${element.tags.name}, Category: ${category}`);

          return {
            name: element.tags.name,
            location,
            category,
            address: [
              element.tags['addr:street'],
              element.tags['addr:housenumber'],
              element.tags['addr:city'],
              element.tags['addr:state']
            ].filter(Boolean).join(', ') || 'Address available on map',
            driveTimes: {
              from1: timeFrom1,
              from2: timeFrom2
            },
            mapLinks: generateMapLinks(
              location.lat, 
              location.lng, 
              element.tags.name
            )
          };
        })
    );
  };

  // Add this near your other helper functions (like calculateDistance)
  const calculateBoundsForPoints = (points) => {
    if (!points || points.length === 0) return null;
    
    const latitudes = points.map(p => p[0]);
    const longitudes = points.map(p => p[1]);
    
    // Add some padding to the bounds
    const padding = 0.1; // about 11km at the equator
    return [
      [Math.min(...latitudes) - padding, Math.min(...longitudes) - padding],
      [Math.max(...latitudes) + padding, Math.max(...longitudes) + padding]
    ];
  };

  // Add this function to handle route clicks
  const handleRouteClick = (routeType) => {
    setSelectedRoute(routeType);
    
    // Center the map on the appropriate midpoint
    const selectedMidpoint = routeType === 'main' ? midpoint : alternateMidpoint;
    if (selectedMidpoint) {
      setMapCenter([selectedMidpoint.lat, selectedMidpoint.lng]);
    }
  };

  // Add this helper function
  const formatCategory = (category) => {
    const categoryData = poiCategories.find(cat => cat.id === category.toLowerCase());
    return categoryData ? categoryData.name : 'Other';
  };

  // Simplify the filteredPlaces memo
  const filteredPlaces = useMemo(() => {
    return places
      .filter(place => 
        !place.isMiddlePoint && 
        place.route === selectedRoute
      )
      .sort((a, b) => {
        const totalTimeA = a.driveTimes.from1 + a.driveTimes.from2;
        const totalTimeB = b.driveTimes.from1 + b.driveTimes.from2;
        return totalTimeA - totalTimeB;
      });
  }, [places, selectedRoute]);

  // Add loading handlers
  const handleMapLoad = () => {
    setIsMapLoading(false);
  };

  const handlePlacesLoad = () => {
    setArePlacesLoading(false);
  };

  // Create marker icons once instead of on every render
  const markerIcons = useMemo(() => ({
    start: L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    }),
    middle: L.icon({
      // ... middle point icon
    }),
    poi: L.icon({
      // ... POI icon
    })
  }), []);

  return (
    <ErrorBoundary>
      <div className="App">
        <button 
          className="theme-toggle"
          onClick={() => setDarkMode(!darkMode)}
          aria-label="Toggle dark mode"
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
        <h1>Meet Me Halfway</h1>
        
        <form onSubmit={handleSubmit} className="location-form">
          <div className="form-group">
            <input
              type="text"
              value={location1}
              onChange={(e) => {
                setLocation1(e.target.value);
                setFormErrors(prev => ({ ...prev, location1: '' }));
              }}
              placeholder="Enter first location"
              list="saved-locations"
              disabled={isLoading}
              className={formErrors.location1 ? 'error' : ''}
            />
          </div>
          
          <div className="form-group">
            <input
              type="text"
              value={location2}
              onChange={(e) => {
                setLocation2(e.target.value);
                setFormErrors(prev => ({ ...prev, location2: '' }));
              }}
              placeholder="Enter second location"
              disabled={isLoading}
              className={formErrors.location2 ? 'error' : ''}
            />
            {formErrors.location2 && (
              <div className="input-error">{formErrors.location2}</div>
            )}
          </div>
          
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Calculating...' : 'Find Midpoint'}
          </button>
        </form>

        {isLoading && <div className="loading">Finding the perfect meeting point...</div>}
        {error && <div className="error">{error}</div>}

        <div className="map-and-places">
          <div className="map-container">
            <Suspense fallback={
              <div className="map-loading">
                <div className="loading-dots">
                  <div className="loading-dot"></div>
                  <div className="loading-dot"></div>
                  <div className="loading-dot"></div>
                </div>
              </div>
            }>
              <MapComponent 
                center={mapCenter}
                routes={routeCoordinates}
                places={places}
                startPoints={startPoints}
                midpoint={midpoint}
                alternateMidpoint={alternateMidpoint}
                alternateRouteCoordinates={alternateRouteCoordinates}
                selectedRoute={selectedRoute}
                setSelectedRoute={setSelectedRoute}
                mapBounds={mapBounds}
                onLoad={handleMapLoad}
              />
            </Suspense>
          </div>

          <div className="places-list">
            {loadingPlaces ? (
              // Show 3 skeleton cards while loading
              Array(3).fill(0).map((_, index) => (
                <div key={index} className="place-card skeleton">
                  <div className="place-header skeleton" />
                  <div className="place-times skeleton" />
                  <div className="view-on-map skeleton" />
                </div>
              ))
            ) : (
              filteredPlaces.map((place, index) => (
                <div key={index} className="place-card">
                  <div className="place-header">
                    <h3>{place.name}</h3>
                    <span className="category-tag">
                      {formatCategory(place.category)}
                    </span>
                  </div>
                  <div className="place-times">
                    <span>Loc 1: </span>
                    <span className={`time ${getDriveTimeClass(place.driveTimes.from1)}`}>
                      {place.driveTimes.from1}m
                    </span>
                    <span className="time-separator">|</span>
                    <span>Loc 2: </span>
                    <span className={`time ${getDriveTimeClass(place.driveTimes.from2)}`}>
                      {place.driveTimes.from2}m
                    </span>
                  </div>
                  <button 
                    className="view-on-map"
                    onClick={() => handleViewOnMap(place.location)}
                  >
                    View on Map
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

function SetBoundsComponent({ bounds }) {
  const map = useMap();
  
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds);
    }
  }, [bounds, map]);

  return null;
}

export default App; 