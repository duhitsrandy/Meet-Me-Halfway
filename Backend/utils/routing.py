import numpy as np
from geopy.distance import geodesic
import requests
from typing import List, Tuple, Optional, Dict, Any

def calculate_midpoint(route: List[List[float]]) -> Optional[List[float]]:
    """
    Calculate a meeting point along the actual route that minimizes travel time difference
    """
    if not route or len(route) < 2:
        return None

    # Try different points along the route to find the most equitable point
    best_point = None
    min_time_diff = float('inf')

    # Test points at different percentages along the route
    percentages = [0.3, 0.4, 0.45, 0.5, 0.55, 0.6, 0.7]

    for p in percentages:
        index = int(len(route) * p)
        test_point = route[index]

        if not test_point:
            continue

        # Calculate travel times from both endpoints to this point
        time1 = calculate_travel_time(route[0], test_point)
        time2 = calculate_travel_time(route[-1], test_point)

        if time1 is None or time2 is None:
            continue

        # Calculate the difference in travel times
        time_diff = abs(time1 - time2)

        # Update best point if this gives more equal times
        if time_diff < min_time_diff:
            min_time_diff = time_diff
            best_point = test_point

    return best_point if best_point else route[len(route)//2]

def calculate_route(point1: List[float], point2: List[float], alternatives: bool = False) -> List[List[List[float]]]:
    """
    Calculate driving routes between two points using OSRM
    Returns a list of routes, each containing a list of coordinates
    """
    if not point1 or not point2:
        return [[point1, point2]]  # Return direct route if points are invalid

    # Format coordinates for OSRM
    coords = f"{point1[1]},{point1[0]};{point2[1]},{point2[0]}"

    # Call OSRM service
    url = f"http://router.project-osrm.org/route/v1/driving/{coords}?overview=full&geometries=geojson&alternatives={'true' if alternatives else 'false'}"
    try:
        response = requests.get(url, timeout=10)
        data = response.json()

        if data.get("code") == "Ok" and data.get("routes"):
            routes = []
            for route in data["routes"]:
                if "geometry" in route and "coordinates" in route["geometry"]:
                    # OSRM returns [lon, lat], we need [lat, lon]
                    coords = [[coord[1], coord[0]] for coord in route["geometry"]["coordinates"]]
                    routes.append(coords)
            return routes if routes else [[point1, point2]]
    except Exception as e:
        print(f"Error calculating route: {str(e)}")

    return [[point1, point2]]  # Fallback to direct route if OSRM fails

def calculate_travel_time(point1: List[float], point2: List[float]) -> Optional[float]:
    """
    Calculate driving time between two points using OSRM
    Returns estimated time in minutes, adjusted for typical driving speeds (10% above limit)
    """
    if not point1 or not point2:
        return None

    coords = f"{point1[1]},{point1[0]};{point2[1]},{point2[0]}"
    url = f"http://router.project-osrm.org/route/v1/driving/{coords}"

    try:
        response = requests.get(url, timeout=10)
        data = response.json()

        if data.get("code") == "Ok" and data.get("routes"):
            # OSRM returns duration in seconds, convert to minutes
            # Apply 10% reduction to account for driving above speed limit
            duration_minutes = data["routes"][0]["duration"] / 60
            adjusted_duration = duration_minutes * 0.91  # Reduce time by ~10%
            return round(adjusted_duration)
    except Exception as e:
        print(f"Error calculating travel time: {str(e)}")
        # Fallback to simple distance-based estimation
        try:
            distance = geodesic(point1, point2).kilometers
            # Assume average speed of 66 km/h (10% above 60 km/h)
            return round(distance / 66 * 60)  # Convert to minutes
        except Exception as e:
            print(f"Error calculating distance: {str(e)}")
            return None

    return None