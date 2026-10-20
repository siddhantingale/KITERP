import React, { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, BookOpen, Award, Calendar, TrendingUp, CheckCircle, AlertTriangle } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Generate realistic attendance data
const generateAttendanceData = () => {
  const totalSessions = Math.floor(Math.random() * 20) + 40; // 40-60 sessions
  const present = Math.floor(totalSessions * (0.75 + Math.random() * 0.2)); // 75-95% attendance
  const absent = totalSessions - present;
  const percentage = parseFloat(((present / totalSessions) * 100).toFixed(2));
  return { totalSessions, present, absent, percentage };
};

const DEMO_ATTENDANCE = generateAttendanceData();

const DEMO_PERFORMANCE = [
  { subject: "Machine Learning", percentage: 92, grade: "A+", marks: "92/100" },
  { subject: "Data Structures", percentage: 88, grade: "A", marks: "88/100" },
  { subject: "Database Systems", percentage: 95, grade: "A+", marks: "95/100" },
  { subject: "Operating Systems", percentage: 85, grade: "A", marks: "85/100" },
  { subject: "Computer Networks", percentage: 90, grade: "A+", marks: "90/100" }
];

const PERFORMANCE_TREND = [
  { exam: "IT-1", score: 85 },
  { exam: "IT-2", score: 88 },
  { exam: "IT-3", score: 92 },
  { exam: "Mid-Sem", score: 90 }
];

export default function StudentDetailModal({ isOpen, onClose, student }) {
  const [activeTab, setActiveTab] = useState("overview");

  if (!student) return null;

  const avgPerformance = (DEMO_PERFORMANCE.reduce((sum, p) => sum + p.percentage, 0) / DEMO_PERFORMANCE.length).toFixed(2);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-lg">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold mb-1">{student.name}</h2>
          <div className="flex gap-4 text-sm opacity-90">
            <span className="flex items-center gap-1">
              <BookOpen className="w-4 h-4" />
              Roll: {student.roll_no}
            </span>
            {student.prn && (
              <span>• PRN: {student.prn}</span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="p-6">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <CardContent className="p-6 text-center">
                  <Calendar className="w-10 h-10 text-blue-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-600 mb-1">Attendance</p>
                  <p className="text-3xl font-bold text-blue-700">{DEMO_ATTENDANCE.percentage}%</p>
                  <p className="text-xs text-gray-500 mt-1">Excellent</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <CardContent className="p-6 text-center">
                  <Award className="w-10 h-10 text-green-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-600 mb-1">Avg Performance</p>
                  <p className="text-3xl font-bold text-green-700">{avgPerformance}%</p>
                  <p className="text-xs text-gray-500 mt-1">Outstanding</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <CardContent className="p-6 text-center">
                  <TrendingUp className="w-10 h-10 text-purple-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-600 mb-1">Overall Grade</p>
                  <p className="text-3xl font-bold text-purple-700">A+</p>
                  <p className="text-xs text-gray-500 mt-1">Top Performer</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg mb-4">Student Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Name</p>
                    <p className="font-semibold">{student.name}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Roll Number</p>
                    <p className="font-semibold">{student.roll_no}</p>
                  </div>
                  {student.email && (
                    <div>
                      <p className="text-gray-600">Email</p>
                      <p className="font-semibold">{student.email}</p>
                    </div>
                  )}
                  {student.year && (
                    <div>
                      <p className="text-gray-600">Year</p>
                      <p className="font-semibold">{student.year}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance" className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-6 text-center">
                  <BookOpen className="w-12 h-12 text-blue-600 mx-auto mb-2" />
                  <p className="text-4xl font-bold text-gray-900">{DEMO_ATTENDANCE.totalSessions}</p>
                  <p className="text-sm text-gray-600">Total Sessions</p>
                </CardContent>
              </Card>
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-6 text-center">
                  <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
                  <p className="text-4xl font-bold text-gray-900">{DEMO_ATTENDANCE.present}</p>
                  <p className="text-sm text-gray-600">Present</p>
                </CardContent>
              </Card>
              <Card className="bg-red-50 border-red-200">
                <CardContent className="p-6 text-center">
                  <X className="w-12 h-12 text-red-600 mx-auto mb-2" />
                  <p className="text-4xl font-bold text-gray-900">{DEMO_ATTENDANCE.absent}</p>
                  <p className="text-sm text-gray-600">Absent</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg mb-4">Attendance Percentage</h3>
                <div className="relative">
                  <div className="w-full bg-gray-200 rounded-full h-8">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-emerald-600 h-8 rounded-full flex items-center justify-end pr-3"
                      style={{ width: `${DEMO_ATTENDANCE.percentage}%` }}
                    >
                      <span className="text-white font-bold text-sm">{DEMO_ATTENDANCE.percentage}%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <p className="text-green-700 font-semibold">Excellent Attendance - Above 75%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Performance Trend Chart */}
              <Card className="bg-pink-50 border-pink-200">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-lg mb-4">Performance Trend</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={PERFORMANCE_TREND}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="exam" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="score" stroke="#9333ea" strokeWidth={3} name="Score %" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Subject-wise Average Chart */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-lg mb-4">Subject-wise Average</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={DEMO_PERFORMANCE}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="subject" angle={-15} textAnchor="end" height={80} fontSize={11} />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="percentage" fill="#3b82f6" name="Avg %" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Subject Performance Table */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg mb-4">Subject-wise Performance</h3>
                <div className="space-y-3">
                  {DEMO_PERFORMANCE.map((perf, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{perf.subject}</p>
                        <p className="text-sm text-gray-600">Marks: {perf.marks}</p>
                      </div>
                      <div className="text-center px-4">
                        <p className="text-2xl font-bold text-purple-700">{perf.percentage}%</p>
                      </div>
                      <div>
                        <span className={`px-4 py-2 rounded-full font-bold ${
                          perf.grade === 'A+' ? 'bg-green-100 text-green-800' :
                          perf.grade === 'A' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {perf.grade}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-gray-500">Assessment history will be shown here</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}