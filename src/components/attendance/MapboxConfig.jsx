// Mapbox Configuration
// To use Mapbox 3D maps, you need to set your Mapbox access token
// 
// Get your free token from: https://account.mapbox.com/access-tokens/
// 
// OPTION 1: Put it in the .env file at the project root:
//   VITE_MAPBOX_ACCESS_TOKEN=pk.your_token   (then restart "npm run dev" / rebuild)
// 
// OPTION 2: Replace the token below (not recommended for production)

export const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoiZWR1dHJhY2siLCJhIjoiY2x5MHh5enl6MGFvZDJrcjN4YzB6cGJ6ZiJ9.example';

// Fallback: If no token is provided, the 2D map will be used automatically
export const USE_3D_MAPS = !!MAPBOX_ACCESS_TOKEN && MAPBOX_ACCESS_TOKEN !== 'pk.eyJ1IjoiZWR1dHJhY2siLCJhIjoiY2x5MHh5enl6MGFvZDJrcjN4YzB6cGJ6ZiJ9.example';

export default {
  MAPBOX_ACCESS_TOKEN,
  USE_3D_MAPS
};