import React from 'react';

const PlaceCard = ({ place, onViewMap, getDriveTimeClass, formatCategory }) => (
  <div className="place-card">
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
      onClick={() => onViewMap(place.location)}
    >
      View on Map
    </button>
  </div>
);

export default React.memo(PlaceCard); 