import streamlit as st
import folium
from streamlit_folium import folium_static
from utils.geocoding import geocode_address
from utils.routing import calculate_midpoint, calculate_route, calculate_travel_time
from utils.poi import find_nearby_pois
from models import db, Route, MeetingPoint, POI
from app import app
import json
from datetime import datetime
from utils.cost_calculator import calculate_route_costs

# Page configuration
st.set_page_config(
    page_title="Meet Me Halfway",
    layout="wide"
)

# Custom CSS for styling
st.markdown("""
    <style>
    .main {
        background-color: #f0f2f6;
    }
    .stButton>button {
        width: 100%;
    }
    .stExpander {
        background-color: white;
        border-radius: 5px;
        margin-bottom: 10px;
    }
    </style>
    """, unsafe_allow_html=True)

# Initialize session state
if 'location1' not in st.session_state:
    st.session_state.location1 = ""
if 'location2' not in st.session_state:
    st.session_state.location2 = ""

# Initialize Flask app context
app_ctx = app.app_context()
app_ctx.push()

try:
    # Landing page with improved layout
    st.title("Meet Me Halfway")
    st.subheader("Find your perfect meeting point")

    col1, col2 = st.columns([3, 1])

    with col1:
        with st.container():
            location1 = st.text_input("📍 Enter first location", 
                key="loc1",
                placeholder="Enter address, city, or landmark")

            location2 = st.text_input("📍 Enter second location", 
                key="loc2",
                placeholder="Enter address, city, or landmark")

            if st.button("Find Midpoint", key="find_button"):
                if location1 and location2:
                    try:
                        with st.spinner('Finding the best meeting points...'):
                            # Geocode both locations
                            point1 = geocode_address(location1)
                            point2 = geocode_address(location2)

                            if point1 and point2:
                                # Calculate routes and find meeting points
                                routes = calculate_route(point1, point2, alternatives=True)

                                if not routes:
                                    st.error("Unable to calculate routes between the specified locations.")
                                    st.stop()

                                # Store route in database
                                route_db = Route(
                                    start_location=location1,
                                    end_location=location2,
                                    start_lat=point1[0],
                                    start_lon=point1[1],
                                    end_lat=point2[0],
                                    end_lon=point2[1]
                                )
                                db.session.add(route_db)
                                db.session.flush()

                                # Process each route
                                colors = ['purple', 'blue', 'green']

                                # Create map centered on the first route's midpoint
                                if routes:
                                    first_route_midpoint = calculate_midpoint(routes[0])
                                    m = folium.Map(location=[first_route_midpoint[0], first_route_midpoint[1]], zoom_start=10)
                                else:
                                    m = folium.Map(location=[0, 0], zoom_start=2)

                                for i, route in enumerate(routes[:3]):
                                    route_midpoint = calculate_midpoint(route)
                                    if not route_midpoint:
                                        continue

                                    # Calculate costs for this route
                                    route_costs = calculate_route_costs(route)

                                    # Store meeting point
                                    meeting_point_db = MeetingPoint(
                                        route_id=route_db.id,
                                        lat=route_midpoint[0],
                                        lon=route_midpoint[1],
                                        travel_time1=calculate_travel_time(point1, route_midpoint),
                                        travel_time2=calculate_travel_time(point2, route_midpoint)
                                    )
                                    db.session.add(meeting_point_db)
                                    db.session.flush()

                                    # Add route to map with detailed popup
                                    route_popup = f"""
                                    <div style='min-width: 200px; padding: 10px;'>
                                        <h4>Route {colors[i].title()}</h4>
                                        <p>Distance: {route_costs['distance_miles']:.1f} miles</p>
                                        <p>Est. Fuel Cost: ${route_costs['fuel_cost']:.2f}</p>
                                        <p>Total Cost: ${route_costs['total_cost']:.2f}</p>
                                    </div>
                                    """

                                    folium.PolyLine(
                                        route,
                                        weight=3,
                                        color=colors[i],
                                        opacity=0.8,
                                        popup=folium.Popup(route_popup)
                                    ).add_to(m)

                                    # Find and add POIs near this route's midpoint
                                    pois = find_nearby_pois(route_midpoint[0], route_midpoint[1])

                                    if pois:
                                        for poi in pois:
                                            # Create detailed POI popup
                                            poi_popup = f"""
                                            <div style='min-width: 200px; padding: 10px;'>
                                                <h4>{poi['name']}</h4>
                                                <p><i>{poi['type']}</i></p>
                                                <p>{poi['address']}</p>
                                                <p>Travel time from {location1}: {meeting_point_db.travel_time1} min</p>
                                                <p>Travel time from {location2}: {meeting_point_db.travel_time2} min</p>
                                                <div style='margin-top: 10px;'>
                                                    <a href='https://www.google.com/maps/dir/?api=1&destination={poi['lat']},{poi['lon']}' target='_blank'>🗺️ Open in Google Maps</a><br>
                                                    <a href='https://www.waze.com/ul?ll={poi['lat']},{poi['lon']}&navigate=yes' target='_blank'>🚗 Open in Waze</a><br>
                                                    <a href='http://maps.apple.com/?daddr={poi['lat']},{poi['lon']}' target='_blank'>🍎 Open in Apple Maps</a>
                                                </div>
                                            </div>
                                            """

                                            folium.Marker(
                                                [poi['lat'], poi['lon']],
                                                popup=folium.Popup(poi_popup, max_width=300),
                                                icon=folium.Icon(color=colors[i], icon='info-sign')
                                            ).add_to(m)

                                # Add markers for start and end points
                                folium.Marker(
                                    point1,
                                    popup=f"Location 1: {location1}",
                                    icon=folium.Icon(color='red', icon='info-sign')
                                ).add_to(m)

                                folium.Marker(
                                    point2,
                                    popup=f"Location 2: {location2}",
                                    icon=folium.Icon(color='blue', icon='info-sign')
                                ).add_to(m)

                                # Commit all database changes
                                db.session.commit()

                                # Display the map
                                st.markdown("### 🗺️ Meeting Points Map")
                                folium_static(m, height=600)

                    except Exception as e:
                        st.error(f"An error occurred: {str(e)}")
                        db.session.rollback()
                else:
                    st.error("Please enter both locations")

except Exception as e:
    st.error(f"An unexpected error occurred: {e}")

finally:
    # Clean up Flask context
    app_ctx.pop()