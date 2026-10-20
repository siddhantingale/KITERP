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

// Generate device fingerprint from headers
function generateDeviceFingerprint(req, userAgent) {
    const components = [
        userAgent || 'unknown',
        req.headers.get('accept-language') || '',
        req.headers.get('accept-encoding') || '',
        req.headers.get('sec-ch-ua-platform') || ''
    ];
    return btoa(components.join('|')).substring(0, 32);
}

serve(async (req) => {
    try {
        const client = createClientFromRequest(req);
        
        // Parse request body
        const body = await req.json();
        const { 
            session_id, 
            timestamp, 
            student_identifier, 
            batch_type,
            latitude,
            longitude,
            gps_accuracy,
            user_agent
        } = body;

        // Generate device fingerprint and get IP
        const deviceFingerprint = generateDeviceFingerprint(req, user_agent);
        const ipAddress = req.headers.get('cf-connecting-ip') || 
                         req.headers.get('x-forwarded-for') || 
                         req.headers.get('x-real-ip') || 
                         'unknown';

        // SECURITY CHECK 1: Validate required parameters
        if (!session_id || !timestamp || !student_identifier) {
            return Response.json({ 
                success: false, 
                error: "Missing required parameters (session_id, timestamp, student_identifier)" 
            }, { status: 400 });
        }

        // Validate student identifier format
        if (!student_identifier.trim()) {
            return Response.json({ 
                success: false, 
                error: "Invalid PRN/Roll number format" 
            }, { status: 400 });
        }

        // SECURITY CHECK: Validate GPS data
        if (latitude === null || longitude === null || latitude === undefined || longitude === undefined) {
            return Response.json({ 
                success: false, 
                error: "Location access is required to mark attendance. Please enable GPS and try again.",
                requires_location: true
            }, { status: 400 });
        }

        // Validate GPS are valid numbers
        if (typeof latitude !== 'number' || typeof longitude !== 'number' || isNaN(latitude) || isNaN(longitude)) {
            return Response.json({ 
                success: false, 
                error: "Invalid GPS coordinates received",
                requires_location: true
            }, { status: 400 });
        }

        if (!gps_accuracy || gps_accuracy > 100) {
            return Response.json({ 
                success: false, 
                error: `GPS accuracy too low (${Math.round(gps_accuracy)}m). Please ensure GPS is enabled and try again in an open area.`,
                requires_location: true
            }, { status: 400 });
        }

        // SECURITY CHECK 2: Validate timestamp (45-second expiry)
        const qrTimestamp = parseInt(timestamp);
        const now = Date.now();
        const qrAge = (now - qrTimestamp) / 1000;

        if (isNaN(qrTimestamp) || qrTimestamp <= 0) {
            return Response.json({ 
                success: false, 
                error: "Invalid timestamp" 
            }, { status: 400 });
        }

        if (qrTimestamp > now + 5000) {
            return Response.json({ 
                success: false, 
                error: "Invalid QR code - timestamp is in the future" 
            }, { status: 400 });
        }

        if (qrAge > 120) {
            return Response.json({ 
                success: false, 
                error: `QR code expired ${Math.floor(qrAge)} seconds ago. Please ask your faculty for a new QR code.`,
                expired: true
            }, { status: 400 });
        }

        // Validate session exists and matches the request
        const sessionData = await client.asServiceRole.entities.Session.get(session_id);
        
        if (!sessionData) {
            return Response.json({ 
                success: false, 
                error: "Session not found. Please scan a valid QR code." 
            }, { status: 404 });
        }

        // Verify session is still active
        if (sessionData.status === 'completed' || sessionData.status === 'cancelled') {
            return Response.json({ 
                success: false, 
                error: "This attendance session has ended. Cannot submit attendance." 
            }, { status: 400 });
        }

        // Check for geo-fence zone
        const geoFenceZones = await client.asServiceRole.entities.GeoFenceZone.filter({ 
            session_id,
            is_active: true 
        });

        let insideGeoFence = false;
        let distanceFromGeoFence = null;
        let geoFenceLocation = null;

        if (geoFenceZones.length > 0) {
            // Check if student is inside any of the geo-fences
            for (const zone of geoFenceZones) {
                const distance = calculateDistance(
                    latitude, 
                    longitude, 
                    zone.latitude, 
                    zone.longitude
                );
                
                if (distance <= zone.radius_meters) {
                    insideGeoFence = true;
                    geoFenceLocation = zone.location_name;
                    break;
                }
                
                // Track minimum distance for logging
                if (distanceFromGeoFence === null || distance < distanceFromGeoFence) {
                    distanceFromGeoFence = distance;
                    geoFenceLocation = zone.location_name;
                }
            }

            // SECURITY: Block if outside geo-fence
            if (!insideGeoFence) {
                // Log proxy attempt
                await client.asServiceRole.entities.ProxyDetectionLog.create({
                    session_id,
                    student_identifier,
                    device_fingerprint: deviceFingerprint,
                    ip_address: ipAddress,
                    latitude,
                    longitude,
                    gps_accuracy,
                    distance_from_geofence: distanceFromGeoFence,
                    violation_type: "outside_geofence",
                    risk_score: Math.min(100, distanceFromGeoFence / 10),
                    details: `Student is ${Math.round(distanceFromGeoFence)}m away from ${geoFenceLocation}`,
                    timestamp: new Date().toISOString(),
                    status: "flagged"
                });

                // Log submission attempt
                await client.asServiceRole.entities.AttendanceSubmissionLog.create({
                    session_id,
                    student_identifier,
                    device_fingerprint: deviceFingerprint,
                    ip_address: ipAddress,
                    user_agent,
                    latitude,
                    longitude,
                    gps_accuracy,
                    submission_timestamp: new Date().toISOString(),
                    qr_timestamp: timestamp,
                    success: false,
                    failure_reason: "outside_geofence",
                    is_suspicious: true
                });

                return Response.json({ 
                    success: false, 
                    error: `⛔ You are outside the classroom area (${Math.round(distanceFromGeoFence)}m away from ${geoFenceLocation}). Please move closer to mark attendance.`,
                    outside_geofence: true,
                    distance: Math.round(distanceFromGeoFence)
                }, { status: 403 });
            }
        }

        // Find student by PRN or Roll Number
        let student = null;
        const isPrivateBatch = batch_type === 'private';

        if (!isPrivateBatch) {
            // Standard/Custom batch: Try PRN first, then roll number
            const studentsByPRN = await client.asServiceRole.entities.Student.filter({ 
                batch_id: sessionData.batch_id, 
                prn: student_identifier.trim() 
            });
            
            if (studentsByPRN.length > 0) {
                student = studentsByPRN[0];
            } else {
                const studentsByRoll = await client.asServiceRole.entities.Student.filter({ 
                    batch_id: sessionData.batch_id, 
                    roll_no: student_identifier.trim() 
                });
                if (studentsByRoll.length > 0) {
                    student = studentsByRoll[0];
                }
            }
        } else {
            // Private batch: Search by roll number only
            const studentsByRoll = await client.asServiceRole.entities.Student.filter({ 
                batch_id: sessionData.batch_id, 
                roll_no: student_identifier.trim() 
            });
            if (studentsByRoll.length > 0) {
                student = studentsByRoll[0];
            }
        }

        if (!student) {
            // Log failed attempt with unknown student
            await client.asServiceRole.entities.AttendanceSubmissionLog.create({
                session_id,
                student_identifier,
                device_fingerprint: deviceFingerprint,
                ip_address: ipAddress,
                user_agent,
                latitude,
                longitude,
                gps_accuracy,
                submission_timestamp: new Date().toISOString(),
                qr_timestamp: timestamp,
                success: false,
                failure_reason: "student_not_found",
                is_suspicious: false
            });

            return Response.json({ 
                success: false, 
                error: isPrivateBatch 
                    ? "Roll number not found in this batch. Please check and try again." 
                    : "PRN or roll number not found in this batch. Please check and try again."
            }, { status: 404 });
        }

        // PROXY DETECTION: Check for duplicate device fingerprint with different PRN
        const sameDeviceSubmissions = await client.asServiceRole.entities.AttendanceSubmissionLog.filter({
            session_id,
            device_fingerprint: deviceFingerprint,
            success: true
        });

        if (sameDeviceSubmissions.length > 0) {
            const previousPRN = sameDeviceSubmissions[0].student_identifier;
            if (previousPRN !== student_identifier) {
                // Log proxy attempt
                await client.asServiceRole.entities.ProxyDetectionLog.create({
                    session_id,
                    student_id: student.id,
                    student_identifier,
                    device_fingerprint: deviceFingerprint,
                    ip_address: ipAddress,
                    latitude,
                    longitude,
                    gps_accuracy,
                    violation_type: "multiple_prns_same_device",
                    risk_score: 95,
                    details: `Same device used for ${previousPRN} and ${student_identifier}`,
                    timestamp: new Date().toISOString(),
                    status: "flagged"
                });

                await client.asServiceRole.entities.AttendanceSubmissionLog.create({
                    session_id,
                    student_id: student.id,
                    student_identifier,
                    device_fingerprint: deviceFingerprint,
                    ip_address: ipAddress,
                    user_agent,
                    latitude,
                    longitude,
                    gps_accuracy,
                    submission_timestamp: new Date().toISOString(),
                    qr_timestamp: timestamp,
                    success: false,
                    failure_reason: "duplicate_device",
                    is_suspicious: true
                });

                return Response.json({ 
                    success: false, 
                    error: `⛔ Proxy attendance detected! This device was already used to mark attendance for another student (${previousPRN}). Contact your faculty immediately.`,
                    proxy_detected: true
                }, { status: 403 });
            }
        }

        // PROXY DETECTION: Check for duplicate PRN from different devices
        const samePRNSubmissions = await client.asServiceRole.entities.AttendanceSubmissionLog.filter({
            session_id,
            student_identifier,
            success: true
        });

        if (samePRNSubmissions.length > 0 && samePRNSubmissions[0].device_fingerprint !== deviceFingerprint) {
            // Log proxy attempt
            await client.asServiceRole.entities.ProxyDetectionLog.create({
                session_id,
                student_id: student.id,
                student_identifier,
                device_fingerprint: deviceFingerprint,
                ip_address: ipAddress,
                latitude,
                longitude,
                gps_accuracy,
                violation_type: "duplicate_prn",
                risk_score: 90,
                details: `PRN ${student_identifier} submitted from different device`,
                timestamp: new Date().toISOString(),
                status: "flagged"
            });

            await client.asServiceRole.entities.AttendanceSubmissionLog.create({
                session_id,
                student_id: student.id,
                student_identifier,
                device_fingerprint: deviceFingerprint,
                ip_address: ipAddress,
                user_agent,
                latitude,
                longitude,
                gps_accuracy,
                submission_timestamp: new Date().toISOString(),
                qr_timestamp: timestamp,
                success: false,
                failure_reason: "duplicate_prn",
                is_suspicious: true
            });

            return Response.json({ 
                success: false, 
                error: `⛔ Your attendance was already marked from another device. If this is a mistake, contact your faculty immediately.`,
                already_submitted: true
            }, { status: 403 });
        }

        // Check if attendance already marked
        const existingAttendance = await client.asServiceRole.entities.AttendanceRecord.filter({
            student_id: student.id,
            session_id: sessionData.id
        });

        let message = "";
        let already_marked = false;

        if (existingAttendance.length > 0) {
            if (existingAttendance[0].is_present) {
                message = `Welcome back, ${student.name}! Your attendance was already marked as Present.`;
                already_marked = true;
            } else {
                await client.asServiceRole.entities.AttendanceRecord.update(existingAttendance[0].id, { 
                    is_present: true,
                    marked_at: new Date().toISOString()
                });
                message = `Great! ${student.name}, your attendance has been updated to Present.`;
            }
        } else {
            await client.asServiceRole.entities.AttendanceRecord.create({
                student_id: student.id,
                session_id: sessionData.id,
                batch_id: sessionData.batch_id,
                is_present: true,
                marked_at: new Date().toISOString(),
                marked_by: 'qr_scan'
            });
            message = `Perfect! ${student.name}, your attendance has been marked successfully.`;
        }

        // Log successful submission
        await client.asServiceRole.entities.AttendanceSubmissionLog.create({
            session_id,
            student_id: student.id,
            student_identifier,
            device_fingerprint: deviceFingerprint,
            ip_address: ipAddress,
            user_agent,
            latitude,
            longitude,
            gps_accuracy,
            submission_timestamp: new Date().toISOString(),
            qr_timestamp: timestamp,
            success: true,
            is_suspicious: false
        });

        // Update active student record with student details and mark as submitted
        const activeStudentRecords = await client.asServiceRole.entities.QRActiveStudent.filter({
            session_id,
            device_fingerprint: deviceFingerprint,
            status: 'active'
        });

        if (activeStudentRecords.length > 0) {
            await client.asServiceRole.entities.QRActiveStudent.update(activeStudentRecords[0].id, {
                student_id: student.id,
                prn: student.prn || student_identifier,
                student_name: student.name,
                email: student.email,
                latitude,
                longitude,
                gps_accuracy,
                is_inside_geofence: insideGeoFence,
                distance_from_geofence: distanceFromGeoFence,
                status: 'submitted',
                last_active_at: new Date().toISOString()
            });
        } else {
            // Create if not exists (fallback)
            await client.asServiceRole.entities.QRActiveStudent.create({
                session_id,
                student_id: student.id,
                prn: student.prn || student_identifier,
                student_name: student.name,
                email: student.email,
                device_fingerprint: deviceFingerprint,
                latitude,
                longitude,
                gps_accuracy,
                is_inside_geofence: insideGeoFence,
                distance_from_geofence: distanceFromGeoFence,
                portal_opened_at: new Date().toISOString(),
                last_active_at: new Date().toISOString(),
                status: 'submitted'
            });
        }

        return Response.json({ 
            success: true, 
            message,
            already_marked,
            student_name: student.name,
            student_prn: student.prn || student_identifier,
            location_verified: geoFenceZones.length > 0,
            location_name: geoFenceLocation,
            inside_geofence: insideGeoFence,
            session: {
                id: sessionData.id,
                name: sessionData.session_name,
                topic: sessionData.topic_taught,
                date: sessionData.session_date,
                time: sessionData.session_time,
                faculty: sessionData.faculty_name,
                faculty_email: sessionData.faculty_email,
                college: sessionData.college_name
            }
        });

    } catch (error) {
        console.error("Error in markQRAttendance:", error);
        return Response.json({ 
            success: false, 
            error: "Internal server error. Please try again or contact your faculty.",
            details: error.message 
        }, { status: 500 });
    }
});

export default handlerFor(import.meta.url);
