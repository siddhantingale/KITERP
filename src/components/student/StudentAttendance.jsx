import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, TrendingDown, TrendingUp, Download, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, startOfMonth, endOfMonth } from "date-fns";

export default function StudentAttendance({ student }) {
  const [attendance, setAttendance] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [subjectWise, setSubjectWise] = useState({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('all'); // 'all' or 'monthly'

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
          subjectMap[subject] = { present: 0, total: 0, percentage: 0 };
        }
        
        subjectMap[subject].total++;
        if (record && record.is_present) {
          subjectMap[subject].present++;
        }
      });

      Object.keys(subjectMap).forEach(subject => {
        const data = subjectMap[subject];
        data.percentage = Math.round((data.present / data.total) * 100);
      });

      // Use static data if no records found
      if (attendanceRecords.length === 0) {
        const staticSubjects = {
          'Machine Learning': { present: 9, total: 12, percentage: 75 },
          'Data Structures': { present: 13, total: 15, percentage: 87 },
          'Database Management': { present: 10, total: 13, percentage: 77 },
          'Computer Networks': { present: 8, total: 10, percentage: 80 },
          'Operating Systems': { present: 11, total: 14, percentage: 79 }
        };
        
        const staticSessions = [
          { id: '1', session_name: 'ML - Neural Networks', topic_taught: 'Machine Learning', session_date: '2026-01-20', session_time: '09:00 AM' },
          { id: '2', session_name: 'DS - Binary Trees', topic_taught: 'Data Structures', session_date: '2026-01-19', session_time: '10:00 AM' },
          { id: '3', session_name: 'DBMS - SQL Queries', topic_taught: 'Database Management', session_date: '2026-01-18', session_time: '11:00 AM' }
        ];

        const staticAttendance = [
          { id: '1', student_id: student.id, session_id: '1', is_present: true },
          { id: '2', student_id: student.id, session_id: '2', is_present: true },
          { id: '3', student_id: student.id, session_id: '3', is_present: false }
        ];

        setAttendance(staticAttendance);
        setSessions(staticSessions);
        setSubjectWise(staticSubjects);
      } else {
        setAttendance(attendanceRecords);
        setSessions(validSessions);
        setSubjectWise(subjectMap);
      }
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
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

      {/* Subject-wise Attendance */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Subject-wise Attendance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {Object.entries(subjectWise).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(subjectWise).map(([subject, data]) => (
                <div key={subject} className="p-4 bg-white border rounded-xl hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">{subject}</h4>
                    <span className={`px-3 py-1 rounded-full font-semibold text-sm border ${getAttendanceColor(data.percentage)}`}>
                      {data.percentage}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                    <div 
                      className={`h-3 rounded-full ${data.percentage >= 75 ? 'bg-gradient-to-r from-green-500 to-emerald-600' : data.percentage >= 65 ? 'bg-gradient-to-r from-yellow-500 to-orange-600' : 'bg-gradient-to-r from-red-500 to-pink-600'}`}
                      style={{ width: `${data.percentage}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600">
                    {data.present} present / {data.total} total classes
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No attendance records yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Sessions */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-pink-50">
          <CardTitle>Recent Sessions</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {sessions.length > 0 ? (
            <div className="space-y-3">
              {sessions.slice(0, 10).map((session) => {
                const record = attendance.find(r => r.session_id === session.id);
                const isPresent = record?.is_present;
                
                return (
                  <div key={session.id} className={`p-4 rounded-xl border-l-4 ${isPresent ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{session.session_name}</h4>
                        <p className="text-sm text-gray-600">{session.topic_taught}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {format(new Date(session.session_date), 'PPP')} • {session.session_time}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full font-semibold text-sm ${isPresent ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                        {isPresent ? 'Present' : 'Absent'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600">No sessions found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}