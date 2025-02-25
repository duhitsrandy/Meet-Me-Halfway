import React from 'react';
import Map from './Map';

function MapComponent({ 
  center, 
  routes, 
  places, 
  startPoints, 
  midpoint, 
  alternateMidpoint, 
  alternateRouteCoordinates,
  selectedRoute,
  setSelectedRoute,
  mapBounds,
  onLoad
}) {
  // Prepare markers for the Map component
  const markers = [];
  
  // Add start points
  if (startPoints && startPoints.length) {
    startPoints.forEach(point => {
      markers.push({
        lat: point.location.lat,
        lng: point.location.lng,
        name: point.name,
        type: 'start-point',
        icon: '📍',
        popup: `<strong>${point.name}</strong><br>Start Location`
      });
    });
  }
  
  // Add midpoint
  if (midpoint) {
    markers.push({
      lat: midpoint.lat,
      lng: midpoint.lng,
      name: 'Midpoint',
      type: 'midpoint',
      icon: '⭐',
      popup: '<strong>Midpoint</strong><br>Best meeting point'
    });
  }
  
  // Add alternate midpoint if available
  if (alternateMidpoint) {
    markers.push({
      lat: alternateMidpoint.lat,
      lng: alternateMidpoint.lng,
      name: 'Alternative Midpoint',
      type: 'alt-midpoint',
      icon: '✨',
      popup: '<strong>Alternative Midpoint</strong><br>Another good meeting point'
    });
  }
  
  // Add place markers
  if (places && places.length) {
    places.forEach(place => {
      markers.push({
        lat: place.location.lat,
        lng: place.location.lng,
        name: place.name,
        type: 'place',
        icon: '🏢',
        popup: `<strong>${place.name}</strong><br>${place.category}<br>Drive times: ${place.driveTimes.from1}m / ${place.driveTimes.from2}m`,
        onClick: () => {
          // Handle marker click if needed
        }
      });
    });
  }
  
  // Prepare routes for the Map component
  const routeData = [];
  
  if (routes) {
    routeData.push({
      path: routes,
      color: '#0066CC',
      weight: 5
    });
  }
  
  if (alternateRouteCoordinates) {
    routeData.push({
      path: alternateRouteCoordinates,
      color: '#8800CC',
      weight: 5,
      dashArray: '5, 10'
    });
  }
  
  // Call onLoad when component mounts
  React.useEffect(() => {
    if (onLoad) {
      onLoad();
    }
  }, [onLoad]);

  return (
    <Map 
      center={center} 
      markers={markers} 
      routes={routeData} 
    />
  );
}

export default MapComponent; 