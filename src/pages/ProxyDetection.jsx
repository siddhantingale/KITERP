import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Shield, MapPin, Smartphone, Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

const years = ["FY", "SY", "TY", "BTech"];
const divisions = ["AIML-A", "AIML-B", "AIML-C"];

export default function ProxyDetectionPage() {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSession, setSelectedSession] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [filterDivision, setFilterDivision] = useState("all");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [logs, filterStatus, filterType, searchTerm, selectedSession, filterYear, filterDivision]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsData, sessionsData] = await Promise.all([
        api.entities.ProxyDetectionLog.list('-timestamp', 200),
        api.entities.Session.list('-created_date', 50)
      ]);
      setLogs(logsData);
      setSessions(sessionsData);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  };

  const applyFilters = () => {
    let filtered = [...logs];

    if (filterStatus !== "all") {
      filtered = filtered.filter(log => log.status === filterStatus);
    }

    if (filterType !== "all") {
      filtered = filtered.filter(log => log.violation_type === filterType);
    }

    if (selectedSession !== "all") {
      filtered = filtered.filter(log => log.session_id === selectedSession);
    }

    // Filter by year - match session's year
    if (filterYear !== "all") {
      const sessionsForYear = sessions.filter(s => s.year === filterYear).map(s => s.id);
      filtered = filtered.filter(log => sessionsForYear.includes(log.session_id));
    }

    // Filter by division - match session's division
    if (filterDivision !== "all") {
      const sessionsForDiv = sessions.filter(s => s.division === filterDivision).map(s => s.id);
      filtered = filtered.filter(log => sessionsForDiv.includes(log.session_id));
    }

    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.student_identifier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredLogs(filtered);
  };

  const updateLogStatus = async (logId, newStatus, notes) => {
    try {
      const user = await api.auth.me();
      await api.entities.ProxyDetectionLog.update(logId, {
        status: newStatus,
        reviewed_by: user.email,
        review_notes: notes || ''
      });
      loadData();
    } catch (error) {
      console.error("Error updating log:", error);
    }
  };

  const getViolationTypeLabel = (type) => {
    const labels = {
      outside_geofence: "Outside Geo-Fence",
      duplicate_device: "Duplicate Device",
      duplicate_prn: "Duplicate PRN",
      gps_spoofing_suspected: "GPS Spoofing",
      impossible_travel: "Impossible Travel",
      low_gps_accuracy: "Low GPS Accuracy",
      multiple_prns_same_device: "Multiple PRNs Same Device"
    };
    return labels[type] || type;
  };

  const getStatusColor = (status) => {
    const colors = {
      flagged: "bg-red-100 text-red-800",
      reviewed: "bg-yellow-100 text-yellow-800",
      cleared: "bg-green-100 text-green-800",
      confirmed: "bg-orange-100 text-orange-800"
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getRiskColor = (score) => {
    if (score >= 80) return "text-red-600 font-bold";
    if (score >= 50) return "text-orange-600 font-semibold";
    return "text-yellow-600";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading proxy detection logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 sm:gap-3 mb-2">
          <Shield className="w-6 sm:w-8 h-6 sm:h-8 text-red-600" />
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Proxy Detection & Security</h1>
        </div>
        <p className="text-gray-600 text-sm sm:text-base">Monitor suspicious attendance attempts</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Violations</p>
                <p className="text-2xl font-bold text-red-600">{logs.length}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Flagged</p>
                <p className="text-2xl font-bold text-orange-600">
                  {logs.filter(l => l.status === 'flagged').length}
                </p>
              </div>
              <Clock className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Confirmed</p>
                <p className="text-2xl font-bold text-red-600">
                  {logs.filter(l => l.status === 'confirmed').length}
                </p>
              </div>
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Cleared</p>
                <p className="text-2xl font-bold text-green-600">
                  {logs.filter(l => l.status === 'cleared').length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <Input
              placeholder="Search PRN, Roll No..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {years.map(y => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterDivision} onValueChange={setFilterDivision}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Division" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Divisions</SelectItem>
                {divisions.map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="flagged">Flagged</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="cleared">Cleared</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="outside_geofence">Outside Geo-Fence</SelectItem>
                <SelectItem value="duplicate_device">Duplicate Device</SelectItem>
                <SelectItem value="duplicate_prn">Duplicate PRN</SelectItem>
                <SelectItem value="multiple_prns_same_device">Multiple PRNs</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedSession} onValueChange={setSelectedSession}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Session" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sessions</SelectItem>
                {sessions.slice(0, 20).map(session => (
                  <SelectItem key={session.id} value={session.id}>
                    {session.session_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <div className="space-y-4">
        {filteredLogs.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No proxy detection logs found</p>
            </CardContent>
          </Card>
        ) : (
          filteredLogs.map((log) => (
            <Card key={log.id} className="border-l-4 border-l-red-500">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4 mb-4">
                  <div className="flex-1 w-full">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                      <Badge className={getStatusColor(log.status)}>
                        {log.status}
                      </Badge>
                      <Badge variant="outline">{getViolationTypeLabel(log.violation_type)}</Badge>
                      <span className={`text-lg font-bold ${getRiskColor(log.risk_score)}`}>
                        Risk: {log.risk_score}/100
                      </span>
                    </div>
                    <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">PRN/Roll No</p>
                        <p className="font-semibold">{log.student_identifier}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Time</p>
                        <p className="font-semibold">
                          {format(new Date(log.timestamp), 'PPp')}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">IP Address</p>
                        <p className="font-semibold">{log.ip_address || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">GPS Accuracy</p>
                        <p className="font-semibold">{log.gps_accuracy ? `±${Math.round(log.gps_accuracy)}m` : 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900 mb-1">Violation Details:</p>
                      <p className="text-gray-700">{log.details}</p>
                    </div>
                  </div>
                  {log.distance_from_geofence && (
                    <div className="flex items-center gap-2 mt-3 text-sm">
                      <MapPin className="w-4 h-4 text-gray-600" />
                      <span className="text-gray-700">
                        Distance from allowed zone: <strong>{Math.round(log.distance_from_geofence)}m</strong>
                      </span>
                    </div>
                  )}
                  {log.device_fingerprint && (
                    <div className="flex items-center gap-2 mt-2 text-sm">
                      <Smartphone className="w-4 h-4 text-gray-600" />
                      <span className="text-gray-700">
                        Device: <code className="bg-gray-200 px-2 py-0.5 rounded">{log.device_fingerprint}</code>
                      </span>
                    </div>
                  )}
                </div>

                {log.reviewed_by && (
                  <div className="bg-blue-50 rounded-lg p-3 mb-4 text-sm">
                    <p className="text-blue-900">
                      <strong>Reviewed by:</strong> {log.reviewed_by}
                    </p>
                    {log.review_notes && (
                      <p className="text-blue-800 mt-1"><strong>Notes:</strong> {log.review_notes}</p>
                    )}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  {log.status === 'flagged' && (
                    <>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => updateLogStatus(log.id, 'confirmed', 'Proxy attendance confirmed')}
                        className="w-full sm:w-auto"
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        <span className="hidden sm:inline">Confirm Violation</span>
                        <span className="sm:hidden">Confirm</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateLogStatus(log.id, 'cleared', 'False positive - legitimate attempt')}
                        className="w-full sm:w-auto"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        <span className="hidden sm:inline">Clear (False Positive)</span>
                        <span className="sm:hidden">Clear</span>
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const notes = prompt("Add review notes:");
                      if (notes) updateLogStatus(log.id, 'reviewed', notes);
                    }}
                    className="w-full sm:w-auto"
                  >
                    Add Notes
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}