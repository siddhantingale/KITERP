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
        const { session_id, student_identifier, batch_type, latitude, longitude, gps_accuracy, device_fingerprint } = body;

        // Validate required parameters
        if (!session_id || !student_identifier || !device_fingerprint) {
            return Response.json({ 
                success: false, 
                error: "Missing required parameters (session_id, student_identifier, device_fingerprint)" 
            }, { status: 400 });
        }

        // Validate GPS coordinates
        if (latitude === null || longitude === null || latitude === undefined || longitude === undefined) {
            return Response.json({ 
                success: false, 
                error: "GPS location is required. Please enable location services." 
            }, { status: 400 });
        }

        // Validate GPS are valid numbers
        if (typeof latitude !== 'number' || typeof longitude !== 'number' || isNaN(latitude) || isNaN(longitude)) {
            return Response.json({ 
                success: false, 
                error: "Invalid GPS coordinates received" 
            }, { status: 400 });
        }

        // Validate student identifier
        if (!student_identifier.trim()) {
            return Response.json({ 
                success: false, 
                error: "Invalid PRN/Roll number" 
            }, { status: 400 });
        }

        // Validate and get session data
        const sessionData = await client.asServiceRole.entities.Session.get(session_id);
        if (!sessionData) {
            return Response.json({ 
                success: false, 
                error: "Session not found or expired" 
            }, { status: 404 });
        }

        // Verify session is active
        if (sessionData.status === 'completed' || sessionData.status === 'cancelled') {
            return Response.json({ 
                success: false, 
                error: "This session has ended. Cannot access attendance portal." 
            }, { status: 400 });
        }

        // Find student by PRN or Roll Number
        let students = [];
        if (batch_type === 'private') {
            students = await client.asServiceRole.entities.Student.filter({
                batch_id: sessionData.batch_id,
                roll_no: student_identifier
            });
        } else {
            // Try PRN first
            students = await client.asServiceRole.entities.Student.filter({
                batch_id: sessionData.batch_id,
                prn: student_identifier
            });
            
            // If not found by PRN, try roll_no
            if (students.length === 0) {
                students = await client.asServiceRole.entities.Student.filter({
                    batch_id: sessionData.batch_id,
                    roll_no: student_identifier
                });
            }
        }

        if (students.length === 0) {
            return Response.json({ 
                success: false, 
                error: "Student not found in this batch" 
            }, { status: 404 });
        }

        const student = students[0];

        // Check geo-fence
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

        // Check if student already logged in this session
        const existing = await client.asServiceRole.entities.QRActiveStudent.filter({
            session_id,
            prn: student.prn || student.roll_no
        });

        if (existing.length > 0) {
            // Update existing record
            await client.asServiceRole.entities.QRActiveStudent.update(existing[0].id, {
                student_id: student.id,
                student_name: student.name,
                email: student.email,
                device_fingerprint,
                latitude,
                longitude,
                gps_accuracy,
                is_inside_geofence: isInsideGeofence,
                distance_from_geofence: distanceFromGeofence,
                last_active_at: new Date().toISOString()
            });
        } else {
            // Create new record
            await client.asServiceRole.entities.QRActiveStudent.create({
                session_id,
                student_id: student.id,
                prn: student.prn || student.roll_no,
                student_name: student.name,
                email: student.email,
                device_fingerprint,
                latitude,
                longitude,
                gps_accuracy,
                is_inside_geofence: isInsideGeofence,
                distance_from_geofence: distanceFromGeofence,
                portal_opened_at: new Date().toISOString(),
                last_active_at: new Date().toISOString(),
                status: 'active'
            });
        }

        return Response.json({ 
            success: true,
            is_inside_geofence: isInsideGeofence,
            distance: distanceFromGeofence,
            student_name: student.name
        });

    } catch (error) {
        console.error("Error logging portal access:", error);
        return Response.json({ 
            success: false, 
            error: "Internal server error",
            details: error.message 
        }, { status: 500 });
    }
});

export default handlerFor(import.meta.url);
