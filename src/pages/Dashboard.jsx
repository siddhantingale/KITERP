import React, { useState, useEffect } from "react";
import { Session, Student, Batch, AttendanceRecord, AttendanceSession } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, Users, Calendar, TrendingUp, Clock, Mail, UserCog } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Dashboard() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [studentCount, setStudentCount] = useState(0);
  const [batches, setBatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingEmails, setIsSendingEmails] = useState(false);
  const [emailMessage, setEmailMessage] = useState(null);
  const [facultyCount, setFacultyCount] = useState(0);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [sessionsData, allStudents, batchesData, facultyData, currentUser] = await Promise.all([
        Session.list("-created_date", 20),
        Student.list(),
        Batch.list("-created_date", 10),
        api.entities.Faculty.list(),
        api.auth.me().catch(() => null)
      ]);
      
      setSessions(sessionsData);
      setStudents(allStudents);
      setStudentCount(allStudents.length);
      setBatches(batchesData);
      setFacultyCount(facultyData.length);
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    }
    setIsLoading(false);
  };

  const todaySessions = sessions.filter(session => 
    format(new Date(session.session_date), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  );

  const completedSessions = sessions.filter(session => session.status === 'completed');
  const avgAttendance = completedSessions.length > 0 
    ? (completedSessions.reduce((sum, session) => {
        const sessionAttendance = (session.total_students && session.total_students > 0) 
          ? ((session.present_count || 0) / session.total_students) 
          : 0;
        return sum + sessionAttendance;
      }, 0) / completedSessions.length * 100)
    : 0;

  const handleBatchClick = (batchId) => {
    navigate(createPageUrl(`BatchDetails?batch_id=${batchId}`));
  };

  const sendAttendanceReports = async () => {
    setIsSendingEmails(true);
    setEmailMessage(null);
    
    try {
      const studentsWithEmail = students.filter(s => s.email && s.email.includes('@'));
      
      if (studentsWithEmail.length === 0) {
        setEmailMessage({ type: "error", text: "No students have email addresses configured" });
        setIsSendingEmails(false);
        return;
      }

      let sent = 0;
      for (const student of studentsWithEmail) {
        const attendanceRecords = await api.entities.AttendanceRecord.filter({ student_id: student.id });
        const attendanceSessions = await api.entities.AttendanceSession.filter({ batch_id: student.batch_id });
        
        const totalSessions = attendanceSessions.length;
        const presentCount = attendanceRecords.filter(r => r.is_present).length;
        const attendancePercentage = totalSessions > 0 ? ((presentCount / totalSessions) * 100).toFixed(2) : 0;

        const emailBody = `Dear ${student.name},

Here is your current attendance report:

Total Sessions: ${totalSessions}
Sessions Attended: ${presentCount}
Attendance Percentage: ${attendancePercentage}%

Batch: ${batches.find(b => b.batch_id === student.batch_id)?.batch_name || student.batch_id}
Roll Number: ${student.roll_no}

${attendancePercentage < 75 ? '\n⚠️ Warning: Your attendance is below 75%. Please improve your attendance.\n' : ''}

Best regards,
EDU TRACK Team`;

        await api.integrations.Core.SendEmail({
          to: student.email,
          subject: `Attendance Report - ${student.name}`,
          body: emailBody,
          from_name: "EDU TRACK"
        });
        
        sent++;
      }

      setEmailMessage({ type: "success", text: `Attendance reports sent to ${sent} students successfully!` });
    } catch (error) {
      console.error("Error sending emails:", error);
      setEmailMessage({ type: "error", text: "Failed to send some emails. Please try again." });
    }
    
    setIsSendingEmails(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-3 sm:p-4 md:p-6 relative overflow-hidden safe-area-inset">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-64 sm:w-96 h-64 sm:h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-64 sm:w-96 h-64 sm:h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 sm:w-96 h-64 sm:h-96 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 md:space-y-8 relative z-10">
        {/* Header */}
        <div className="backdrop-blur-xl bg-white/60 rounded-2xl sm:rounded-3xl border border-white/50 shadow-xl sm:shadow-2xl p-4 sm:p-6 md:p-8">
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent leading-tight">
                Welcome to EDU TRACK
              </h1>
              <p className="text-gray-700 text-sm sm:text-base md:text-lg mt-1 sm:mt-2">
                Complete Education Management Platform
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button 
                onClick={sendAttendanceReports}
                disabled={isSendingEmails}
                variant="outline"
                className="backdrop-blur-md bg-white/50 border-white/50 hover:bg-white/70 w-full sm:w-auto h-10 sm:h-9 text-sm touch-manipulation"
              >
                <Mail className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
                <span className="truncate">{isSendingEmails ? "Sending..." : "Email Reports"}</span>
              </Button>
              {user?.role !== 'admin' && (
                <Link to={createPageUrl("CreateSession")} className="w-full sm:w-auto">
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg h-10 sm:h-9 text-sm touch-manipulation">
                    <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
                    Create Session
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {emailMessage && (
          <Alert className={emailMessage.type === "error" ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}>
            <AlertDescription className={emailMessage.type === "error" ? "text-red-800" : "text-green-800"}>
              {emailMessage.text}
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Cards - Responsive Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
          <div className="group backdrop-blur-xl bg-gradient-to-br from-blue-500/20 to-blue-600/30 rounded-xl sm:rounded-2xl border border-white/50 shadow-lg sm:shadow-xl p-3 sm:p-4 md:p-6 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-blue-600/0 group-hover:from-blue-500/10 group-hover:to-blue-600/10 transition-all"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2 sm:mb-4">
                <div className="p-2 sm:p-3 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg sm:rounded-xl shadow-lg">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
                </div>
              </div>
              <p className="text-xs sm:text-sm font-medium text-blue-900 mb-1 sm:mb-2">Total Sessions</p>
              <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-blue-700">{sessions.length}</p>
              <p className="text-xs text-blue-600 mt-1 sm:mt-2 hidden sm:block">Recently created</p>
            </div>
          </div>

          <div className="group backdrop-blur-xl bg-gradient-to-br from-green-500/20 to-green-600/30 rounded-xl sm:rounded-2xl border border-white/50 shadow-lg sm:shadow-xl p-3 sm:p-4 md:p-6 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/0 to-green-600/0 group-hover:from-green-500/10 group-hover:to-green-600/10 transition-all"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2 sm:mb-4">
                <div className="p-2 sm:p-3 bg-gradient-to-br from-green-600 to-green-700 rounded-lg sm:rounded-xl shadow-lg">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
                </div>
              </div>
              <p className="text-xs sm:text-sm font-medium text-green-900 mb-1 sm:mb-2">Today's Sessions</p>
              <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-green-700">{todaySessions.length}</p>
              <p className="text-xs text-green-600 mt-1 sm:mt-2 hidden sm:block">Scheduled for today</p>
            </div>
          </div>

          <div className="group backdrop-blur-xl bg-gradient-to-br from-purple-500/20 to-purple-600/30 rounded-xl sm:rounded-2xl border border-white/50 shadow-lg sm:shadow-xl p-3 sm:p-4 md:p-6 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-purple-600/0 group-hover:from-purple-500/10 group-hover:to-purple-600/10 transition-all"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2 sm:mb-4">
                <div className="p-2 sm:p-3 bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg sm:rounded-xl shadow-lg">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
                </div>
              </div>
              <p className="text-xs sm:text-sm font-medium text-purple-900 mb-1 sm:mb-2">Total Students</p>
              <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-purple-700">{studentCount}</p>
              <p className="text-xs text-purple-600 mt-1 sm:mt-2 hidden sm:block">Across all batches</p>
            </div>
          </div>

          <div className="group backdrop-blur-xl bg-gradient-to-br from-orange-500/20 to-orange-600/30 rounded-xl sm:rounded-2xl border border-white/50 shadow-lg sm:shadow-xl p-3 sm:p-4 md:p-6 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 to-orange-600/0 group-hover:from-orange-500/10 group-hover:to-orange-600/10 transition-all"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2 sm:mb-4">
                <div className="p-2 sm:p-3 bg-gradient-to-br from-orange-600 to-orange-700 rounded-lg sm:rounded-xl shadow-lg">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
                </div>
              </div>
              <p className="text-xs sm:text-sm font-medium text-orange-900 mb-1 sm:mb-2">Avg Attendance</p>
              <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-orange-700">{avgAttendance.toFixed(1)}%</p>
              <p className="text-xs text-orange-600 mt-1 sm:mt-2 hidden sm:block">Overall average</p>
            </div>
          </div>

          <div className="group backdrop-blur-xl bg-gradient-to-br from-indigo-500/20 to-indigo-600/30 rounded-xl sm:rounded-2xl border border-white/50 shadow-lg sm:shadow-xl p-3 sm:p-4 md:p-6 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden col-span-2 sm:col-span-1">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-indigo-600/0 group-hover:from-indigo-500/10 group-hover:to-indigo-600/10 transition-all"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2 sm:mb-4">
                <div className="p-2 sm:p-3 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-lg sm:rounded-xl shadow-lg">
                  <UserCog className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
                </div>
              </div>
              <p className="text-xs sm:text-sm font-medium text-indigo-900 mb-1 sm:mb-2">Total Faculty</p>
              <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-indigo-700">{facultyCount}</p>
              <p className="text-xs text-indigo-600 mt-1 sm:mt-2 hidden sm:block">AIML Department</p>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
          {/* Recent Sessions */}
          <div className="backdrop-blur-xl bg-white/70 rounded-2xl sm:rounded-3xl border border-white/50 shadow-xl sm:shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 p-4 sm:p-6 border-b border-white/30">
              <CardTitle className="text-base sm:text-lg md:text-xl flex items-center gap-2 text-gray-900 font-bold">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                Recent Sessions
              </CardTitle>
            </div>
            <div className="p-3 sm:p-4 md:p-6">
              {isLoading ? (
                <p className="text-sm">Loading sessions...</p>
              ) : sessions.length === 0 ? (
                <div className="text-center py-6 sm:py-8 px-4">
                  <Calendar className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mx-auto mb-3 sm:mb-4" />
                  <p className="text-gray-500 text-sm sm:text-base">No sessions created yet</p>
                  <Link to={createPageUrl("CreateSession")}>
                    <Button className="mt-3 sm:mt-4 bg-gradient-to-r from-blue-600 to-purple-600 text-sm">Create Your First Session</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {sessions.slice(0, 5).map((session) => (
                    <div key={session.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 p-3 sm:p-4 backdrop-blur-md bg-white/60 border border-white/50 rounded-lg sm:rounded-xl hover:bg-white/80 hover:shadow-lg transition-all duration-200">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{session.session_name}</h3>
                        <p className="text-xs sm:text-sm text-gray-600 truncate">{session.batch_description || session.topic_taught}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{format(new Date(session.session_date), "MMM d, yyyy")} • {session.session_time}</p>
                      </div>
                      <div className="flex-shrink-0">
                        <Badge 
                          className={`text-xs ${
                            session.status === 'completed' ? 'bg-green-100 text-green-800' :
                            session.status === 'active' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {session.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Batches Overview */}
          <div className="backdrop-blur-xl bg-white/70 rounded-2xl sm:rounded-3xl border border-white/50 shadow-xl sm:shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 p-4 sm:p-6 border-b border-white/30">
              <CardTitle className="text-base sm:text-lg md:text-xl flex items-center gap-2 text-gray-900 font-bold">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                Recent Batches Overview
              </CardTitle>
            </div>
            <div className="p-3 sm:p-4 md:p-6">
              {isLoading ? (
                <p className="text-sm">Loading batches...</p>
              ) : batches.length === 0 ? (
                <div className="text-center py-6 sm:py-8 px-4">
                  <Users className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mx-auto mb-3 sm:mb-4" />
                  <p className="text-gray-500 text-sm sm:text-base">No batches created yet</p>
                  <Link to={createPageUrl("Upload")}>
                    <Button className="mt-3 sm:mt-4 bg-gradient-to-r from-purple-600 to-pink-600 text-sm">Upload Students</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {batches.slice(0, 5).map((batch) => (
                    <div 
                      key={batch.id} 
                      onClick={() => handleBatchClick(batch.id)}
                      className="group p-3 sm:p-4 backdrop-blur-md bg-white/60 border border-white/50 rounded-lg sm:rounded-xl hover:bg-white/80 hover:shadow-lg cursor-pointer transition-all duration-200 touch-manipulation"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 text-sm sm:text-base group-hover:text-purple-700 transition-colors truncate">{batch.batch_name}</h3>
                          <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1 truncate">{batch.batch_description || `${batch.year} - ${batch.branch}`}</p>
                          <p className="text-xs text-gray-500 mt-0.5 sm:mt-1 truncate">{batch.college_name}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-0.5 sm:mb-1">{batch.student_count || 0}</div>
                          <div className="text-xs text-gray-500">Students</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}