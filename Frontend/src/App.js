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

// Add error types
const ErrorTypes = {
  GEOCODING: 'GEOCODING',
  ROUTING: 'ROUTING',
  POI_SEARCH: 'POI_SEARCH',
  NETWORK: 'NETWORK'
};

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

  // Add caching for geocoding results
  const geocodeCache = new Map();

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

  // Add retry logic with exponential backoff
  const withRetry = async (operation, type, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        return await operation();
      } catch (error) {
        console.error(`${type} error (attempt ${i + 1}/${retries}):`, error);
        
        if (i === retries - 1) {
          throw {
            type,
            message: getErrorMessage(type, error),
            originalError: error
          };
        }
        
        // Exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, Math.min(1000 * Math.pow(2, i), 8000))
        );
      }
    }
  };

  // Add user-friendly error messages
  const getErrorMessage = (type, error) => {
    switch (type) {
      case ErrorTypes.GEOCODING:
        return "Couldn't find that location. Please check the address and try again.";
      case ErrorTypes.ROUTING:
        return "Couldn't find a route between these locations. Try locations that are closer together.";
      case ErrorTypes.POI_SEARCH:
        return "Had trouble finding places in this area. Please try again.";
      case ErrorTypes.NETWORK:
        return "Network error. Please check your connection and try again.";
      default:
        return error.message || "Something went wrong. Please try again.";
    }
  };

  // Update geocodeLocation to use retry logic
  const geocodeLocation = async (location) => {
    if (geocodeCache.has(location)) {
      return geocodeCache.get(location);
    }

    return withRetry(async () => {
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
      
      if (response.data.features?.length > 0) {
        const [lng, lat] = response.data.features[0].geometry.coordinates;
        const result = { lat, lng };
        geocodeCache.set(location, result);
        return result;
      }
      throw new Error('Location not found');
    }, ErrorTypes.GEOCODING);
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

  // Add route caching
  const routeCache = useMemo(() => new Map(), []);

  // Add cache key generator
  const generateCacheKey = (point1, point2, type = 'main') => {
    const locations = [
      `${point1.lat},${point1.lng}`,
      `${point2.lat},${point2.lng}`
    ].sort().join('-');
    return `${type}-${locations}`;
  };

  // Update route fetching functions with caching
  const getRoute = async (point1, point2) => {
    const cacheKey = generateCacheKey(point1, point2, 'main');
    
    if (routeCache.has(cacheKey)) {
      return routeCache.get(cacheKey);
    }

    const response = await axios.post(
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

    routeCache.set(cacheKey, response.data);
    return response.data;
  };

  const getAlternateRoute = async (point1, point2) => {
    const response = await axios.post(
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
    return response.data;
  };

  // Add this near other state declarations
  const [recentSearches, setRecentSearches] = useState(() => {
    const saved = localStorage.getItem('recentSearches');
    return saved ? JSON.parse(saved) : [];
  });

  // Update the saveToRecentSearches function
  const saveToRecentSearches = (loc1, loc2) => {
    const searchPair = { loc1, loc2, timestamp: Date.now() };
    
    setRecentSearches(prev => {
      // Check if this exact pair already exists
      const isDuplicate = prev.some(
        search => 
          (search.loc1.toLowerCase() === loc1.toLowerCase() && 
           search.loc2.toLowerCase() === loc2.toLowerCase()) ||
          (search.loc1.toLowerCase() === loc2.toLowerCase() && 
           search.loc2.toLowerCase() === loc1.toLowerCase())
      );

      if (isDuplicate) {
        // Move the existing pair to the top by removing it and adding new timestamp
        const filtered = prev.filter(
          search => 
            !(search.loc1.toLowerCase() === loc1.toLowerCase() && 
              search.loc2.toLowerCase() === loc2.toLowerCase()) &&
            !(search.loc1.toLowerCase() === loc2.toLowerCase() && 
              search.loc2.toLowerCase() === loc1.toLowerCase())
        );
        const newSearches = [searchPair, ...filtered.slice(0, 4)];
        localStorage.setItem('recentSearches', JSON.stringify(newSearches));
        return newSearches;
      }

      // Add new pair if not duplicate
      const newSearches = [searchPair, ...prev.slice(0, 4)];
      localStorage.setItem('recentSearches', JSON.stringify(newSearches));
      return newSearches;
    });
  };

  // Add state for showing dropdown
  const [showRecentSearches, setShowRecentSearches] = useState(false);

  // Add function to remove individual search
  const removeSearch = (timestamp) => {
    setRecentSearches(prev => {
      const newSearches = prev.filter(search => search.timestamp !== timestamp);
      localStorage.setItem('recentSearches', JSON.stringify(newSearches));
      return newSearches;
    });
  };

  // Add state for second input dropdown
  const [showRecentSearches1, setShowRecentSearches1] = useState(false);
  const [showRecentSearches2, setShowRecentSearches2] = useState(false);

  // Add new state for keyboard navigation
  const [activeIndex, setActiveIndex] = useState(-1);

  // Add keyboard navigation handler
  const handleKeyDown = (e, searchList, setLocation, closeDropdown) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => Math.min(prev + 1, searchList.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        if (activeIndex >= 0) {
          e.preventDefault();
          setLocation(searchList[activeIndex].loc1);
          closeDropdown();
        }
        break;
      case 'Escape':
        closeDropdown();
        break;
    }
  };

  // Update handleSubmit to save searches
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    saveToRecentSearches(location1, location2);
    setIsLoading(true);
    setLoadingPlaces(true);
    setError(null);

    try {
      // Geocode both locations with retry
      const [point1, point2] = await Promise.all([
        geocodeLocation(location1),
        geocodeLocation(location2)
      ]);

      // Store start points
      setStartPoints([
        { name: location1, location: point1, category: 'Start Location' },
        { name: location2, location: point2, category: 'Start Location' }
      ]);

      // Get routes with retry
      const [mainRouteData, alternateRouteData] = await Promise.all([
        withRetry(() => getRoute(point1, point2), ErrorTypes.ROUTING),
        withRetry(() => getAlternateRoute(point1, point2), ErrorTypes.ROUTING)
      ]);

      // Process main route
      const mainCoordinates = mainRouteData.features[0].geometry.coordinates;
      const mainMidpointLocation = calculateBestMidpoint(mainCoordinates);
      const mainRouteLatLngs = mainCoordinates.map(([lng, lat]) => [lat, lng]);
      setRouteCoordinates(mainRouteLatLngs);
      setMidpoint(mainMidpointLocation);

      // Process alternate route
      const alternateCoordinates = alternateRouteData.features[0].geometry.coordinates;
      const alternateMidpointLocation = calculateBestMidpoint(alternateCoordinates);
      const alternateRouteLatLngs = alternateCoordinates.map(([lng, lat]) => [lat, lng]);
      setAlternateRouteCoordinates(alternateRouteLatLngs);
      setAlternateMidpoint(alternateMidpointLocation);

      // Get POIs with retry
      const [mainPOIs, alternatePOIs] = await Promise.all([
        withRetry(() => searchPOIs(mainMidpointLocation, 5, point1, point2), ErrorTypes.POI_SEARCH),
        withRetry(() => searchPOIs(alternateMidpointLocation, 5, point1, point2), ErrorTypes.POI_SEARCH)
      ]);

      // Combine and set places
      setPlaces([
        ...mainPOIs.map(poi => ({ ...poi, route: 'main' })),
        ...alternatePOIs.map(poi => ({ ...poi, route: 'alternate' }))
      ]);

      // Set map bounds
      const allPoints = [
        [point1.lat, point1.lng],
        [point2.lat, point2.lng],
        [mainMidpointLocation.lat, mainMidpointLocation.lng],
        [alternateMidpointLocation.lat, alternateMidpointLocation.lng]
      ];
      setMapBounds(calculateBoundsForPoints(allPoints));
      setMapCenter([mainMidpointLocation.lat, mainMidpointLocation.lng]);

    } catch (error) {
      console.error('Error details:', error);
      setError(getErrorMessage(error.type || ErrorTypes.NETWORK, error));
      // Clear relevant state
      setStartPoints([]);
      setMidpoint(null);
      setRouteCoordinates(null);
      setAlternateRouteCoordinates(null);
      setAlternateMidpoint(null);
      setPlaces([]);
    } finally {
      setIsLoading(false);
      setLoadingPlaces(false);
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

  // Add loading skeletons
  const PlaceSkeleton = () => (
    <div className="skeleton">
      <div className="skeleton-text" /> {/* Place name */}
      <div className="skeleton-text" /> {/* Category */}
      <div className="skeleton-text" /> {/* Times */}
      <div className="skeleton-button" /> {/* Button */}
    </div>
  );

  // Add this component for recent searches
  const RecentSearches = ({ onSelect }) => (
    <div className="recent-searches">
      <h3>Recent Searches</h3>
      {recentSearches.map((search, index) => (
        <button
          key={index}
          className="recent-search-item"
          onClick={() => onSelect(search.loc1, search.loc2)}
        >
          <span>{search.loc1}</span>
          <span className="separator">↔</span>
          <span>{search.loc2}</span>
          <span className="timestamp">
            {new Date(search.timestamp).toLocaleDateString()}
          </span>
        </button>
      ))}
    </div>
  );

  // Update click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.input-wrapper')) {
        setShowRecentSearches(false);
        setShowRecentSearches1(false);
        setShowRecentSearches2(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Add lazy loading for components
  const PlaceCard = lazy(() => import('./components/PlaceCard'));
  const RouteDisplay = lazy(() => import('./components/RouteDisplay'));

  // Add loading boundaries
  const LoadingBoundary = ({ children }) => (
    <Suspense fallback={
      <div className="loading-skeleton">
        <div className="loading-pulse"></div>
      </div>
    }>
      {children}
    </Suspense>
  );

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
            <div className="input-wrapper">
              <label htmlFor="location1" className="visually-hidden">First Location</label>
              <input
                id="location1"
                type="text"
                value={location1}
                onChange={(e) => {
                  setLocation1(e.target.value);
                  setFormErrors(prev => ({ ...prev, location1: '' }));
                }}
                onFocus={() => !isLoading && setShowRecentSearches1(true)}
                onBlur={() => setTimeout(() => setShowRecentSearches1(false), 200)}
                onKeyDown={(e) => handleKeyDown(
                  e,
                  recentSearches,
                  setLocation1,
                  () => setShowRecentSearches1(false)
                )}
                placeholder="Enter first location"
                disabled={isLoading}
                className={formErrors.location1 ? 'error' : ''}
                aria-expanded={showRecentSearches1}
                aria-controls="recent-searches-1"
                aria-describedby={formErrors.location1 ? 'location1-error' : undefined}
                role="combobox"
              />
              {formErrors.location1 && (
                <div id="location1-error" className="error-message" role="alert">
                  {formErrors.location1}
                </div>
              )}
              {showRecentSearches1 && recentSearches.length > 0 && !isLoading && (
                <div 
                  id="recent-searches-1"
                  className="recent-searches-dropdown"
                  role="listbox"
                >
                  {recentSearches.map((search, index) => (
                    <div
                      key={search.timestamp}
                      className={`recent-search-item ${index === activeIndex ? 'active' : ''}`}
                      role="option"
                      aria-selected={index === activeIndex}
                      tabIndex={0}
                    >
                      <div 
                        className="search-text"
                        onClick={() => setLocation1(search.loc1)}
                        onKeyPress={(e) => e.key === 'Enter' && setLocation1(search.loc1)}
                      >
                        {search.loc1}
                      </div>
                      <button
                        className="delete-search"
                        onClick={(e) => {
                          e.preventDefault();
                          removeSearch(search.timestamp);
                        }}
                        aria-label={`Remove ${search.loc1} from history`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="form-group">
            <div className="input-wrapper">
              <label htmlFor="location2" className="visually-hidden">Second Location</label>
              <input
                id="location2"
                type="text"
                value={location2}
                onChange={(e) => {
                  setLocation2(e.target.value);
                  setFormErrors(prev => ({ ...prev, location2: '' }));
                }}
                onFocus={() => !isLoading && setShowRecentSearches2(true)}
                onBlur={() => setTimeout(() => setShowRecentSearches2(false), 200)}
                onKeyDown={(e) => handleKeyDown(
                  e,
                  recentSearches,
                  setLocation2,
                  () => setShowRecentSearches2(false)
                )}
                placeholder="Enter second location"
                disabled={isLoading}
                className={formErrors.location2 ? 'error' : ''}
                aria-expanded={showRecentSearches2}
                aria-controls="recent-searches-2"
                aria-describedby={formErrors.location2 ? 'location2-error' : undefined}
                role="combobox"
              />
              {formErrors.location2 && (
                <div id="location2-error" className="error-message" role="alert">
                  {formErrors.location2}
                </div>
              )}
              {showRecentSearches2 && recentSearches.length > 0 && !isLoading && (
                <div 
                  id="recent-searches-2"
                  className="recent-searches-dropdown"
                  role="listbox"
                >
                  {recentSearches.map((search, index) => (
                    <div
                      key={search.timestamp}
                      className={`recent-search-item ${index === activeIndex ? 'active' : ''}`}
                      role="option"
                      aria-selected={index === activeIndex}
                      tabIndex={0}
                    >
                      <div 
                        className="search-text"
                        onClick={() => setLocation2(search.loc2)}
                        onKeyPress={(e) => e.key === 'Enter' && setLocation2(search.loc2)}
                      >
                        {search.loc2}
                      </div>
                      <button
                        className="delete-search"
                        onClick={(e) => {
                          e.preventDefault();
                          removeSearch(search.timestamp);
                        }}
                        aria-label={`Remove ${search.loc2} from history`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
              <>
                <PlaceSkeleton />
                <PlaceSkeleton />
                <PlaceSkeleton />
              </>
            ) : filteredPlaces.length > 0 ? (
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
            ) : (
              <div className="no-places">
                <p>No places found in this area. Try adjusting your search.</p>
              </div>
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