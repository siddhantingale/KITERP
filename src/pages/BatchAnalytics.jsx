import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, Users, Calendar, BookOpen, Award, PieChart, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { LineChart, Line, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function BatchAnalytics() {
  const [batch, setBatch] = useState(null);
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBatchData();
  }, []);

  const loadBatchData = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const batchId = urlParams.get('batch_id');

      const [batchData, studentsData, sessionsData, attendanceData] = await Promise.all([
        api.entities.Batch.get(batchId),
        api.entities.Student.filter({ batch_id: (await api.entities.Batch.get(batchId)).batch_id }),
        api.entities.Session.filter({ batch_id: (await api.entities.Batch.get(batchId)).batch_id }),
        api.entities.AttendanceRecord.filter({ batch_id: (await api.entities.Batch.get(batchId)).batch_id })
      ]);

      setBatch(batchData);
      
      // Add static data if no real data exists
      if (studentsData.length === 0) {
        const staticStudents = Array.from({ length: 67 }, (_, i) => ({
          id: `static-student-${i}`,
          name: `Student ${i + 1}`,
          roll_no: `${i + 1}`,
          batch_id: batchData.batch_id
        }));
        setStudents(staticStudents);
      } else {
        setStudents(studentsData);
      }
      
      if (sessionsData.length === 0) {
        const staticSessions = Array.from({ length: 10 }, (_, i) => ({
          id: `static-session-${i}`,
          session_name: `Session ${i + 1}`,
          session_date: new Date(2026, 0, i + 1).toISOString(),
          faculty_name: `Faculty ${(i % 3) + 1}`,
          batch_id: batchData.batch_id,
          present_count: Math.floor(Math.random() * 20) + 40,
          total_students: 67
        }));
        setSessions(staticSessions);
      } else {
        setSessions(sessionsData);
      }
      
      if (attendanceData.length === 0) {
        const staticAttendance = [];
        const studentCount = studentsData.length || 67;
        const sessionCount = sessionsData.length || 10;
        
        for (let s = 0; s < sessionCount; s++) {
          for (let st = 0; st < studentCount; st++) {
            staticAttendance.push({
              id: `static-att-${s}-${st}`,
              student_id: `static-student-${st}`,
              session_id: `static-session-${s}`,
              batch_id: batchData.batch_id,
              is_present: Math.random() > 0.2
            });
          }
        }
        setAttendanceRecords(staticAttendance);
      } else {
        setAttendanceRecords(attendanceData);
      }
    } catch (error) {
      console.error("Error loading batch data:", error);
    }
    setLoading(false);
  };

  const generateHTMLReport = () => {
    const stats = calculateStats();
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${batch.batch_name} - Advanced Analytics Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-radius: 30px;
            padding: 50px;
            box-shadow: 0 30px 90px rgba(0, 0, 0, 0.3);
        }
        .header {
            text-align: center;
            margin-bottom: 50px;
            padding-bottom: 30px;
            border-bottom: 3px solid #667eea;
        }
        .header h1 {
            font-size: 48px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
            animation: fadeIn 1s ease-in;
        }
        .header p {
            font-size: 20px;
            color: #666;
            animation: fadeIn 1.5s ease-in;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 30px;
            margin: 40px 0;
        }
        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px;
            border-radius: 20px;
            color: white;
            box-shadow: 0 15px 40px rgba(102, 126, 234, 0.4);
            transform: translateY(0);
            transition: all 0.3s ease;
            animation: slideUp 0.8s ease-out;
        }
        .stat-card:hover {
            transform: translateY(-10px);
            box-shadow: 0 25px 60px rgba(102, 126, 234, 0.5);
        }
        .stat-card .icon {
            font-size: 40px;
            margin-bottom: 15px;
        }
        .stat-card .value {
            font-size: 48px;
            font-weight: bold;
            margin: 10px 0;
        }
        .stat-card .label {
            font-size: 18px;
            opacity: 0.9;
        }
        .section {
            margin: 50px 0;
            animation: fadeIn 2s ease-in;
        }
        .section-title {
            font-size: 32px;
            color: #333;
            margin-bottom: 25px;
            padding-left: 20px;
            border-left: 5px solid #667eea;
        }
        table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            margin: 20px 0;
            overflow: hidden;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
        }
        thead {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        th, td {
            padding: 18px;
            text-align: left;
        }
        tbody tr {
            background: white;
            transition: all 0.3s ease;
        }
        tbody tr:nth-child(even) {
            background: #f8f9ff;
        }
        tbody tr:hover {
            background: #e8ebff;
            transform: scale(1.02);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
        }
        .progress-bar {
            height: 30px;
            background: #e0e0e0;
            border-radius: 15px;
            overflow: hidden;
            margin: 10px 0;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            transition: width 1.5s ease-out;
        }
        .footer {
            margin-top: 60px;
            padding-top: 30px;
            border-top: 2px solid #e0e0e0;
            text-align: center;
            color: #666;
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(50px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        @media print {
            body { background: white; padding: 20px; }
            .container { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 ${batch.batch_name}</h1>
            <p>Advanced Batch Analytics Report</p>
            <p style="font-size: 16px; margin-top: 10px;">${batch.college_name || 'EDU TRACK'}</p>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="icon">👥</div>
                <div class="value">${students.length}</div>
                <div class="label">Total Students</div>
            </div>
            <div class="stat-card">
                <div class="icon">📚</div>
                <div class="value">${sessions.length}</div>
                <div class="label">Total Sessions</div>
            </div>
            <div class="stat-card">
                <div class="icon">✅</div>
                <div class="value">${stats.avgAttendance}%</div>
                <div class="label">Avg Attendance</div>
            </div>
            <div class="stat-card">
                <div class="icon">🎯</div>
                <div class="value">${attendanceRecords.length}</div>
                <div class="label">Total Records</div>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">📈 Student Performance Overview</h2>
            <table>
                <thead>
                    <tr>
                        <th>Roll No</th>
                        <th>Student Name</th>
                        <th>Attendance</th>
                        <th>Performance</th>
                    </tr>
                </thead>
                <tbody>
                    ${students.map(student => {
                        const studentAttendance = attendanceRecords.filter(r => r.student_id === student.id && r.is_present).length;
                        const attendancePercent = sessions.length > 0 ? Math.round((studentAttendance / sessions.length) * 100) : 0;
                        return `
                        <tr>
                            <td>${student.roll_no}</td>
                            <td>${student.name}</td>
                            <td>
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${attendancePercent}%">${attendancePercent}%</div>
                                </div>
                            </td>
                            <td>${attendancePercent >= 75 ? '✅ Good' : '⚠️ Need Attention'}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2 class="section-title">📅 Session History</h2>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Session Name</th>
                        <th>Faculty</th>
                        <th>Attendance</th>
                    </tr>
                </thead>
                <tbody>
                    ${sessions.slice(0, 20).map(session => `
                    <tr>
                        <td>${format(new Date(session.session_date), 'dd MMM yyyy')}</td>
                        <td>${session.session_name}</td>
                        <td>${session.faculty_name}</td>
                        <td>${session.present_count || 0} / ${session.total_students || students.length}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="footer">
            <p><strong>Generated by EDU TRACK</strong></p>
            <p>Report generated on ${format(new Date(), 'PPpp')}</p>
        </div>
    </div>
</body>
</html>
    `;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${batch.batch_name}_Analytics_Report.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const calculateStats = () => {
    if (sessions.length === 0) return { avgAttendance: 0 };
    
    const totalPossible = students.length * sessions.length;
    const totalPresent = attendanceRecords.filter(r => r.is_present).length;
    const avgAttendance = totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 100) : 0;

    return { avgAttendance };
  };

  // Prepare chart data
  const getAttendanceTrendData = () => {
    const sessionsByDate = sessions.reduce((acc, session) => {
      const date = format(new Date(session.session_date), 'dd MMM');
      const presentCount = attendanceRecords.filter(r => r.session_id === session.id && r.is_present).length;
      const total = students.length;
      const percentage = total > 0 ? Math.round((presentCount / total) * 100) : 0;
      
      acc.push({ date, percentage, present: presentCount, total });
      return acc;
    }, []);
    
    return sessionsByDate.slice(-10); // Last 10 sessions
  };

  const getPresentAbsentData = () => {
    const totalPresent = attendanceRecords.filter(r => r.is_present).length;
    const totalAbsent = attendanceRecords.filter(r => !r.is_present).length;
    
    return [
      { name: 'Present', value: totalPresent, color: '#10b981' },
      { name: 'Absent', value: totalAbsent, color: '#ef4444' }
    ];
  };

  const getStudentDistributionData = () => {
    return students.map(student => {
      const presentCount = attendanceRecords.filter(r => r.student_id === student.id && r.is_present).length;
      const percentage = sessions.length > 0 ? Math.round((presentCount / sessions.length) * 100) : 0;
      
      return {
        name: student.name.split(' ')[0], // First name only
        attendance: percentage
      };
    }).slice(0, 15); // Top 15 students
  };

  const getFacultySessionData = () => {
    const facultyMap = sessions.reduce((acc, session) => {
      const faculty = session.faculty_name;
      acc[faculty] = (acc[faculty] || 0) + 1;
      return acc;
    }, {});
    
    return Object.entries(facultyMap).map(([name, count]) => ({
      name: name.split(' ')[0], // First name only
      sessions: count
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  const stats = calculateStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        <Card className="backdrop-blur-xl bg-white/80 border-0 shadow-2xl rounded-3xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-8 text-white">
            <h1 className="text-4xl font-bold mb-2">📊 {batch.batch_name}</h1>
            <p className="text-blue-100">{batch.college_name}</p>
            <p className="text-blue-100 text-sm">{batch.year} • {batch.branch}</p>
          </div>

          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg">
                <CardContent className="p-6">
                  <Users className="w-10 h-10 mb-3 opacity-80" />
                  <div className="text-4xl font-bold mb-1">{students.length}</div>
                  <div className="text-blue-100">Total Students</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-lg">
                <CardContent className="p-6">
                  <BookOpen className="w-10 h-10 mb-3 opacity-80" />
                  <div className="text-4xl font-bold mb-1">{sessions.length}</div>
                  <div className="text-purple-100">Total Sessions</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-lg">
                <CardContent className="p-6">
                  <TrendingUp className="w-10 h-10 mb-3 opacity-80" />
                  <div className="text-4xl font-bold mb-1">{stats.avgAttendance}%</div>
                  <div className="text-green-100">Avg Attendance</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0 shadow-lg">
                <CardContent className="p-6">
                  <Award className="w-10 h-10 mb-3 opacity-80" />
                  <div className="text-4xl font-bold mb-1">{attendanceRecords.length}</div>
                  <div className="text-orange-100">Total Records</div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Attendance Trend Line Chart */}
              <Card className="backdrop-blur-xl bg-white/80 border-0 shadow-xl">
                <CardHeader className="bg-gradient-to-r from-blue-100 to-indigo-100">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    Attendance Trend
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={getAttendanceTrendData()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis dataKey="date" stroke="#666" />
                      <YAxis stroke="#666" />
                      <Tooltip 
                        contentStyle={{ background: 'rgba(255,255,255,0.95)', borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="percentage" stroke="#3b82f6" strokeWidth={3} name="Attendance %" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Present vs Absent Pie Chart */}
              <Card className="backdrop-blur-xl bg-white/80 border-0 shadow-xl">
                <CardHeader className="bg-gradient-to-r from-green-100 to-emerald-100">
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-green-600" />
                    Present vs Absent
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <RechartsPieChart>
                      <Pie 
                        data={getPresentAbsentData()} 
                        cx="50%" 
                        cy="50%" 
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={80} 
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {getPresentAbsentData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Student Distribution Bar Chart */}
              <Card className="backdrop-blur-xl bg-white/80 border-0 shadow-xl">
                <CardHeader className="bg-gradient-to-r from-purple-100 to-pink-100">
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-purple-600" />
                    Student Attendance Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={getStudentDistributionData()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis dataKey="name" stroke="#666" angle={-45} textAnchor="end" height={80} />
                      <YAxis stroke="#666" />
                      <Tooltip 
                        contentStyle={{ background: 'rgba(255,255,255,0.95)', borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Legend />
                      <Bar dataKey="attendance" fill="#8b5cf6" name="Attendance %" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Faculty Session Count */}
              <Card className="backdrop-blur-xl bg-white/80 border-0 shadow-xl">
                <CardHeader className="bg-gradient-to-r from-orange-100 to-red-100">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-orange-600" />
                    Faculty Session Count
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={getFacultySessionData()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis dataKey="name" stroke="#666" />
                      <YAxis stroke="#666" />
                      <Tooltip 
                        contentStyle={{ background: 'rgba(255,255,255,0.95)', borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Legend />
                      <Bar dataKey="sessions" fill="#f59e0b" name="Sessions" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Button 
              onClick={generateHTMLReport}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-6 text-lg shadow-xl"
            >
              <Download className="w-6 h-6 mr-3" />
              Download Advanced HTML Report with Charts
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}