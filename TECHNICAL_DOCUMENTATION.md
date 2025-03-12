# Meet-Me-Halfway: Technical Documentation

This document provides detailed technical information about the core functionality of the Meet-Me-Halfway application. It's designed to help developers understand how the key components work and interact with each other.

## Core Functionality Overview

The application performs the following key operations:
1. Geocoding of user-entered locations
2. Route calculation between the locations
3. Midpoint determination with balanced travel times
4. Points of Interest (POI) discovery around the midpoint
5. Travel time calculation to each POI
6. Visualization of routes, midpoints, and POIs on a map

## Geocoding Implementation

The application uses LocationIQ for geocoding (converting addresses to coordinates).

```javascript
const geocodeLocation = async (location) => {
  // Check cache first
  if (geocodeCache.has(location)) {
    return geocodeCache.get(location);
  }

  try {
    console.log('Geocoding location:', location);
    const response = await axios.get('https://us1.locationiq.com/v1/search.php', {
      params: {
        key: process.env.REACT_APP_LOCATIONIQ_KEY,
        q: location,
        format: 'json',
        limit: 1
      }
    });

    console.log('Geocoding response:', response.data);
    
    if (response.data && response.data.length > 0) {
      const { lat, lon } = response.data[0];
      const coordinates = { lat: parseFloat(lat), lng: parseFloat(lon) };
      
      // Cache the result
      geocodeCache.set(location, coordinates);
      
      return coordinates;
    } else {
      throw new Error('No results found for location');
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    throw error;
  }
};
```

## Route Calculation

The application uses OSRM (Open Source Routing Machine) for route calculation. Two routes are calculated:

1. Main route
2. Alternate route

### Main Route Calculation

```javascript
const getRoute = async (point1, point2) => {
  const cacheKey = `${point1.lat},${point1.lng}-${point2.lat},${point2.lng}`;
  
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey);
  }

  try {
    console.log('Routing between points with OSRM:', point1, point2);
    const response = await axios.get(
      `https://router.project-osrm.org/route/v1/driving/${point1.lng},${point1.lat};${point2.lng},${point2.lat}`,
      {
        params: {
          alternatives: true,
          steps: true,
          geometries: 'geojson',
          overview: 'full'
        }
      }
    );

    // Process route data
    if (response.data && response.data.routes && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      
      // Resample route points for better midpoint calculation
      const coordinates = route.geometry.coordinates;
      const totalPoints = coordinates.length;
      
      let processedCoordinates = coordinates;
      if (totalPoints > 10) {
        const resampledCoordinates = [];
        const step = Math.max(1, Math.floor(totalPoints / 100));
        
        for (let i = 0; i < totalPoints; i += step) {
          resampledCoordinates.push(coordinates[Math.min(i, totalPoints - 1)]);
        }
        
        if (resampledCoordinates[resampledCoordinates.length - 1] !== coordinates[totalPoints - 1]) {
          resampledCoordinates.push(coordinates[totalPoints - 1]);
        }
        
        processedCoordinates = resampledCoordinates;
      }
      
      const geojson = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              distance: route.distance,
              duration: route.duration
            },
            geometry: {
              type: 'LineString',
              coordinates: processedCoordinates
            }
          }
        ]
      };
      
      routeCache.set(cacheKey, geojson);
      return geojson;
    } else {
      throw new Error('No route found');
    }
  } catch (error) {
    console.error('Routing error:', error);
    throw error;
  }
};
```

### Alternate Route Calculation

```javascript
const getAlternateRoute = async (point1, point2) => {
  try {
    console.log('Getting alternate route with OSRM:', point1, point2);
    const response = await axios.get(
      `https://router.project-osrm.org/route/v1/driving/${point1.lng},${point1.lat};${point2.lng},${point2.lat}`,
      {
        params: {
          alternatives: true,
          steps: true,
          geometries: 'geojson',
          overview: 'full'
        }
      }
    );

    // Process alternate route data
    if (response.data && response.data.routes && response.data.routes.length > 1) {
      // Use the second route as the alternate
      const route = response.data.routes[1];
      
      // Resample route points (similar to main route)
      // ...processing code similar to main route...
      
      return geojson;
    } else if (response.data && response.data.routes && response.data.routes.length > 0) {
      // If only one route is available, create a modified version
      // ...code to create a modified version of the main route...
      
      return geojson;
    } else {
      throw new Error('No route found');
    }
  } catch (error) {
    console.error('Alternate routing error:', error);
    throw error;
  }
};
```

## Midpoint Calculation Algorithm

The midpoint calculation is a critical part of the application. It uses a sophisticated algorithm to find a point along the route where both parties would have approximately equal travel times.

```javascript
const calculateBestMidpoint = (coordinates) => {
  if (!coordinates || coordinates.length < 2) {
    console.error('Invalid coordinates for midpoint calculation');
    return { lat: 0, lng: 0 };
  }
  
  console.log('Calculating best midpoint for route with', coordinates.length, 'points');
  
  // Analyze the route structure
  const routeLength = coordinates.length;
  const firstPoint = coordinates[0];
  const lastPoint = coordinates[routeLength - 1];
  
  // Calculate total route distance
  let totalDistance = 0;
  let cumulativeDistances = [0];
  
  for (let i = 1; i < coordinates.length; i++) {
    const [lng1, lat1] = coordinates[i-1];
    const [lng2, lat2] = coordinates[i];
    const segmentDistance = calculateDistance(
      { lat: lat1, lng: lng1 },
      { lat: lat2, lng: lng2 }
    );
    totalDistance += segmentDistance;
    cumulativeDistances.push(totalDistance);
  }
  
  // Find the exact 50% distance point
  const halfwayDistance = totalDistance / 2;
  
  // Find the closest point to the exact halfway distance
  let closestIndex = 0;
  let closestDiff = Infinity;
  
  for (let i = 0; i < cumulativeDistances.length; i++) {
    const diff = Math.abs(cumulativeDistances[i] - halfwayDistance);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestIndex = i;
    }
  }
  
  // Use linear interpolation for more precise midpoint
  let midpoint;
  
  if (closestIndex < coordinates.length - 1 && 
      Math.abs(cumulativeDistances[closestIndex + 1] - halfwayDistance) < 
      Math.abs(cumulativeDistances[closestIndex] - halfwayDistance)) {
    
    // Get the two closest points
    const [lng1, lat1] = coordinates[closestIndex];
    const [lng2, lat2] = coordinates[closestIndex + 1];
    
    // Calculate how far between these points our exact halfway point is
    const dist1 = cumulativeDistances[closestIndex];
    const dist2 = cumulativeDistances[closestIndex + 1];
    const ratio = (halfwayDistance - dist1) / (dist2 - dist1);
    
    // Interpolate between the two points
    const interpolatedLng = lng1 + (lng2 - lng1) * ratio;
    const interpolatedLat = lat1 + (lat2 - lat1) * ratio;
    
    midpoint = {
      lat: interpolatedLat,
      lng: interpolatedLng
    };
  } else {
    // Use the closest existing point
    const [lng, lat] = coordinates[closestIndex];
    midpoint = {
      lat,
      lng
    };
  }
  
  return midpoint;
};
```

### Key Aspects of the Midpoint Algorithm:

1. **Distance Calculation**: Computes the total distance of the route and the cumulative distance at each point
2. **Halfway Point**: Identifies the exact 50% distance point along the route
3. **Linear Interpolation**: Uses interpolation between the two closest points for more precise positioning
4. **Route Resampling**: Both routes are resampled to ensure even point distribution for consistent midpoint calculation

## POI Search and Travel Time Calculation

The application searches for Points of Interest around the midpoint and calculates travel times from both starting locations to each POI.

### POI Search

```javascript
const searchPOIs = async (midpoint, radius = 1000, limit = 10) => {
  try {
    console.log('Searching for POIs around midpoint:', midpoint);
    const response = await axios.get('https://us1.locationiq.com/v1/nearby.php', {
      params: {
        key: process.env.REACT_APP_LOCATIONIQ_KEY,
        lat: midpoint.lat,
        lon: midpoint.lng,
        tag: 'restaurant,cafe,pub,bar,fast_food',
        radius,
        limit,
        format: 'json'
      }
    });

    console.log('POI search response:', response.data);
    
    if (response.data && response.data.length > 0) {
      return response.data.map(poi => ({
        id: poi.place_id,
        name: poi.name || 'Unnamed Location',
        category: poi.type,
        location: {
          lat: parseFloat(poi.lat),
          lng: parseFloat(poi.lon)
        },
        address: poi.address || {}
      }));
    } else {
      return [];
    }
  } catch (error) {
    console.error('POI search error:', error);
    return [];
  }
};
```

### Travel Time Calculation

```javascript
const calculateDriveTime = async (startPoint, endPoint) => {
  try {
    const response = await axios.get(
      `https://router.project-osrm.org/route/v1/driving/${startPoint.lng},${startPoint.lat};${endPoint.lng},${endPoint.lat}`
    );
    
    if (response.data && response.data.routes && response.data.routes.length > 0) {
      // OSRM returns duration in seconds, convert to minutes
      return Math.round(response.data.routes[0].duration / 60);
    } else {
      throw new Error('No route found');
    }
  } catch (error) {
    console.error('Drive time calculation error:', error);
    throw error;
  }
};

const processAndCalculateDriveTimes = async (pois, location1, location2) => {
  const poisWithDriveTimes = [];
  
  for (const poi of pois) {
    try {
      // Calculate drive times from both locations to the POI
      const driveTimeFromLocation1 = await calculateDriveTime(location1, poi.location);
      const driveTimeFromLocation2 = await calculateDriveTime(location2, poi.location);
      
      poisWithDriveTimes.push({
        ...poi,
        driveTimeFromLocation1,
        driveTimeFromLocation2
      });
    } catch (error) {
      console.error('Error calculating drive times for POI:', poi.name, error);
    }
  }
  
  return poisWithDriveTimes;
};
```

## Map Visualization

The application uses React Leaflet for map visualization. The map displays:

1. The main route (blue)
2. The alternate route (purple)
3. Midpoints for both routes
4. POIs around the midpoint

```jsx
<MapContainer center={mapCenter} zoom={mapZoom} style={{ height: '500px', width: '100%' }}>
  <TileLayer
    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  />
  
  {/* Display the main route */}
  {route && (
    <GeoJSON 
      data={route} 
      style={() => ({ color: '#3388ff', weight: 4 })}
    />
  )}
  
  {/* Display the alternate route */}
  {alternateRoute && (
    <GeoJSON 
      data={alternateRoute} 
      style={() => ({ color: '#8833ff', weight: 4, dashArray: '5, 5' })}
    />
  )}
  
  {/* Display the midpoints */}
  {midpoint && (
    <Marker 
      position={[midpoint.lat, midpoint.lng]} 
      icon={midpointIcon}
    >
      <Popup>Midpoint (Main Route)</Popup>
    </Marker>
  )}
  
  {alternateMidpoint && (
    <Marker 
      position={[alternateMidpoint.lat, alternateMidpoint.lng]} 
      icon={alternateMidpointIcon}
    >
      <Popup>Midpoint (Alternate Route)</Popup>
    </Marker>
  )}
  
  {/* Display POIs */}
  {pois.map(poi => (
    <Marker 
      key={poi.id} 
      position={[poi.location.lat, poi.location.lng]}
      icon={poiIcon}
    >
      <Popup>
        <div>
          <h3>{poi.name}</h3>
          <p>{poi.category}</p>
          <p>Drive time from Location 1: {poi.driveTimeFromLocation1} min</p>
          <p>Drive time from Location 2: {poi.driveTimeFromLocation2} min</p>
        </div>
      </Popup>
    </Marker>
  ))}
</MapContainer>
```

## Form Submission and Overall Process Flow

The form submission handler orchestrates the entire process:

```javascript
const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError(null);
  
  try {
    // 1. Geocode both locations
    const point1 = await geocodeLocation(location1);
    const point2 = await geocodeLocation(location2);
    
    // 2. Get the main route
    const routeData = await getRoute(point1, point2);
    setRoute(routeData);
    
    // 3. Calculate the midpoint for the main route
    const coordinates = routeData.features[0].geometry.coordinates;
    const calculatedMidpoint = calculateBestMidpoint(coordinates);
    setMidpoint(calculatedMidpoint);
    
    // 4. Get the alternate route
    const alternateRouteData = await getAlternateRoute(point1, point2);
    setAlternateRoute(alternateRouteData);
    
    // 5. Calculate the midpoint for the alternate route
    const alternateCoordinates = alternateRouteData.features[0].geometry.coordinates;
    const calculatedAlternateMidpoint = calculateBestMidpoint(alternateCoordinates);
    setAlternateMidpoint(calculatedAlternateMidpoint);
    
    // 6. Search for POIs around the midpoint
    const foundPois = await searchPOIs(calculatedMidpoint);
    
    // 7. Calculate drive times to each POI
    const poisWithDriveTimes = await processAndCalculateDriveTimes(foundPois, point1, point2);
    setPois(poisWithDriveTimes);
    
    // 8. Set map center and zoom
    setMapCenter([calculatedMidpoint.lat, calculatedMidpoint.lng]);
    setMapZoom(12);
    
    // 9. Save to recent searches
    saveRecentSearch(location1, location2);
    
  } catch (error) {
    console.error('Error in form submission:', error);
    setError('An error occurred. Please check your locations and try again.');
  } finally {
    setLoading(false);
  }
};
```

## Key Challenges and Solutions

### 1. Balanced Midpoint Calculation

**Challenge**: Finding a truly balanced midpoint where travel times are similar for both parties.

**Solution**: 
- Implemented a distance-based midpoint calculation with linear interpolation
- Resampled routes to ensure even point distribution
- Used the exact 50% distance point along the route

### 2. Route Data Inconsistency

**Challenge**: Different routes could have very different point distributions, affecting midpoint calculation.

**Solution**:
- Standardized route processing for both main and alternate routes
- Implemented resampling to normalize point distribution
- Added extensive error checking and fallbacks

### 3. POI Relevance

**Challenge**: Ensuring POIs are relevant and accessible from both locations.

**Solution**:
- Calculated actual drive times from both starting locations to each POI
- Displayed drive times in the POI popups for easy comparison
- Used a reasonable search radius around the midpoint

## API Dependencies

The application relies on the following external APIs:

1. **LocationIQ**: For geocoding and POI search
   - Requires an API key stored in `.env` as `REACT_APP_LOCATIONIQ_KEY`
   - Free tier allows 10,000 requests per day

2. **OSRM**: For route calculation and travel time estimation
   - No API key required
   - Public API with usage limitations

## Performance Considerations

1. **Caching**: Implemented caching for geocoding and routing results to reduce API calls
2. **Resampling**: Reduced the number of points in routes to improve rendering performance
3. **Asynchronous Processing**: Used async/await for all API calls to prevent UI blocking

## Error Handling

The application includes comprehensive error handling:

1. **Input Validation**: Validates user inputs before making API calls
2. **API Error Handling**: Catches and processes errors from external APIs
3. **Fallbacks**: Provides fallback options when optimal data is not available
4. **User Feedback**: Displays meaningful error messages to the user

## Future Technical Improvements

1. **Backend Integration**: Move API calls to a backend service to hide API keys
2. **Advanced Caching**: Implement persistent caching to reduce API usage
3. **Route Optimization**: Add options for different route types (fastest, shortest, etc.)
4. **POI Filtering**: Add more sophisticated POI filtering and categorization
5. **Travel Mode Options**: Support for different travel modes (walking, public transit, etc.) 