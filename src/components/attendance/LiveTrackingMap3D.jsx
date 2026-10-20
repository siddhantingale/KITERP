import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAPBOX_ACCESS_TOKEN } from './MapboxConfig';

const MAPBOX_TOKEN = MAPBOX_ACCESS_TOKEN;

export default function LiveTrackingMap3D({ geoFence, activeStudents }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef({});
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize 3D map
  useEffect(() => {
    if (!geoFence || map.current) return;

    // Check if valid Mapbox token is available
    if (!MAPBOX_TOKEN || MAPBOX_TOKEN.includes('example')) {
      console.error('Invalid or missing Mapbox token. Please set VITE_MAPBOX_ACCESS_TOKEN environment variable.');
      setMapLoaded(false);
      return;
    }

    try {
      // Initialize Mapbox map with 3D buildings and terrain
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [geoFence.longitude, geoFence.latitude],
        zoom: 17,
        pitch: 60, // 3D tilt
        bearing: -17.6,
        antialias: true,
        accessToken: MAPBOX_TOKEN
      });
    } catch (error) {
      console.error('Error initializing Mapbox:', error);
      setMapLoaded(false);
      return;
    }

    // Add navigation controls (zoom, rotate, pitch)
    map.current.addControl(new mapboxgl.NavigationControl({
      visualizePitch: true
    }), 'top-right');

    // Add 3D buildings layer
    map.current.on('load', () => {
      // Add 3D building layer
      const layers = map.current.getStyle().layers;
      const labelLayerId = layers.find(
        (layer) => layer.type === 'symbol' && layer.layout['text-field']
      )?.id;

      map.current.addLayer(
        {
          'id': '3d-buildings',
          'source': 'composite',
          'source-layer': 'building',
          'filter': ['==', 'extrude', 'true'],
          'type': 'fill-extrusion',
          'minzoom': 15,
          'paint': {
            'fill-extrusion-color': '#aaa',
            'fill-extrusion-height': [
              'interpolate',
              ['linear'],
              ['zoom'],
              15,
              0,
              15.05,
              ['get', 'height']
            ],
            'fill-extrusion-base': [
              'interpolate',
              ['linear'],
              ['zoom'],
              15,
              0,
              15.05,
              ['get', 'min_height']
            ],
            'fill-extrusion-opacity': 0.6
          }
        },
        labelLayerId
      );

      // Add geo-fence 3D circle
      if (geoFence) {
        // Create circle data
        const circleData = createCircle([geoFence.longitude, geoFence.latitude], geoFence.radius_meters);
        
        map.current.addSource('geofence', {
          'type': 'geojson',
          'data': circleData
        });

        // Add 3D extrusion for geo-fence
        map.current.addLayer({
          'id': 'geofence-fill',
          'type': 'fill-extrusion',
          'source': 'geofence',
          'paint': {
            'fill-extrusion-color': '#3b82f6',
            'fill-extrusion-opacity': 0.15,
            'fill-extrusion-height': 50
          }
        });

        map.current.addLayer({
          'id': 'geofence-outline',
          'type': 'line',
          'source': 'geofence',
          'paint': {
            'line-color': '#3b82f6',
            'line-width': 3,
            'line-dasharray': [2, 2]
          }
        });
      }

      setMapLoaded(true);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [geoFence]);

  // Update student markers in real-time
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Remove markers that are no longer active
    Object.keys(markers.current).forEach(studentId => {
      if (!activeStudents.find(s => s.id === studentId)) {
        markers.current[studentId].remove();
        delete markers.current[studentId];
      }
    });

    // Add or update markers for active students
    activeStudents.forEach(student => {
      if (!student.latitude || !student.longitude) return;

      const isInside = student.is_inside_geofence;
      const color = isInside ? '#10b981' : '#ef4444'; // Green or Red

      if (markers.current[student.id]) {
        // Update existing marker position with smooth animation
        const marker = markers.current[student.id];
        marker.setLngLat([student.longitude, student.latitude]);
        
        // Update color
        const el = marker.getElement();
        el.style.backgroundColor = color;
        el.style.borderColor = color;
      } else {
        // Create new 3D marker
        const el = document.createElement('div');
        el.className = 'student-marker-3d';
        el.style.width = '20px';
        el.style.height = '20px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = color;
        el.style.border = `3px solid ${color}`;
        el.style.boxShadow = `0 0 20px ${color}`;
        el.style.cursor = 'pointer';
        el.style.transition = 'all 0.3s ease';
        
        // Hover effect
        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.5)';
        });
        el.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)';
        });

        const marker = new mapboxgl.Marker({
          element: el,
          anchor: 'bottom'
        })
          .setLngLat([student.longitude, student.latitude])
          .setPopup(
            new mapboxgl.Popup({ offset: 25, closeButton: false })
              .setHTML(`
                <div class="p-2">
                  <p class="font-bold text-sm">${student.student_name || 'Student'}</p>
                  <p class="text-xs text-gray-600">PRN: ${student.prn}</p>
                  <p class="text-xs ${isInside ? 'text-green-600' : 'text-red-600'} font-semibold">
                    ${isInside ? '✓ Inside Zone' : '⚠ Outside Zone'}
                  </p>
                  ${student.distance_from_geofence ? `
                    <p class="text-xs text-gray-500">
                      Distance: ${Math.round(student.distance_from_geofence)}m
                    </p>
                  ` : ''}
                  <p class="text-xs text-gray-400">
                    Accuracy: ±${Math.round(student.gps_accuracy)}m
                  </p>
                </div>
              `)
          )
          .addTo(map.current);

        markers.current[student.id] = marker;
      }
    });
  }, [activeStudents, mapLoaded]);

  // Helper function to create circle GeoJSON
  function createCircle(center, radiusInMeters, points = 64) {
    const coords = {
      latitude: center[1],
      longitude: center[0]
    };

    const km = radiusInMeters / 1000;
    const ret = [];
    const distanceX = km / (111.32 * Math.cos((coords.latitude * Math.PI) / 180));
    const distanceY = km / 110.574;

    for (let i = 0; i < points; i++) {
      const theta = (i / points) * (2 * Math.PI);
      const x = distanceX * Math.cos(theta);
      const y = distanceY * Math.sin(theta);

      ret.push([coords.longitude + x, coords.latitude + y]);
    }
    ret.push(ret[0]);

    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [ret]
      }
    };
  }

  if (!geoFence) {
    return (
      <div className="h-[500px] bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="text-lg font-semibold">⚠️ No Geo-Fence Configured</p>
          <p className="text-sm mt-2">Please configure a geo-fence zone for this session</p>
        </div>
      </div>
    );
  }

  // Check for valid Mapbox token
  if (!MAPBOX_TOKEN || MAPBOX_TOKEN.includes('example')) {
    return (
      <div className="h-[500px] bg-gradient-to-br from-orange-50 to-red-50 rounded-lg flex items-center justify-center p-8">
        <div className="text-center max-w-2xl">
          <div className="text-6xl mb-4">🗺️</div>
          <p className="text-xl font-bold text-gray-800 mb-2">3D Maps Require Configuration</p>
          <p className="text-sm text-gray-600 mb-4">
            To enable 3D map tracking, you need a free Mapbox access token.
          </p>
          <div className="bg-white rounded-lg p-4 text-left text-xs space-y-2 shadow-md">
            <p className="font-bold text-gray-700">📋 Setup Instructions:</p>
            <ol className="list-decimal list-inside space-y-1 text-gray-600">
              <li>Get free token: <a href="https://account.mapbox.com/access-tokens/" target="_blank" className="text-blue-600 underline">https://account.mapbox.com/access-tokens/</a></li>
              <li>Open the <code className="bg-gray-100 px-1 rounded">.env</code> file in the EduTrack folder</li>
              <li>Add: <code className="bg-gray-100 px-1 rounded">VITE_MAPBOX_ACCESS_TOKEN</code> = your_token</li>
              <li>Restart the app</li>
            </ol>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            💡 Tip: Use the 2D View tab below for basic map tracking without configuration
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={mapContainer} className="h-[500px] rounded-lg shadow-xl overflow-hidden" />
      
      {/* Map Controls Info */}
      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md rounded-lg shadow-lg p-3 text-xs">
        <p className="font-bold text-gray-700 mb-1">🗺️ 3D Map Controls:</p>
        <p className="text-gray-600">• Drag: Pan map</p>
        <p className="text-gray-600">• Scroll: Zoom in/out</p>
        <p className="text-gray-600">• Right-click + Drag: Rotate & Tilt</p>
        <p className="text-gray-600">• Click marker: View details</p>
      </div>

      {/* Live Update Indicator */}
      <div className="absolute bottom-4 left-4 bg-green-500 text-white rounded-full px-3 py-1 text-xs font-bold shadow-lg flex items-center gap-2">
        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
        LIVE 3D TRACKING
      </div>

      <style jsx>{`
        .student-marker-3d {
          animation: marker-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes marker-pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }
      `}</style>
    </div>
  );
}