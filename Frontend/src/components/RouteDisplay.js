import React from 'react';
import { Polyline } from 'react-leaflet';

const RouteDisplay = ({ routes, selectedRoute, onRouteSelect }) => (
  <>
    {routes.map((route, index) => (
      <Polyline
        key={index}
        positions={route.coordinates}
        pathOptions={{
          color: route.type === 'main' ? '#0052CC' : '#9C27B0',
          weight: 4,
          opacity: selectedRoute === route.type ? 0.9 : 0.5
        }}
        eventHandlers={{
          click: () => onRouteSelect(route.type)
        }}
      />
    ))}
  </>
);

export default React.memo(RouteDisplay); 