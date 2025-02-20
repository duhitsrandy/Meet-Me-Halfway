import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

function SetBoundsComponent({ bounds }) {
  const map = useMap();
  
  React.useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds);
    }
  }, [bounds, map]);

  return null;
}

const getDriveTimeClass = (minutes) => {
  if (minutes < 15) return 'quick';
  if (minutes < 30) return 'moderate';
  return 'long';
};

// Add mobile gesture handling
const MobileGestures = ({ setSelectedRoute }) => {
  const map = useMap();

  useEffect(() => {
    let touchStartTime;
    let touchStartPos;
    let isSwiping = false;

    const handleTouchStart = (e) => {
      if (e.touches.length === 1) {
        touchStartTime = Date.now();
        touchStartPos = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY
        };
      }
    };

    const handleTouchMove = (e) => {
      if (!touchStartPos) return;

      const deltaX = e.touches[0].clientX - touchStartPos.x;
      if (Math.abs(deltaX) > 50) {
        isSwiping = true;
      }
    };

    const handleTouchEnd = (e) => {
      if (!touchStartPos) return;

      const touchEndTime = Date.now();
      const touchDuration = touchEndTime - touchStartTime;

      // Handle long press (500ms)
      if (touchDuration > 500 && !isSwiping) {
        const containerPoint = map.mouseEventToContainerPoint(e.changedTouches[0]);
        const latlng = map.containerPointToLatLng(containerPoint);
        // Add marker or perform other long-press action
      }

      // Handle swipe between routes
      if (isSwiping) {
        const deltaX = e.changedTouches[0].clientX - touchStartPos.x;
        if (Math.abs(deltaX) > 100) {
          if (deltaX > 0) {
            // Swipe right - switch to main route
            setSelectedRoute('main');
          } else {
            // Swipe left - switch to alternate route
            setSelectedRoute('alternate');
          }
        }
      }

      touchStartPos = null;
      isSwiping = false;
    };

    const mapElement = map.getContainer();
    mapElement.addEventListener('touchstart', handleTouchStart);
    mapElement.addEventListener('touchmove', handleTouchMove);
    mapElement.addEventListener('touchend', handleTouchEnd);

    // Add pinch zoom handling
    let initialDistance = 0;
    const handleTouchStart2 = (e) => {
      if (e.touches.length === 2) {
        initialDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    };

    const handleTouchMove2 = (e) => {
      if (e.touches.length === 2) {
        const currentDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        
        if (initialDistance) {
          const delta = currentDistance - initialDistance;
          if (Math.abs(delta) > 10) {
            if (delta > 0) {
              map.zoomIn();
            } else {
              map.zoomOut();
            }
            initialDistance = currentDistance;
          }
        }
      }
    };

    mapElement.addEventListener('touchstart', handleTouchStart2);
    mapElement.addEventListener('touchmove', handleTouchMove2);

    return () => {
      mapElement.removeEventListener('touchstart', handleTouchStart);
      mapElement.removeEventListener('touchmove', handleTouchMove);
      mapElement.removeEventListener('touchend', handleTouchEnd);
      mapElement.removeEventListener('touchstart', handleTouchStart2);
      mapElement.removeEventListener('touchmove', handleTouchMove2);
    };
  }, [map, setSelectedRoute]);

  return null;
};

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
  // Add safety check for center coordinates
  const validCenter = Array.isArray(center) && center.length === 2 ? center : [40.7128, -74.0060];

  // Add custom touch controls
  const TouchControls = () => {
    const map = useMap();

    return (
      <div className="map-touch-controls">
        <button 
          className="map-control-btn"
          onClick={() => map.zoomIn()}
          aria-label="Zoom in"
        >
          +
        </button>
        <button 
          className="map-control-btn"
          onClick={() => map.zoomOut()}
          aria-label="Zoom out"
        >
          −
        </button>
        <button 
          className="map-control-btn locate"
          onClick={() => map.locate({setView: true, maxZoom: 16})}
          aria-label="Find my location"
        >
          📍
        </button>
      </div>
    );
  };

  return (
    <MapContainer
      key={validCenter.join(',')}
      center={validCenter}
      zoom={11}
      style={{ height: '100%', width: '100%' }}
      whenReady={onLoad}
      zoomControl={false}  // This disables the default zoom controls
      attributionControl={false}  // Optional: This will also remove the attribution text
    >
      <TouchControls />
      <MobileGestures setSelectedRoute={setSelectedRoute} />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      
      {mapBounds && (
        <SetBoundsComponent bounds={mapBounds} />
      )}

      {/* Main Route - Bold Blue */}
      {routes && (
        <Polyline
          positions={routes}
          pathOptions={{
            color: '#0052CC',
            weight: 4,
            opacity: selectedRoute === 'main' ? 0.9 : 0.5
          }}
          eventHandlers={{
            click: () => setSelectedRoute('main')
          }}
        />
      )}

      {/* Alternate Route - Bold Purple */}
      {alternateRouteCoordinates && (
        <Polyline
          positions={alternateRouteCoordinates}
          pathOptions={{
            color: '#9C27B0',
            weight: 4,
            opacity: selectedRoute === 'alternate' ? 0.9 : 0.5
          }}
          eventHandlers={{
            click: () => setSelectedRoute('alternate')
          }}
        />
      )}

      {/* Start Points */}
      {startPoints?.filter(point => point?.location?.lat && point?.location?.lng)
        .map((point, index) => (
          <Marker
            key={`start-${index}`}
            position={[point.location.lat, point.location.lng]}
            icon={L.icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
              shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41]
            })}
          >
            <Popup>{point.name}</Popup>
          </Marker>
        ))}

      {/* Main Route Middle Point */}
      {midpoint?.lat && midpoint?.lng && (
        <Marker 
          position={[midpoint.lat, midpoint.lng]}
          icon={L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          })}
        >
          <Popup>Main Route Middle Point</Popup>
        </Marker>
      )}

      {/* Alternate Route Middle Point */}
      {alternateMidpoint?.lat && alternateMidpoint?.lng && (
        <Marker 
          position={[alternateMidpoint.lat, alternateMidpoint.lng]}
          icon={L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          })}
        >
          <Popup>Alternate Route Middle Point</Popup>
        </Marker>
      )}

      {/* Places */}
      {places?.filter(place => place?.location?.lat && place?.location?.lng)
        .map((place, index) => (
          <Marker
            key={`poi-${index}`}
            position={[place.location.lat, place.location.lng]}
            icon={L.icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
              shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41]
            })}
          >
            <Popup>
              <div className="popup-content">
                <div className="popup-header">
                  <h3>{place.name}</h3>
                  <span className="category-tag">{place.category}</span>
                </div>
                <div className="popup-times">
                  <span>Loc 1: </span>
                  <span className={`time ${getDriveTimeClass(place.driveTimes?.from1)}`}>
                    {place.driveTimes?.from1}m
                  </span>
                  <span className="time-separator">|</span>
                  <span>Loc 2: </span>
                  <span className={`time ${getDriveTimeClass(place.driveTimes?.from2)}`}>
                    {place.driveTimes?.from2}m
                  </span>
                </div>
                <p className="address">{place.address}</p>
                <div className="popup-links">
                  <a href={place.mapLinks?.google} target="_blank" rel="noopener noreferrer">Google</a> |
                  <a href={place.mapLinks?.apple} target="_blank" rel="noopener noreferrer">Apple</a> |
                  <a href={place.mapLinks?.waze} target="_blank" rel="noopener noreferrer">Waze</a>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}

const WrappedMapComponent = React.memo(MapComponent);
export default WrappedMapComponent; 