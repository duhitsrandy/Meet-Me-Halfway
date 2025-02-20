import requests
import time
from typing import List, Dict, Any

def find_nearby_pois(lat: float, lon: float, radius: int = 1500) -> List[Dict[Any, Any]]:
    """
    Find points of interest near a given location using OpenStreetMap's Overpass API
    Returns a list of POIs with their details
    """
    # Overpass API endpoint
    overpass_url = "https://overpass-api.de/api/interpreter"

    # Define the search query for various amenities
    overpass_query = f"""
    [out:json][timeout:25];
    (
      node["amenity"~"cafe|restaurant|fast_food|pub|bar"](around:{radius},{lat},{lon});
      node["shop"~"mall|supermarket|convenience"](around:{radius},{lat},{lon});
      node["leisure"~"park|fitness_centre"](around:{radius},{lat},{lon});
      way["amenity"~"cafe|restaurant|fast_food|pub|bar"](around:{radius},{lat},{lon});
      way["shop"~"mall|supermarket|convenience"](around:{radius},{lat},{lon});
      way["leisure"~"park|fitness_centre"](around:{radius},{lat},{lon});
    );
    out body;
    >;
    out skel qt;
    """

    try:
        # Make the API request
        response = requests.post(overpass_url, data={"data": overpass_query})
        data = response.json()

        if "elements" not in data:
            print("No POIs found in response")
            return _get_fallback_pois(lat, lon)

        pois = []
        for element in data["elements"]:
            if "tags" in element:
                tags = element["tags"]

                # Extract POI details
                name = tags.get("name", "Unnamed Location")
                poi_type = None

                # Determine POI type
                if "amenity" in tags:
                    poi_type = tags["amenity"].title()
                elif "shop" in tags:
                    poi_type = tags["shop"].title()
                elif "leisure" in tags:
                    poi_type = tags["leisure"].title()

                if poi_type and name != "Unnamed Location":
                    address_parts = []
                    if "addr:street" in tags:
                        address_parts.append(tags["addr:street"])
                    if "addr:housenumber" in tags:
                        address_parts.append(tags["addr:housenumber"])
                    if "addr:city" in tags:
                        address_parts.append(tags["addr:city"])

                    address = ", ".join(address_parts) if address_parts else "Address not available"

                    # Get coordinates
                    if element["type"] == "node":
                        poi_lat = element["lat"]
                        poi_lon = element["lon"]
                    else:
                        # For ways (areas), use the center coordinates
                        poi_lat = element.get("center", {}).get("lat", lat)
                        poi_lon = element.get("center", {}).get("lon", lon)

                    poi = {
                        'name': name,
                        'type': poi_type,
                        'lat': poi_lat,
                        'lon': poi_lon,
                        'address': address,
                        'details': {
                            'cuisine': tags.get('cuisine', ''),
                            'opening_hours': tags.get('opening_hours', ''),
                            'website': tags.get('website', '')
                        }
                    }
                    pois.append(poi)

        # Sort POIs by distance from the center point
        pois.sort(key=lambda x: ((x['lat'] - lat) ** 2 + (x['lon'] - lon) ** 2) ** 0.5)

        print(f"Found {len(pois)} POIs")
        return pois

    except Exception as e:
        print(f"Error finding POIs: {str(e)}")
        return _get_fallback_pois(lat, lon)

def _get_fallback_pois(lat: float, lon: float) -> List[Dict[str, Any]]:
    """
    Provide fallback POIs in case the API fails
    """
    return [
        {
            'name': 'Local Cafe',
            'type': 'Cafe',
            'lat': lat + 0.001,
            'lon': lon + 0.001,
            'address': 'Nearby Location',
            'details': {}
        },
        {
            'name': 'Public Park',
            'type': 'Park',
            'lat': lat - 0.001,
            'lon': lon - 0.001,
            'address': 'Nearby Location',
            'details': {}
        }
    ]