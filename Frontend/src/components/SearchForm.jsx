import React, { useState, useCallback } from 'react';
import { debounce } from 'lodash';

function SearchForm({ location1, setLocation1, location2, setLocation2, handleSubmit, isLoading }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Debounce the geocoding to avoid too many API calls
  const debouncedGeocode = useCallback(
    debounce((address, setLocation) => {
      // Geocode the address
      geocodeAddress(address)
        .then(result => setLocation(result))
        .catch(err => console.error('Geocoding error:', err));
    }, 500),
    []
  );
  
  const handleLocation1Change = (e) => {
    const value = e.target.value;
    setLocation1(value);
    if (value.length > 3) {
      debouncedGeocode(value, setGeocodedLocation1);
    }
  };
  
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };
  
  return (
    <div className={`search-container ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {!isExpanded ? (
        <div className="search-summary" onClick={toggleExpand}>
          <div className="search-locations">
            <span>{location1 || 'Enter location 1'}</span>
            <span className="separator">→</span>
            <span>{location2 || 'Enter location 2'}</span>
          </div>
          <button type="button" className="edit-search">
            Edit
          </button>
        </div>
      ) : (
        <form className="location-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <input
              type="text"
              value={location1}
              onChange={(e) => setLocation1(e.target.value)}
              placeholder="Enter first location"
              required
            />
          </div>
          
          <div className="form-group">
            <input
              type="text"
              value={location2}
              onChange={(e) => setLocation2(e.target.value)}
              placeholder="Enter second location"
              required
            />
          </div>
          
          <div className="form-actions">
            <button type="submit" disabled={isLoading} className="find-midpoint-btn">
              {isLoading ? 'Calculating...' : 'Find Midpoint'}
            </button>
            <button type="button" onClick={toggleExpand} className="cancel-button">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default SearchForm; 