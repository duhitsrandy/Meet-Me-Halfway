# Meet-Me-Halfway

A web application that helps users find equitable meeting points between two locations, with balanced travel times for both parties and nearby points of interest.

## Overview

Meet-Me-Halfway calculates the optimal midpoint between two locations where both parties have approximately equal travel times. The app then displays nearby points of interest (POIs) such as restaurants, cafes, and parks around this midpoint, making it easy to find convenient meeting places.

## Features

- **Balanced Midpoint Calculation**: Finds meeting points with equitable travel times for both parties
- **Multiple Route Options**: Provides both main and alternate routes with their respective midpoints
- **Points of Interest**: Displays nearby restaurants, cafes, and other venues around the midpoint
- **Travel Time Information**: Shows estimated drive times from each starting location to each POI
- **Interactive Map**: Visualizes routes, midpoints, and POIs on an interactive map
- **Recent Searches**: Saves recent location pairs for quick access

## Architecture

The application consists of two main components:

1. **Frontend**: A React application that handles the user interface, geocoding, routing, and midpoint calculations
2. **Backend**: Not currently used as all functionality is implemented in the frontend

### Key Components

- **Geocoding**: Uses LocationIQ API to convert addresses to coordinates
- **Routing**: Uses OSRM (Open Source Routing Machine) for route calculations
- **Midpoint Calculation**: Custom algorithm that finds points with balanced travel times
- **POI Search**: Uses LocationIQ to find nearby points of interest

## Technical Implementation

### Midpoint Calculation Algorithm

The app uses a sophisticated algorithm to find the optimal midpoint:

1. Calculates the total distance of the route
2. Finds the exact 50% distance point along the route
3. Uses linear interpolation for precise midpoint positioning
4. Ensures the midpoint is actually on the route

### Route Processing

To ensure consistent results across different route types:

1. Routes are resampled to create evenly distributed points
2. Both main and alternate routes use the same processing approach
3. Special handling is implemented for routes with few points

### API Integration

The app integrates with:

- **LocationIQ**: For geocoding and POI search
- **OSRM**: For route calculation and travel time estimation

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- LocationIQ API key

### Environment Setup

1. Clone the repository
2. Navigate to the Frontend directory
3. Create a `.env` file with your API key:
   ```
   REACT_APP_LOCATIONIQ_KEY=your_locationiq_api_key_here
   ```

### Installation

```bash
# Navigate to the Frontend directory
cd Frontend

# Install dependencies
npm install

# Start the development server
npm start
```

The application will be available at http://localhost:3000

## Key Files and Functions

### Frontend/src/App.js

This is the main application file containing all the core functionality:

- `geocodeLocation`: Converts addresses to coordinates using LocationIQ
- `calculateBestMidpoint`: Finds the optimal midpoint with balanced travel times
- `getRoute` and `getAlternateRoute`: Fetch route data from OSRM
- `searchPOIs`: Finds points of interest near the midpoint
- `processAndCalculateDriveTimes`: Calculates travel times to each POI
- `handleSubmit`: Main form submission handler that orchestrates the entire process

### Frontend/.env

Contains environment variables:

```
REACT_APP_LOCATIONIQ_KEY=your_locationiq_api_key_here
```

## Troubleshooting

### Common Issues

1. **401 Unauthorized errors**: Check that your LocationIQ API key is correct in the `.env` file
2. **CORS issues**: The app uses direct API calls which may encounter CORS restrictions
3. **No routes found**: Ensure the locations are reachable by car and are valid addresses

### Debugging

The application includes extensive console logging for debugging:
- Route information and processing
- Midpoint calculation details
- API responses and errors

## Future Improvements

Potential enhancements for the application:

1. Adding more POI categories and filtering options
2. Implementing user preferences for route types
3. Adding the ability to save favorite meeting points
4. Optimizing the UI for mobile devices
5. Adding backend functionality for more complex operations

## License

[MIT License](LICENSE)
