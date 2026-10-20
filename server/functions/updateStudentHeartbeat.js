import { createClientFromRequest, serve, handlerFor } from '../lib/sdk.js';

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
}

serve(async (req) => {
    try {
        const client = createClientFromRequest(req);
        
        const body = await req.json();
        const { session_id, device_fingerprint, latitude, longitude, gps_accuracy } = body;

        // Validate required parameters
        if (!session_id || !device_fingerprint) {
            return Response.json({ 
                success: false, 
                error: "Missing session_id or device_fingerprint" 
            }, { status: 400 });
        }

        // Validate GPS coordinates
        if (latitude === null || longitude === null || latitude === undefined || longitude === undefined) {
            return Response.json({ 
                success: false, 
                error: "GPS location is required" 
            }, { status: 400 });
        }

        // Validate GPS are valid numbers
        if (typeof latitude !== 'number' || typeof longitude !== 'number' || isNaN(latitude) || isNaN(longitude)) {
            return Response.json({ 
                success: false, 
                error: "Invalid GPS coordinates" 
            }, { status: 400 });
        }

        // Validate session exists first
        const sessions = await client.asServiceRole.entities.Session.filter({ id: session_id });
        
        if (sessions.length === 0) {
            return Response.json({ 
                success: false, 
                error: "Session not found" 
            }, { status: 404 });
        }

        // Find active student record by device fingerprint and session
        const activeStudents = await client.asServiceRole.entities.QRActiveStudent.filter({
            session_id,
            device_fingerprint,
            status: 'active'
        });

        if (activeStudents.length === 0) {
            return Response.json({ 
                success: false, 
                error: "No active session found. Please submit your PRN first." 
            }, { status: 404 });
        }

        const activeStudent = activeStudents[0];

        // Get geo-fence zones
        const geoFenceZones = await client.asServiceRole.entities.GeoFenceZone.filter({ 
            session_id,
            is_active: true 
        });

        let isInsideGeofence = false;
        let distanceFromGeofence = null;

        if (geoFenceZones.length > 0) {
            for (const zone of geoFenceZones) {
                const distance = calculateDistance(
                    latitude, 
                    longitude, 
                    zone.latitude, 
                    zone.longitude
                );
                
                if (distance <= zone.radius_meters) {
                    isInsideGeofence = true;
                    distanceFromGeofence = 0;
                    break;
                }
                
                if (distanceFromGeofence === null || distance < distanceFromGeofence) {
                    distanceFromGeofence = distance;
                }
            }
        } else {
            // No geo-fence configured, consider inside
            isInsideGeofence = true;
            distanceFromGeofence = 0;
        }

        // Update location and status
        await client.asServiceRole.entities.QRActiveStudent.update(activeStudent.id, {
            latitude,
            longitude,
            gps_accuracy,
            is_inside_geofence: isInsideGeofence,
            distance_from_geofence: distanceFromGeofence,
            last_active_at: new Date().toISOString()
        });

        return Response.json({ 
            success: true,
            is_inside_geofence: isInsideGeofence,
            distance: distanceFromGeofence
        });

    } catch (error) {
        console.error("Error updating heartbeat:", error);
        return Response.json({ 
            success: false, 
            error: "Internal server error",
            details: error.message 
        }, { status: 500 });
    }
});

export default handlerFor(import.meta.url);
