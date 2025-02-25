import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Share } from '@capacitor/share';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// Check if running in native app
export const isNative = Capacitor.isNativePlatform();

// Get current location with native accuracy if available
export const getCurrentLocation = async () => {
  try {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000
    });
    
    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy
    };
  } catch (error) {
    console.error('Error getting location', error);
    throw error;
  }
};

// Share a place using native share sheet
export const sharePlace = async (place) => {
  if (!isNative) {
    // Fallback for web
    return navigator.share?.({
      title: `Check out ${place.name}`,
      text: `I found a great meeting point: ${place.name}`,
      url: `${window.location.origin}/place/${place.id}?lat=${place.lat}&lng=${place.lng}&name=${encodeURIComponent(place.name)}`
    });
  }
  
  try {
    await Share.share({
      title: `Check out ${place.name}`,
      text: `I found a great meeting point: ${place.name}`,
      url: `${window.location.origin}/place/${place.id}?lat=${place.lat}&lng=${place.lng}&name=${encodeURIComponent(place.name)}`,
      dialogTitle: 'Share this meeting point'
    });
  } catch (error) {
    console.error('Error sharing', error);
  }
};

// Provide haptic feedback for better touch experience
export const provideFeedback = async (type = 'medium') => {
  if (!isNative) return;
  
  try {
    switch (type) {
      case 'light':
        await Haptics.impact({ style: ImpactStyle.Light });
        break;
      case 'medium':
        await Haptics.impact({ style: ImpactStyle.Medium });
        break;
      case 'heavy':
        await Haptics.impact({ style: ImpactStyle.Heavy });
        break;
      case 'success':
        await Haptics.notification({ type: 'SUCCESS' });
        break;
      case 'error':
        await Haptics.notification({ type: 'ERROR' });
        break;
      default:
        await Haptics.impact({ style: ImpactStyle.Medium });
    }
  } catch (error) {
    console.error('Haptics error', error);
  }
}; 