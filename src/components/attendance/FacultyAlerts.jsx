import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertTriangle, CheckCircle, MapPin, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function FacultyAlerts({ sessionId }) {
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showAlerts, setShowAlerts] = useState(true);

  useEffect(() => {
    if (!sessionId) return;

    // Subscribe to proxy detection logs
    const unsubscribeProxy = api.entities.ProxyDetectionLog.subscribe((event) => {
      if (event.type === 'create') {
        const log = event.data;
        
        if (log.session_id === sessionId && log.violation_type === "outside_geofence") {
          const newAlert = {
            id: log.id,
            type: "outside_geofence",
            timestamp: new Date().toISOString(),
            student: log.student_identifier,
            distance: Math.round(log.distance_from_geofence),
            details: log.details,
            read: false
          };
          
          setAlerts(prev => [newAlert, ...prev].slice(0, 20)); // Keep last 20
          setUnreadCount(prev => prev + 1);
          
          // Show browser notification
          if (Notification.permission === "granted") {
            new Notification("⚠️ Student Outside Geo-Fence", {
              body: `${log.student_identifier} is ${Math.round(log.distance_from_geofence)}m away`,
              icon: "/favicon.ico"
            });
          }
        }
      }
    });

    // Subscribe to successful attendance submissions
    const unsubscribeSubmissions = api.entities.AttendanceSubmissionLog.subscribe((event) => {
      if (event.type === 'create') {
        const log = event.data;
        
        if (log.session_id === sessionId && log.success === true) {
          const newAlert = {
            id: log.id,
            type: "attendance_marked",
            timestamp: new Date().toISOString(),
            student: log.student_identifier,
            read: false
          };
          
          setAlerts(prev => [newAlert, ...prev].slice(0, 20));
          setUnreadCount(prev => prev + 1);
          
          // Show browser notification
          if (Notification.permission === "granted") {
            new Notification("✅ Attendance Marked", {
              body: `${log.student_identifier} marked present`,
              icon: "/favicon.ico"
            });
          }
        }
      }
    });

    // Request notification permission
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => {
      unsubscribeProxy();
      unsubscribeSubmissions();
    };
  }, [sessionId]);

  const dismissAlert = (alertId) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setUnreadCount(0);
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
  };

  if (!showAlerts) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setShowAlerts(true)}
          className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 relative"
        >
          <Bell className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-[600px] overflow-hidden">
      <Card className="shadow-2xl border-2 border-blue-200">
        <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-600" />
              Live Alerts
              {unreadCount > 0 && (
                <Badge className="bg-red-500">{unreadCount} new</Badge>
              )}
            </CardTitle>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Mark all read
                </button>
              )}
              <button onClick={() => setShowAlerts(false)}>
                <X className="w-5 h-5 text-gray-500 hover:text-gray-700" />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 max-h-[500px] overflow-y-auto">
          <AnimatePresence>
            {alerts.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No alerts yet</p>
              </div>
            ) : (
              alerts.map((alert) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 100 }}
                  className={`border-b p-3 ${!alert.read ? 'bg-blue-50' : 'bg-white'} hover:bg-gray-50 transition-colors`}
                >
                  {alert.type === "outside_geofence" ? (
                    <Alert className="bg-orange-50 border-orange-200">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      <AlertDescription>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-orange-900">
                              Student Outside Zone
                            </p>
                            <p className="text-sm text-orange-700 mt-1">
                              <strong>{alert.student}</strong> is {alert.distance}m away
                            </p>
                            <p className="text-xs text-orange-600 mt-1">
                              {new Date(alert.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                          <button
                            onClick={() => dismissAlert(alert.id)}
                            className="text-orange-400 hover:text-orange-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-green-900">
                              Attendance Marked
                            </p>
                            <p className="text-sm text-green-700 mt-1">
                              <strong>{alert.student}</strong> marked present
                            </p>
                            <p className="text-xs text-green-600 mt-1">
                              {new Date(alert.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                          <button
                            onClick={() => dismissAlert(alert.id)}
                            className="text-green-400 hover:text-green-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}