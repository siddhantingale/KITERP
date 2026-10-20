import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, AlertCircle, QrCode, Clock, Shield } from "lucide-react";
import { format } from "date-fns";

export default function QRAttendanceStudent() {
  const location = useLocation();
  const [sessionInfo, setSessionInfo] = useState(null);
  const [isPrivateBatch, setIsPrivateBatch] = useState(false);
  const [studentIdentifier, setStudentIdentifier] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");
  const [timeRemaining, setTimeRemaining] = useState(120);
  const [successData, setSuccessData] = useState(null);
  const [gpsLocation, setGpsLocation] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [deviceFingerprint, setDeviceFingerprint] = useState("");
  const [heartbeatActive, setHeartbeatActive] = useState(false);

  // Get parameters from URL
  const urlParams = new URLSearchParams(location.search);
  const session_id = urlParams.get('session_id');
  const timestamp = urlParams.get('timestamp');
  const batch_type = urlParams.get('batch_type');

  // CRITICAL SECURITY: Disable developer tools and prevent page navigation
  useEffect(() => {
    // Disable right-click
    const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
    };
    document.addEventListener('contextmenu', handleContextMenu);

    // Disable F12, Ctrl+Shift+I, Ctrl+U, etc.
    const handleKeyDown = (e) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (e.ctrlKey && e.shiftKey && e.key === 'J') ||
        (e.ctrlKey && e.key === 'U') ||
        (e.ctrlKey && e.shiftKey && e.key === 'C')
      ) {
        e.preventDefault();
        return false;
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    // Prevent navigation
    const handleBeforeUnload = (e) => {
      if (status !== "success") {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Block back button
    window.history.pushState(null, null, window.location.pathname);
    window.addEventListener('popstate', () => {
      window.history.pushState(null, null, window.location.pathname);
    });

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [status]);

  useEffect(() => {
    const validateQRCode = () => {
      try {
        // SECURITY CHECK 1: Validate required parameters
        if (!session_id || !timestamp) {
          setStatus("error");
          setMessage("⛔ Invalid QR code - missing authentication parameters");
          return;
        }

        // SECURITY CHECK 2: Validate timestamp format
        const qrTimestamp = parseInt(timestamp);
        if (isNaN(qrTimestamp) || qrTimestamp <= 0) {
          setStatus("error");
          setMessage("⛔ Invalid QR code - corrupted timestamp");
          return;
        }

        // SECURITY CHECK 3: Check timestamp is not in future (clock tampering)
        const now = Date.now();
        if (qrTimestamp > now + 5000) { // 5 second tolerance
          setStatus("error");
          setMessage("⛔ Invalid QR code - timestamp is in the future. Please check your device clock.");
          return;
        }

        // SECURITY CHECK 4: STRICT 120-second expiry
        const qrAge = (now - qrTimestamp) / 1000;
        if (qrAge > 120) {
          setStatus("expired");
          setMessage(`⏰ QR code expired ${Math.floor(qrAge)} seconds ago. This QR code was only valid for 120 seconds. Please ask your faculty to generate a new one.`);
          return;
        }

        // Set countdown
        setTimeRemaining(Math.max(0, 120 - Math.floor(qrAge)));
        setIsPrivateBatch(batch_type === 'private');
        setStatus("ready");
        
        // Generate device fingerprint
        const fingerprint = btoa(navigator.userAgent).substring(0, 32);
        setDeviceFingerprint(fingerprint);
        
        // Set basic session info (we'll get full details after submission)
        setSessionInfo({
          id: session_id,
          timestamp: qrTimestamp
        });

      } catch (error) {
        console.error("Error validating QR code:", error);
        setStatus("error");
        setMessage("❌ Error validating QR code. Please try scanning again.");
      }
    };
    
    validateQRCode();
  }, [session_id, timestamp, batch_type]);

  // Get user's location with HIGH ACCURACY and log portal access
  useEffect(() => {
    if (status === "ready") {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const locationData = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy
            };
            
            // CRITICAL: Reject if accuracy is poor (> 20 meters)
            if (position.coords.accuracy > 20) {
              setLocationError(`⚠️ GPS accuracy too low (±${Math.round(position.coords.accuracy)}m). Please move to an area with better GPS signal.`);
              setStatus("error");
              setMessage(`📍 GPS accuracy insufficient (±${Math.round(position.coords.accuracy)}m). Minimum required: ±20m. Please:\n1. Move outdoors or near a window\n2. Enable high-accuracy mode in device settings\n3. Refresh and try again`);
              return;
            }
            
            setGpsLocation(locationData);
            setLocationError("");
          },
          (error) => {
            console.error("Location error:", error);
            setLocationError("⚠️ Location access denied. Enable GPS to mark attendance.");
            setStatus("error");
            setMessage("📍 Location access is required to mark attendance. Please enable GPS in your browser settings and refresh the page.");
          },
          { 
            enableHighAccuracy: true, // CRITICAL: Force high accuracy
            timeout: 15000, 
            maximumAge: 0 
          }
        );
      } else {
        setLocationError("⚠️ GPS not supported on this device");
        setStatus("error");
        setMessage("📍 Your device does not support GPS. Please use a different device.");
      }
    }
  }, [status, session_id]);

  // Countdown timer with STRICT expiry enforcement
  useEffect(() => {
    if (status === "expired" || status === "success" || status === "error" || !timestamp) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const qrTimestamp = parseInt(timestamp);
      const qrAge = (now - qrTimestamp) / 1000;
      const remaining = Math.max(0, 120 - Math.floor(qrAge));
      
      setTimeRemaining(remaining);
      
      if (remaining <= 0) {
        setStatus("expired");
        setMessage("⏰ QR code has expired. You can no longer mark attendance with this QR code. Please ask your faculty to generate a new one.");
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [timestamp, status]);

  // GPS Heartbeat - Send HIGH-ACCURACY location every 5 seconds after PRN submission
  useEffect(() => {
    if (!heartbeatActive || !session_id || !deviceFingerprint) return;

    const sendHeartbeat = async () => {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              await api.functions.invoke('updateStudentHeartbeat', {
                session_id,
                device_fingerprint: deviceFingerprint,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                gps_accuracy: position.coords.accuracy
              });
            } catch (error) {
              console.error("Heartbeat error:", error);
            }
          },
          (error) => {
            console.error("Location error during heartbeat:", error);
          },
          { 
            enableHighAccuracy: true, // CRITICAL: High accuracy mode
            timeout: 5000, 
            maximumAge: 0 
          }
        );
      }
    };

    // Send heartbeat every 5 seconds
    const interval = setInterval(sendHeartbeat, 5000);
    
    // Send first heartbeat immediately
    sendHeartbeat();

    return () => clearInterval(interval);
  }, [heartbeatActive, session_id, deviceFingerprint]);

  const handleSubmitAttendance = async () => {
    // FINAL SECURITY CHECK: Verify QR is still valid before submission
    if (timeRemaining <= 0) {
      setStatus("expired");
      setMessage("⏰ QR code expired. Cannot mark attendance.");
      return;
    }

    if (!studentIdentifier.trim()) {
      setMessage(isPrivateBatch ? "⚠️ Please enter your roll number" : "⚠️ Please enter your PRN or roll number");
      return;
    }

    if (!gpsLocation) {
      setMessage("📍 Waiting for GPS location. Please ensure location is enabled.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      // First, log to active students table
      try {
        const logResponse = await api.functions.invoke('logQRPortalAccess', {
          session_id,
          student_identifier: studentIdentifier.trim(),
          batch_type,
          latitude: gpsLocation.latitude,
          longitude: gpsLocation.longitude,
          gps_accuracy: gpsLocation.accuracy,
          device_fingerprint: deviceFingerprint
        });

        // Start heartbeat tracking after successful PRN submission
        if (logResponse.data.success) {
          setHeartbeatActive(true);
        }
      } catch (logError) {
        console.error("Error logging to active students:", logError);
      }

      // Call backend function to mark attendance with location data and PRN
      const response = await api.functions.invoke('markQRAttendance', {
        session_id,
        timestamp,
        student_identifier: studentIdentifier.trim(),
        batch_type,
        latitude: gpsLocation.latitude,
        longitude: gpsLocation.longitude,
        gps_accuracy: gpsLocation.accuracy,
        user_agent: navigator.userAgent
      });

      if (response.data && response.data.success) {
        setStatus("success");
        setMessage(response.data.message);
        setSuccessData(response.data);
        setHeartbeatActive(false); // Stop heartbeat on success
      } else {
        if (response.data && response.data.expired) {
          setStatus("expired");
        } else {
          setStatus("error");
        }
        setMessage(response.data?.error || "Error marking attendance");
      }

    } catch (error) {
      console.error("Error marking attendance:", error);
      setStatus("error");
      
      // Better error messaging
      let errorMsg = "Error marking attendance. Please try again or contact your faculty.";
      if (error.response?.data?.error) {
        errorMsg = error.response.data.error;
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      setMessage(errorMsg);
    }

    setIsSubmitting(false);
  };

  // Expired QR
  if (status === "expired") {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-200 shadow-lg">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4 animate-pulse" />
            <h2 className="text-2xl font-bold text-red-600 mb-3">⏰ QR Code Expired</h2>
            <p className="text-red-700 mb-4 text-lg">{message}</p>
            <div className="p-4 bg-red-100 rounded-lg text-sm text-red-800">
              <Shield className="w-5 h-5 mx-auto mb-2" />
              <p className="font-semibold">🔒 Security Notice</p>
              <p className="mt-1">QR codes expire after 120 seconds for your security. This prevents unauthorized attendance marking.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (status === "error") {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-200 shadow-lg">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-600 mb-3">❌ Error</h2>
            <p className="text-red-700 text-lg">{message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (status === "success" && successData) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-green-200 shadow-lg">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4 animate-bounce" />
            <h2 className="text-2xl font-bold text-green-600 mb-3">✅ Attendance Marked!</h2>
            <p className="text-green-700 mb-6 text-lg">{message}</p>
            <div className="p-4 bg-green-100 rounded-lg text-left">
              <p className="text-sm text-green-800">
                <strong>👤 Student:</strong> {successData.student_name}<br/>
                <strong>📚 Session:</strong> {successData.session.name}<br/>
                <strong>📖 Topic:</strong> {successData.session.topic}<br/>
                <strong>📅 Date:</strong> {format(new Date(successData.session.date), 'PPP')}<br/>
                <strong>🕐 Time:</strong> {successData.session.time}<br/>
                <strong>👨‍🏫 Faculty:</strong> {successData.session.faculty}<br/>
                <strong>🏛️ College:</strong> {successData.session.college}
                {successData.location_verified && (
                  <>
                    <br/><strong>📍 Location:</strong> {successData.location_name || 'Verified'} ✅
                  </>
                )}
              </p>
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
              <Shield className="w-4 h-4 mx-auto mb-1" />
              ✅ You can now close this page. Your attendance has been securely recorded.
              {heartbeatActive && (
                <p className="mt-2 text-xs">📍 Your location is being tracked in real-time for security.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading or ready state
  if (status === "" || status === "ready") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-2 border-blue-200">
          <CardHeader className="text-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
            <QrCode className="w-12 h-12 mx-auto mb-3" />
            <CardTitle className="text-2xl">📋 Mark Your Attendance</CardTitle>
            <p className="text-blue-100 font-semibold mt-2">QR Code Attendance System</p>
            
            {/* CRITICAL: Real-time countdown timer */}
            {status === "ready" && (
              <div className="mt-4 p-3 bg-orange-500 rounded-lg animate-pulse">
                <div className="flex items-center justify-center gap-2 text-white">
                  <Clock className="w-5 h-5 animate-spin" />
                  <span className="font-bold text-lg">⏰ Time remaining: {timeRemaining}s</span>
                </div>
                <p className="text-xs text-orange-100 mt-1">QR code will expire when timer reaches 0</p>
              </div>
            )}
          </CardHeader>
          
          <CardContent className="space-y-4 p-6">
            <div>
              <Label htmlFor="identifier" className="text-sm font-semibold text-gray-700">
                {isPrivateBatch ? "🆔 Enter Your Roll Number" : "🆔 Enter Your PRN or Roll Number"}
              </Label>
              <Input
                id="identifier"
                type="text"
                value={studentIdentifier}
                onChange={(e) => setStudentIdentifier(e.target.value)}
                placeholder={isPrivateBatch ? "e.g., 101, A01, jdbc 01" : "e.g., 2425000625 or 101"}
                className="mt-2 text-lg"
                disabled={isSubmitting || timeRemaining <= 0 || status !== "ready"}
                autoFocus
                autoComplete="off"
              />
              <p className="text-xs text-gray-500 mt-2">
                {isPrivateBatch 
                  ? "📝 Enter the roll number assigned to you for this batch"
                  : "📝 You can enter either your PRN or your roll number"
                }
              </p>
            </div>

            {locationError && (
              <div className="p-3 rounded-lg bg-yellow-50 text-yellow-700 border border-yellow-200">
                {locationError}
              </div>
            )}

            {gpsLocation && (
              <div className="p-3 rounded-lg bg-green-50 text-green-700 border border-green-200 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">📍 Location verified (±{Math.round(gpsLocation.accuracy)}m accuracy)</span>
              </div>
            )}

            {message && (
              <div className={`p-3 rounded-lg ${
                status === "error" ? "bg-red-50 text-red-700 border border-red-200" : "bg-blue-50 text-blue-700 border border-blue-200"
              }`}>
                {message}
              </div>
            )}

            <Button 
              onClick={handleSubmitAttendance} 
              disabled={isSubmitting || !studentIdentifier.trim() || timeRemaining <= 0 || status !== "ready" || !gpsLocation}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-lg py-6"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                  Marking Attendance...
                </div>
              ) : timeRemaining <= 0 ? (
                "⏰ QR Code Expired"
              ) : (
                "✅ Mark Present"
              )}
            </Button>

            {/* Security notice */}
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-center gap-2 text-yellow-700 text-xs">
                <Shield className="w-4 h-4" />
                <span>🔒 No login required - Just scan, enter your ID, and mark attendance!</span>
              </div>
              {heartbeatActive && (
                <p className="mt-2 text-xs text-green-700">
                  📍 GPS tracking active - Your location is being verified in real-time
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}