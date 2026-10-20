import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, TrendingDown, TrendingUp, Download, BarChart3, Filter, CheckCircle2, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

export default function StudentAttendanceEnhanced({ student }) {
  const [attendance, setAttendance] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [subjectWise, setSubjectWise] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [expandedSubject, setExpandedSubject] = useState(null);

  useEffect(() => {
    fetchAttendanceData();
  }, [student]);

  const fetchAttendanceData = async () => {
    try {
      const attendanceRecords = await api.entities.AttendanceRecord.filter({
        student_id: student.id
      });

      const sessionIds = [...new Set(attendanceRecords.map(r => r.session_id))];
      const sessionsData = await Promise.all(
        sessionIds.map(id => api.entities.Session.get(id).catch(() => null))
      );

      const validSessions = sessionsData.filter(s => s !== null);

      // Calculate subject-wise attendance
      const subjectMap = {};
      validSessions.forEach(session => {
        const subject = session.topic_taught || session.session_name;
        const record = attendanceRecords.find(r => r.session_id === session.id);
        
        if (!subjectMap[subject]) {
          subjectMap[subject] = { present: 0, total: 0, percentage: 0, sessions: [] };
        }
        
        subjectMap[subject].total++;
        subjectMap[subject].sessions.push({
          ...session,
          is_present: record?.is_present || false
        });
        
        if (record && record.is_present) {
          subjectMap[subject].present++;
        }
      });

      Object.keys(subjectMap).forEach(subject => {
        const data = subjectMap[subject];
        data.percentage = Math.round((data.present / data.total) * 100);
        data.sessions.sort((a, b) => new Date(b.session_date) - new Date(a.session_date));
      });

      // Use static data if no records found
      if (attendanceRecords.length === 0) {
        const staticSubjects = {
          'Machine Learning': { 
            present: 9, total: 12, percentage: 75,
            sessions: [
              { id: '1', session_name: 'Neural Networks', session_date: '2026-01-20', session_time: '09:00 AM', is_present: true },
              { id: '2', session_name: 'Deep Learning Intro', session_date: '2026-01-18', session_time: '09:00 AM', is_present: true },
              { id: '3', session_name: 'CNN Basics', session_date: '2026-01-15', session_time: '09:00 AM', is_present: false }
            ]
          },
          'Data Structures': { 
            present: 13, total: 15, percentage: 87,
            sessions: [
              { id: '4', session_name: 'Binary Trees', session_date: '2026-01-19', session_time: '10:00 AM', is_present: true },
              { id: '5', session_name: 'Graphs', session_date: '2026-01-17', session_time: '10:00 AM', is_present: true }
            ]
          },
          'Database Management': { 
            present: 10, total: 13, percentage: 77,
            sessions: [
              { id: '6', session_name: 'SQL Queries', session_date: '2026-01-18', session_time: '11:00 AM', is_present: false },
              { id: '7', session_name: 'Normalization', session_date: '2026-01-16', session_time: '11:00 AM', is_present: true }
            ]
          }
        };

        setSubjectWise(staticSubjects);
      } else {
        setSubjectWise(subjectMap);
      }

      setAttendance(attendanceRecords);
      setSessions(validSessions);
    } catch (error) {
      console.error("Error fetching attendance:", error);
    }
    setLoading(false);
  };

  const getAttendanceColor = (percentage) => {
    if (percentage >= 75) return 'text-green-600 bg-green-50 border-green-200';
    if (percentage >= 65) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const overallPercentage = attendance.length > 0
    ? Math.round((attendance.filter(r => r.is_present).length / attendance.length) * 100)
    : Object.keys(subjectWise).length > 0
    ? Math.round(Object.values(subjectWise).reduce((sum, s) => sum + s.percentage, 0) / Object.keys(subjectWise).length)
    : 0;

  const handleDownload = () => {
    let csvContent = "Subject,Present,Total,Percentage\n";
    Object.entries(subjectWise).forEach(([subject, data]) => {
      csvContent += `${subject},${data.present},${data.total},${data.percentage}%\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Attendance_${student.name}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const filteredSubjects = filterSubject === 'all' 
    ? Object.entries(subjectWise)
    : Object.entries(subjectWise).filter(([subject]) => subject === filterSubject);

  if (loading) {
    return <div className="space-y-6"><div className="h-64 bg-gray-200 rounded animate-pulse"></div></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📊 Attendance</h1>
          <p className="text-gray-600 mt-1">Track your class attendance</p>
        </div>
        <Button onClick={handleDownload} className="bg-blue-600 hover:bg-blue-700">
          <Download className="w-4 h-4 mr-2" />
          Download Report
        </Button>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-3 rounded-xl ${overallPercentage >= 75 ? 'bg-gradient-to-br from-green-500 to-emerald-600' : overallPercentage >= 65 ? 'bg-gradient-to-br from-yellow-500 to-orange-600' : 'bg-gradient-to-br from-red-500 to-pink-600'}`}>
                <Calendar className="w-6 h-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-gray-600">Overall Attendance</p>
            <h3 className="text-4xl font-bold text-gray-900">{overallPercentage}%</h3>
            <p className="text-sm text-gray-500 mt-1">
              {attendance.filter(r => r.is_present).length} / {attendance.length} classes
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-gray-600">Classes Attended</p>
            <h3 className="text-4xl font-bold text-gray-900">
              {attendance.filter(r => r.is_present).length}
            </h3>
            <p className="text-sm text-gray-500 mt-1">Total classes</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-red-600">
                <TrendingDown className="w-6 h-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-gray-600">Classes Missed</p>
            <h3 className="text-4xl font-bold text-gray-900">
              {attendance.filter(r => !r.is_present).length}
            </h3>
            <p className="text-sm text-gray-500 mt-1">Absent count</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">Filters:</span>
            </div>
            <Select value={filterSubject} onValueChange={setFilterSubject}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {Object.keys(subjectWise).map(subject => (
                  <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Subject-wise Attendance with Day-wise Records */}
      <div className="space-y-4">
        {filteredSubjects.length > 0 ? (
          filteredSubjects.map(([subject, data]) => {
            const isExpanded = expandedSubject === subject;
            
            return (
              <Card key={subject} className="border-0 shadow-lg">
                <CardHeader 
                  className="bg-gradient-to-r from-blue-50 to-indigo-50 cursor-pointer hover:from-blue-100 hover:to-indigo-100 transition-colors"
                  onClick={() => setExpandedSubject(isExpanded ? null : subject)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg">
                        <BarChart3 className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{subject}</CardTitle>
                        <p className="text-sm text-gray-600">
                          {data.present} present / {data.total} total classes
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-4 py-1.5 rounded-full font-bold text-sm border ${getAttendanceColor(data.percentage)}`}>
                        {data.percentage}%
                      </span>
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 mt-3">
                    <div 
                      className={`h-3 rounded-full transition-all ${
                        data.percentage >= 75 ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 
                        data.percentage >= 65 ? 'bg-gradient-to-r from-yellow-500 to-orange-600' : 
                        'bg-gradient-to-r from-red-500 to-pink-600'
                      }`}
                      style={{ width: `${data.percentage}%` }}
                    ></div>
                  </div>
                </CardHeader>

                {isExpanded && data.sessions && (
                  <CardContent className="p-6 bg-gray-50">
                    <h4 className="font-bold text-gray-900 mb-4">Day-wise Attendance Record</h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {data.sessions.map((session, idx) => (
                        <div 
                          key={session.id || idx} 
                          className={`flex items-center justify-between p-4 rounded-xl border-l-4 ${
                            session.is_present 
                              ? 'border-green-500 bg-green-50' 
                              : 'border-red-500 bg-red-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {session.is_present ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-600" />
                            )}
                            <div>
                              <p className="font-semibold text-gray-900">{session.session_name}</p>
                              <p className="text-sm text-gray-600">{session.topic_taught}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {format(new Date(session.session_date), 'EEEE, PP')} • {session.session_time}
                              </p>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-full font-semibold text-sm ${
                            session.is_present 
                              ? 'bg-green-200 text-green-800' 
                              : 'bg-red-200 text-red-800'
                          }`}>
                            {session.is_present ? 'Present' : 'Absent'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })
        ) : (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-12 text-center">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No attendance records yet</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}