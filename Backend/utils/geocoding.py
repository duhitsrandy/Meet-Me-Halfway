from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut

def geocode_address(address):
    """
    Convert address to coordinates using Nominatim geocoder
    """
    try:
        geolocator = Nominatim(user_agent="meeting_point_finder")
        location = geolocator.geocode(address)
        if location:
            return [location.latitude, location.longitude]
        return None
    except GeocoderTimedOut:
        raise Exception("Geocoding service timed out. Please try again.")
    except Exception as e:
        raise Exception(f"Error geocoding address: {str(e)}")
