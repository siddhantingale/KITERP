import React, { useState, useEffect } from "react";
import { User, Student, Faculty, Session, AttendanceRecord, AssignmentSubmission, Batch, StudentPerformance } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User as UserIcon, Mail, Calendar, Shield, BookOpen, TrendingUp, Award, LogOut, Edit, GraduationCap, Building, Users, Clock, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [studentData, setStudentData] = useState(null);
  const [facultyData, setFacultyData] = useState(null);
  const [stats, setStats] = useState({});
  const [batches, setBatches] = useState([]);
  const [performances, setPerformances] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      // Check if student
      const studentRecords = await Student.filter({ email: currentUser.email });
      if (studentRecords.length > 0) {
        setUserRole("student");
        setStudentData(studentRecords[0]);
        await loadStudentStats(studentRecords[0]);
      } else {
        // Check if faculty
        const facultyRecords = await Faculty.filter({ email: currentUser.email });
        if (facultyRecords.length > 0) {
          setUserRole("faculty");
          setFacultyData(facultyRecords[0]);
          await loadFacultyStats(currentUser.email);
        } else {
          setUserRole("admin");
          await loadAdminStats();
        }
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    }
    setIsLoading(false);
  };

  const loadStudentStats = async (student) => {
    try {
      const [attendance, assignments, sessions, perfData, batchData] = await Promise.all([
        AttendanceRecord.filter({ student_id: student.id }),
        AssignmentSubmission.filter({ student_id: student.id }),
        Session.filter({ batch_id: student.batch_id }),
        StudentPerformance.filter({ student_id: student.id }),
        Batch.list()
      ]);

      const presentCount = attendance.filter(a => a.is_present).length;
      const totalSessions = sessions.length;
      const attendancePercent = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;

      const submittedAssignments = assignments.filter(a => a.status === "Submitted" || a.status === "Evaluated").length;
      const totalAssignments = assignments.length;
      
      const avgPercentage = perfData.length > 0 
        ? perfData.reduce((sum, p) => sum + (p.percentage || 0), 0) / perfData.length 
        : 0;

      setPerformances(perfData);
      setBatches(batchData);
      setStats({
        attendancePercent,
        presentCount,
        totalSessions,
        totalAssignments,
        submittedAssignments,
        pendingAssignments: totalAssignments - submittedAssignments,
        avgPercentage: avgPercentage.toFixed(1),
        totalPerformances: perfData.length
      });
    } catch (error) {
      console.error("Error loading student stats:", error);
    }
  };

  const loadFacultyStats = async (email) => {
    try {
      const [sessions, batchData, allStudents] = await Promise.all([
        Session.filter({ faculty_email: email }),
        Batch.list(),
        Student.list()
      ]);
      const totalSessions = sessions.length;
      const todaySessions = sessions.filter(s => s.session_date === new Date().toISOString().split('T')[0]).length;
      const uniqueBatches = [...new Set(sessions.map(s => s.batch_id))];

      setBatches(batchData);
      setStats({
        totalSessions,
        todaySessions,
        activeBatches: uniqueBatches.length,
        totalStudents: allStudents.filter(s => uniqueBatches.includes(s.batch_id)).length,
        completedSessions: sessions.filter(s => s.status === 'completed').length
      });
    } catch (error) {
      console.error("Error loading faculty stats:", error);
    }
  };

  const loadAdminStats = async () => {
    try {
      const [allSessions, allStudents, allBatches, allFaculty] = await Promise.all([
        Session.list("-created_date", 100),
        Student.list(),
        Batch.list(),
        Faculty.list()
      ]);

      setBatches(allBatches);
      setStats({
        totalStudents: allStudents.length,
        totalSessions: allSessions.length,
        totalBatches: allBatches.length,
        totalFaculty: allFaculty.length,
        activeFaculty: allFaculty.filter(f => f.status === 'active').length,
        recentSessions: allSessions.slice(0, 5).length
      });
    } catch (error) {
      console.error("Error loading admin stats:", error);
    }
  };

  const handleSaveProfile = async () => {
    try {
      await User.updateMe(editForm);
      setUser({ ...user, ...editForm });
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Profile Header */}
        <Card className="border-0 shadow-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white text-4xl font-bold ring-4 ring-white/30 shadow-2xl">
                  {user.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-4xl font-bold mb-2">{user.full_name}</h1>
                  <p className="text-blue-100 text-lg flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {user.email}
                  </p>
                  <Badge className="mt-2 bg-white/20 text-white border-white/30 text-sm px-3 py-1">
                    <Shield className="w-3 h-3 mr-1" />
                    {user.role === "admin" ? "Administrator" : userRole === "faculty" ? "Faculty" : "Student"}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => setIsEditing(!isEditing)} variant="outline" className="bg-white/20 border-white/30 text-white hover:bg-white/30">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
                <Button onClick={() => User.logout()} variant="outline" className="bg-red-500/20 border-red-300 text-white hover:bg-red-500/30">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Student Overview */}
            {userRole === "student" && studentData && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-xl hover:scale-105 transition-transform">
                  <CardContent className="p-5 text-center">
                    <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-80" />
                    <div className="text-3xl font-bold">{stats.attendancePercent || 0}%</div>
                    <div className="text-blue-100 text-sm">Attendance</div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-xl hover:scale-105 transition-transform">
                  <CardContent className="p-5 text-center">
                    <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-80" />
                    <div className="text-3xl font-bold">{stats.avgPercentage || 0}%</div>
                    <div className="text-green-100 text-sm">Avg Score</div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-xl hover:scale-105 transition-transform">
                  <CardContent className="p-5 text-center">
                    <Award className="w-10 h-10 mx-auto mb-2 opacity-80" />
                    <div className="text-3xl font-bold">{stats.totalPerformances || 0}</div>
                    <div className="text-purple-100 text-sm">Assessments</div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0 shadow-xl hover:scale-105 transition-transform">
                  <CardContent className="p-5 text-center">
                    <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-80" />
                    <div className="text-3xl font-bold">{stats.submittedAssignments || 0}</div>
                    <div className="text-orange-100 text-sm">Completed</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Faculty Overview */}
            {userRole === "faculty" && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-xl hover:scale-105 transition-transform">
                  <CardContent className="p-5 text-center">
                    <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-80" />
                    <div className="text-3xl font-bold">{stats.totalSessions || 0}</div>
                    <div className="text-purple-100 text-sm">Total Sessions</div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-xl hover:scale-105 transition-transform">
                  <CardContent className="p-5 text-center">
                    <Calendar className="w-10 h-10 mx-auto mb-2 opacity-80" />
                    <div className="text-3xl font-bold">{stats.todaySessions || 0}</div>
                    <div className="text-blue-100 text-sm">Today's Classes</div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-xl hover:scale-105 transition-transform">
                  <CardContent className="p-5 text-center">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-80" />
                    <div className="text-3xl font-bold">{stats.activeBatches || 0}</div>
                    <div className="text-green-100 text-sm">Active Batches</div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0 shadow-xl hover:scale-105 transition-transform">
                  <CardContent className="p-5 text-center">
                    <GraduationCap className="w-10 h-10 mx-auto mb-2 opacity-80" />
                    <div className="text-3xl font-bold">{stats.totalStudents || 0}</div>
                    <div className="text-orange-100 text-sm">Students</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Admin Overview */}
            {userRole === "admin" && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-0 shadow-xl hover:scale-105 transition-transform">
                  <CardContent className="p-5 text-center">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-80" />
                    <div className="text-3xl font-bold">{stats.totalStudents || 0}</div>
                    <div className="text-indigo-100 text-sm">Students</div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-xl hover:scale-105 transition-transform">
                  <CardContent className="p-5 text-center">
                    <GraduationCap className="w-10 h-10 mx-auto mb-2 opacity-80" />
                    <div className="text-3xl font-bold">{stats.totalFaculty || 0}</div>
                    <div className="text-green-100 text-sm">Faculty</div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-xl hover:scale-105 transition-transform">
                  <CardContent className="p-5 text-center">
                    <Building className="w-10 h-10 mx-auto mb-2 opacity-80" />
                    <div className="text-3xl font-bold">{stats.totalBatches || 0}</div>
                    <div className="text-purple-100 text-sm">Batches</div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-pink-500 to-pink-600 text-white border-0 shadow-xl hover:scale-105 transition-transform">
                  <CardContent className="p-5 text-center">
                    <Shield className="w-10 h-10 mx-auto mb-2 opacity-80" />
                    <div className="text-3xl font-bold">{stats.activeFaculty || 0}</div>
                    <div className="text-pink-100 text-sm">Active Faculty</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Profile Info Card */}
            <Card>
              <CardHeader className="bg-gradient-to-r from-blue-100 to-indigo-100">
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-600">Full Name</Label>
                    <p className="font-semibold text-lg">{user.full_name}</p>
                  </div>
                  <div>
                    <Label className="text-gray-600">Email</Label>
                    <p className="font-semibold text-lg">{user.email}</p>
                  </div>
                  <div>
                    <Label className="text-gray-600">Role</Label>
                    <p className="font-semibold text-lg capitalize">{user.role}</p>
                  </div>
                  <div>
                    <Label className="text-gray-600">Member Since</Label>
                    <p className="font-semibold text-lg">{new Date(user.created_date).toLocaleDateString()}</p>
                  </div>
                </div>

                {studentData && (
                  <div className="mt-6 pt-6 border-t">
                    <h3 className="font-bold text-lg mb-4">Academic Details</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-gray-600">Roll Number</Label>
                        <p className="font-semibold">{studentData.roll_no}</p>
                      </div>
                      {studentData.prn && (
                        <div>
                          <Label className="text-gray-600">PRN</Label>
                          <p className="font-semibold">{studentData.prn}</p>
                        </div>
                      )}
                      {studentData.college_name && (
                        <div>
                          <Label className="text-gray-600">College</Label>
                          <p className="font-semibold">{studentData.college_name}</p>
                        </div>
                      )}
                      {studentData.year && (
                        <div>
                          <Label className="text-gray-600">Year</Label>
                          <p className="font-semibold">{studentData.year}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="space-y-6">
            {/* Student Performance Charts */}
            {userRole === "student" && performances.length > 0 && (
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="shadow-xl border-0">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                    <CardTitle>Performance Trend</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={performances.slice(-10).map((p, idx) => ({
                        name: `Test ${idx + 1}`,
                        percentage: p.percentage
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" fontSize={12} />
                        <YAxis domain={[0, 100]} fontSize={12} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="percentage" stroke="#3b82f6" strokeWidth={3} name="Score %" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="shadow-xl border-0">
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
                    <CardTitle>Subject-wise Performance</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={(() => {
                        const subjectPerf = performances.reduce((acc, p) => {
                          if (!acc[p.subject]) acc[p.subject] = { subject: p.subject, total: 0, count: 0 };
                          acc[p.subject].total += p.percentage;
                          acc[p.subject].count += 1;
                          return acc;
                        }, {});
                        return Object.values(subjectPerf).map(s => ({
                          subject: s.subject.substring(0, 10),
                          avg: Math.round(s.total / s.count)
                        }));
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="subject" fontSize={11} angle={-45} textAnchor="end" height={60} />
                        <YAxis domain={[0, 100]} fontSize={12} />
                        <Tooltip />
                        <Bar dataKey="avg" fill="#8b5cf6" name="Avg %" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Faculty Statistics */}
            {userRole === "faculty" && (
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="shadow-xl border-0">
                  <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
                    <CardTitle>Session Overview</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-4 bg-blue-50 rounded-xl">
                        <span className="text-gray-700">Total Sessions</span>
                        <span className="text-2xl font-bold text-blue-600">{stats.totalSessions}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-green-50 rounded-xl">
                        <span className="text-gray-700">Completed</span>
                        <span className="text-2xl font-bold text-green-600">{stats.completedSessions || 0}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-purple-50 rounded-xl">
                        <span className="text-gray-700">Today's Classes</span>
                        <span className="text-2xl font-bold text-purple-600">{stats.todaySessions}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-xl border-0">
                  <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b">
                    <CardTitle>Teaching Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-4 bg-orange-50 rounded-xl">
                        <span className="text-gray-700">Active Batches</span>
                        <span className="text-2xl font-bold text-orange-600">{stats.activeBatches}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-indigo-50 rounded-xl">
                        <span className="text-gray-700">Total Students</span>
                        <span className="text-2xl font-bold text-indigo-600">{stats.totalStudents || 0}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Admin Statistics */}
            {userRole === "admin" && (
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="shadow-xl border-0">
                  <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b">
                    <CardTitle>System Overview</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-blue-50 rounded-xl text-center">
                        <Users className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                        <div className="text-2xl font-bold text-blue-700">{stats.totalStudents}</div>
                        <div className="text-sm text-gray-600">Students</div>
                      </div>
                      <div className="p-4 bg-green-50 rounded-xl text-center">
                        <GraduationCap className="w-8 h-8 mx-auto mb-2 text-green-600" />
                        <div className="text-2xl font-bold text-green-700">{stats.totalFaculty || 0}</div>
                        <div className="text-sm text-gray-600">Faculty</div>
                      </div>
                      <div className="p-4 bg-purple-50 rounded-xl text-center">
                        <Building className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                        <div className="text-2xl font-bold text-purple-700">{stats.totalBatches || 0}</div>
                        <div className="text-sm text-gray-600">Batches</div>
                      </div>
                      <div className="p-4 bg-orange-50 rounded-xl text-center">
                        <Calendar className="w-8 h-8 mx-auto mb-2 text-orange-600" />
                        <div className="text-2xl font-bold text-orange-700">{stats.totalSessions}</div>
                        <div className="text-sm text-gray-600">Sessions</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-xl border-0">
                  <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
                    <CardTitle>Faculty Status</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Active', value: stats.activeFaculty || 0 },
                            { name: 'Inactive', value: (stats.totalFaculty || 0) - (stats.activeFaculty || 0) }
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          <Cell fill="#10b981" />
                          <Cell fill="#ef4444" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            )}

            {performances.length === 0 && userRole === "student" && (
              <Card className="shadow-xl border-0">
                <CardContent className="p-12 text-center">
                  <Award className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">No performance data available yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader className="bg-gradient-to-r from-blue-100 to-indigo-100">
                <CardTitle>Account Settings</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {isEditing ? (
                  <>
                    <div>
                      <Label>Full Name</Label>
                      <Input 
                        value={editForm.full_name || user.full_name} 
                        onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={handleSaveProfile} className="bg-green-600 hover:bg-green-700">
                        Save Changes
                      </Button>
                      <Button onClick={() => setIsEditing(false)} variant="outline">
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertDescription className="text-blue-800">
                      Click "Edit Profile" above to update your information
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}