// Handle deep linking when users open shared links
export const handleDeepLink = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const placeId = window.location.pathname.split('/place/')[1];
  
  if (placeId) {
    const lat = urlParams.get('lat');
    const lng = urlParams.get('lng');
    const name = urlParams.get('name');
    
    if (lat && lng && name) {
      return {
        id: placeId,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        name: decodeURIComponent(name)
      };
    }
  }
  
  return null;
}; 