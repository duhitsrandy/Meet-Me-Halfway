from typing import Dict, Any, Optional
import requests
from geopy.distance import geodesic

def calculate_route_costs(route: list, fuel_price_per_gallon: float = 3.50) -> Dict[str, Any]:
    """
    Calculate estimated costs for a route based on distance and current fuel prices
    Returns a dictionary with distance, fuel cost, and total cost
    """
    if not route or len(route) < 2:
        return {
            'distance_km': 0,
            'distance_miles': 0,
            'fuel_cost': 0,
            'total_cost': 0
        }

    # Calculate total distance in kilometers
    total_distance_km = 0
    for i in range(len(route) - 1):
        point1 = route[i]
        point2 = route[i + 1]
        total_distance_km += geodesic(point1, point2).kilometers

    # Convert to miles
    total_distance_miles = total_distance_km * 0.621371

    # Estimate fuel consumption (assuming 25 MPG average)
    gallons_needed = total_distance_miles / 25
    fuel_cost = gallons_needed * fuel_price_per_gallon

    # Add 10% for misc costs (tolls, wear and tear)
    total_cost = fuel_cost * 1.1

    return {
        'distance_km': round(total_distance_km, 2),
        'distance_miles': round(total_distance_miles, 2),
        'fuel_cost': round(fuel_cost, 2),
        'total_cost': round(total_cost, 2)
    }

def get_current_fuel_price(location: str = "US Average") -> Optional[float]:
    """
    Get current fuel price for a location
    Falls back to default price if API fails
    """
    # For now, return a default value
    # TODO: Implement actual fuel price API integration
    return 3.50
