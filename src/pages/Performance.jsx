import React, { useState, useEffect } from "react";
import { StudentPerformance, Student, Batch, AttendanceRecord, Session, Complaint, Feedback, AssignmentSubmission } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Plus, Edit, Trash2, Download, TrendingUp, Award, Mail, Calendar, BookOpen, AlertTriangle, FileText } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import ManageStudentEmailsModal from "../components/students/ManageStudentEmailsModal";
import { jsPDF } from "jspdf";

const assessmentTypes = ["Internal Test 1", "Internal Test 2", "Internal Test 3", "Assignment", "Project", "Practical", "Final Exam", "Quiz"];
const grades = ["A+", "A", "B+", "B", "C", "D", "F"];

export default function PerformancePage() {
  const [performances, setPerformances] = useState([]);
  const [students, setStudents] = useState([]);
  const [batches, setBatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPerformance, setEditingPerformance] = useState(null);
  const [message, setMessage] = useState(null);
  const [filterBatch, setFilterBatch] = useState("");
  const [filterStudent, setFilterStudent] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [studentDialog, setStudentDialog] = useState(null);
  
  const [formData, setFormData] = useState({
    student_id: "",
    batch_id: "",
    subject: "",
    assessment_type: "Internal Test 1",
    marks_obtained: "",
    total_marks: "",
    assessment_date: new Date().toISOString().split('T')[0],
    semester: "",
    remarks: ""
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [perfData, studentData, batchData] = await Promise.all([
        StudentPerformance.list("-created_date", 500),
        Student.list(),
        Batch.list()
      ]);
      setPerformances(perfData);
      setStudents(studentData);
      setBatches(batchData);
    } catch (error) {
      console.error("Error loading data:", error);
      setMessage({ type: "error", text: "Failed to load data" });
    }
    setIsLoading(false);
  };

  const calculateGrade = (percentage) => {
    if (percentage >= 90) return "A+";
    if (percentage >= 80) return "A";
    if (percentage >= 70) return "B+";
    if (percentage >= 60) return "B";
    if (percentage >= 50) return "C";
    if (percentage >= 40) return "D";
    return "F";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const student = students.find(s => s.id === formData.student_id);
      const batch = batches.find(b => b.id === formData.batch_id);
      
      if (!student || !batch) {
        setMessage({ type: "error", text: "Please select valid student and batch" });
        return;
      }

      const marksObtained = parseFloat(formData.marks_obtained);
      const totalMarks = parseFloat(formData.total_marks);
      const percentage = (marksObtained / totalMarks) * 100;
      const grade = calculateGrade(percentage);

      const perfData = {
        student_id: student.id,
        student_name: student.name,
        prn: student.prn,
        roll_no: student.roll_no,
        batch_id: batch.batch_id,
        college_name: batch.college_name,
        year: batch.year,
        branch: batch.branch,
        subject: formData.subject,
        assessment_type: formData.assessment_type,
        marks_obtained: marksObtained,
        total_marks: totalMarks,
        percentage: parseFloat(percentage.toFixed(2)),
        grade: grade,
        assessment_date: formData.assessment_date,
        semester: formData.semester,
        remarks: formData.remarks
      };

      if (editingPerformance) {
        await StudentPerformance.update(editingPerformance.id, perfData);
        setMessage({ type: "success", text: "Performance record updated" });
      } else {
        await StudentPerformance.create(perfData);
        setMessage({ type: "success", text: "Performance record added" });
      }

      await loadData();
      resetForm();
      setShowAddModal(false);
    } catch (error) {
      console.error("Error saving performance:", error);
      setMessage({ type: "error", text: "Failed to save performance record" });
    }
  };

  const handleEdit = (perf) => {
    setEditingPerformance(perf);
    const student = students.find(s => s.id === perf.student_id);
    const batch = batches.find(b => b.batch_id === perf.batch_id);
    
    setFormData({
      student_id: perf.student_id,
      batch_id: batch?.id || "",
      subject: perf.subject,
      assessment_type: perf.assessment_type,
      marks_obtained: perf.marks_obtained.toString(),
      total_marks: perf.total_marks.toString(),
      assessment_date: perf.assessment_date,
      semester: perf.semester || "",
      remarks: perf.remarks || ""
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    try {
      await StudentPerformance.delete(id);
      setMessage({ type: "success", text: "Record deleted" });
      await loadData();
    } catch (error) {
      console.error("Error deleting:", error);
      setMessage({ type: "error", text: "Failed to delete record" });
    }
  };

  const resetForm = () => {
    setFormData({
      student_id: "",
      batch_id: "",
      subject: "",
      assessment_type: "Internal Test 1",
      marks_obtained: "",
      total_marks: "",
      assessment_date: new Date().toISOString().split('T')[0],
      semester: "",
      remarks: ""
    });
    setEditingPerformance(null);
  };

  const exportToCSV = () => {
    const filtered = getFilteredPerformances();
    const headers = ["Student", "Roll No", "Batch", "Subject", "Assessment", "Marks", "Total", "Percentage", "Grade", "Date"];
    const rows = filtered.map(p => [
      p.student_name,
      p.roll_no,
      batches.find(b => b.batch_id === p.batch_id)?.batch_name || p.batch_id,
      p.subject,
      p.assessment_type,
      p.marks_obtained,
      p.total_marks,
      p.percentage + "%",
      p.grade,
      p.assessment_date
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student_performance.csv";
    a.click();
  };

  const getFilteredPerformances = () => {
    return performances.filter(p => {
      const batchMatch = !filterBatch || p.batch_id === filterBatch;
      const studentMatch = !filterStudent || p.student_id === filterStudent;
      const searchMatch = !searchTerm || 
        p.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.subject.toLowerCase().includes(searchTerm.toLowerCase());
      return batchMatch && studentMatch && searchMatch;
    });
  };

  const getStudentStats = (studentId) => {
    const studentPerfs = performances.filter(p => p.student_id === studentId);
    if (studentPerfs.length === 0) return null;
    
    const avgPercentage = studentPerfs.reduce((sum, p) => sum + p.percentage, 0) / studentPerfs.length;
    return {
      totalAssessments: studentPerfs.length,
      avgPercentage: avgPercentage.toFixed(2),
      avgGrade: calculateGrade(avgPercentage)
    };
  };

  const filteredStudents = students.filter(s => !filterBatch || s.batch_id === batches.find(b => b.id === filterBatch)?.batch_id);

  const showStudentDialog = async (student, stats, perfs) => {
    // Fetch comprehensive student data
    try {
      const [attendanceData, sessionData, complaints, feedback, assignments] = await Promise.all([
        AttendanceRecord.filter({ student_id: student.id }),
        Session.filter({ batch_id: student.batch_id }),
        Complaint.filter({ student_id: student.id }),
        Feedback.filter({ student_id: student.id }),
        AssignmentSubmission.filter({ student_id: student.id })
      ]);
      
      setStudentDialog({ 
        student, 
        stats, 
        perfs, 
        attendance: attendanceData, 
        sessions: sessionData,
        complaints: complaints,
        feedback: feedback,
        assignments: assignments
      });
    } catch (error) {
      console.error("Error loading student details:", error);
      setStudentDialog({ student, stats, perfs, attendance: [], sessions: [], complaints: [], feedback: [], assignments: [] });
    }
  };

  const exportStudentPDF = (studentData) => {
    const doc = new jsPDF();
    const { student, stats, perfs, attendance, sessions, complaints, feedback, assignments } = studentData;
    
    const totalSessions = sessions?.length || 0;
    const presentCount = attendance?.filter(a => a.is_present).length || 0;
    const attendancePercent = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;

    // Header
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text('Student Performance Report', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 30, { align: 'center' });

    // Student Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(18);
    doc.text(student.name, 20, 55);
    doc.setFontSize(11);
    doc.text(`Roll No: ${student.roll_no}${student.prn ? ' | PRN: ' + student.prn : ''}`, 20, 62);
    doc.text(`Batch: ${batches.find(b => b.batch_id === student.batch_id)?.batch_name || 'N/A'}`, 20, 69);

    // Stats Section
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Performance Summary', 20, 85);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(11);
    let y = 95;
    doc.text(`Average Grade: ${stats?.avgGrade || 'N/A'}`, 20, y);
    doc.text(`Average Score: ${stats?.avgPercentage || 0}%`, 20, y + 7);
    doc.text(`Total Assessments: ${stats?.totalAssessments || 0}`, 20, y + 14);
    doc.text(`Attendance: ${attendancePercent}% (${presentCount}/${totalSessions})`, 20, y + 21);

    // Violations/Issues
    y += 35;
    doc.setFont(undefined, 'bold');
    doc.text('Violations & Issues', 20, y);
    doc.setFont(undefined, 'normal');
    y += 7;
    if (complaints?.length > 0) {
      doc.text(`Complaints Filed: ${complaints.length}`, 20, y);
      y += 7;
    }
    if (attendancePercent < 75) {
      doc.setTextColor(239, 68, 68);
      doc.text(`⚠ Low Attendance Warning: ${attendancePercent}%`, 20, y);
      doc.setTextColor(0, 0, 0);
      y += 7;
    }
    const lateSubmissions = assignments?.filter(a => a.is_late).length || 0;
    if (lateSubmissions > 0) {
      doc.text(`Late Submissions: ${lateSubmissions}`, 20, y);
      y += 7;
    }

    // Performance Records
    y += 10;
    doc.setFont(undefined, 'bold');
    doc.text('Assessment History', 20, y);
    doc.setFont(undefined, 'normal');
    y += 10;
    perfs.slice(0, 10).forEach((perf, idx) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${idx + 1}. ${perf.subject} - ${perf.assessment_type}`, 20, y);
      doc.text(`${perf.marks_obtained}/${perf.total_marks} (${perf.percentage}%) - Grade: ${perf.grade}`, 25, y + 5);
      y += 12;
    });

    // Footer
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);
    doc.text('Powered by EDU TRACK - Education Management System', 105, 285, { align: 'center' });

    doc.save(`${student.name}_Performance_Report.pdf`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 p-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -right-20 w-96 h-96 bg-green-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      </div>
      
      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2 sm:gap-3">
              <BarChart3 className="w-6 sm:w-8 h-6 sm:h-8 text-blue-600" />
              Student Performance
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">Track and manage student academic performance</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3 w-full md:w-auto">
            <Button onClick={() => setShowEmailModal(true)} variant="outline" className="gap-2 flex-1 sm:flex-none">
              <Mail className="w-4 h-4" />
              <span className="hidden sm:inline">Manage Emails</span>
            </Button>
            <Button onClick={exportToCSV} variant="outline" className="gap-2 flex-1 sm:flex-none">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
            <Dialog open={showAddModal} onOpenChange={(open) => {
              setShowAddModal(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
                  <Plus className="w-4 h-4" />
                  Add Record
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingPerformance ? "Edit" : "Add"} Performance Record</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Batch *</Label>
                      <Select value={formData.batch_id} onValueChange={(value) => {
                        setFormData({...formData, batch_id: value, student_id: ""});
                      }}>
                        <SelectTrigger><SelectValue placeholder="Select batch"/></SelectTrigger>
                        <SelectContent>
                          {batches.map(b => (
                            <SelectItem key={b.id} value={b.id}>{b.batch_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Student *</Label>
                      <Select value={formData.student_id} onValueChange={(value) => setFormData({...formData, student_id: value})} disabled={!formData.batch_id}>
                        <SelectTrigger><SelectValue placeholder="Select student"/></SelectTrigger>
                        <SelectContent>
                          {students.filter(s => s.batch_id === batches.find(b => b.id === formData.batch_id)?.batch_id).map(s => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name} ({s.roll_no})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Subject *</Label>
                      <Input value={formData.subject} onChange={(e) => setFormData({...formData, subject: e.target.value})} required />
                    </div>
                    <div>
                      <Label>Assessment Type *</Label>
                      <Select value={formData.assessment_type} onValueChange={(value) => setFormData({...formData, assessment_type: value})}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                          {assessmentTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Marks Obtained *</Label>
                      <Input type="number" value={formData.marks_obtained} onChange={(e) => setFormData({...formData, marks_obtained: e.target.value})} required />
                    </div>
                    <div>
                      <Label>Total Marks *</Label>
                      <Input type="number" value={formData.total_marks} onChange={(e) => setFormData({...formData, total_marks: e.target.value})} required />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Assessment Date *</Label>
                      <Input type="date" value={formData.assessment_date} onChange={(e) => setFormData({...formData, assessment_date: e.target.value})} required />
                    </div>
                    <div>
                      <Label>Semester</Label>
                      <Input value={formData.semester} onChange={(e) => setFormData({...formData, semester: e.target.value})} placeholder="e.g., Sem 1" />
                    </div>
                  </div>
                  <div>
                    <Label>Remarks</Label>
                    <Input value={formData.remarks} onChange={(e) => setFormData({...formData, remarks: e.target.value})} placeholder="Optional notes" />
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                      {editingPerformance ? "Update" : "Add"} Record
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {message && (
          <Alert className={message.type === "error" ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}>
            <AlertDescription className={message.type === "error" ? "text-red-800" : "text-green-800"}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-sm sm:text-base">Filter by Batch</Label>
            <Select value={filterBatch} onValueChange={setFilterBatch}>
              <SelectTrigger><SelectValue placeholder="All Batches"/></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>All Batches</SelectItem>
                {batches.map(b => <SelectItem key={b.id} value={b.batch_id}>{b.batch_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm sm:text-base">Filter by Student</Label>
            <Select value={filterStudent} onValueChange={setFilterStudent}>
              <SelectTrigger><SelectValue placeholder="All Students"/></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>All Students</SelectItem>
                {filteredStudents.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 md:col-span-1">
            <Label className="text-sm sm:text-base">Search</Label>
            <Input placeholder="Search by name or subject" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <Card>
          <CardHeader className="bg-gray-50 border-b">
            <CardTitle>Performance Records ({getFilteredPerformances().length})</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading ? (
              <p>Loading performance data...</p>
            ) : getFilteredPerformances().length === 0 ? (
              <div className="text-center py-12">
                <Award className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No performance records found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {getFilteredPerformances().map(perf => {
                  const stats = getStudentStats(perf.student_id);
                  return (
                    <div 
                      key={perf.id} 
                      className="border-0 rounded-2xl p-4 backdrop-blur-xl bg-white/80 hover:bg-white/95 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer group"
                      onClick={() => {
                        const student = students.find(s => s.id === perf.student_id);
                        if (student) {
                          const studentStats = getStudentStats(student.id);
                          const studentPerfs = performances.filter(p => p.student_id === student.id);
                          showStudentDialog(student, studentStats, studentPerfs);
                        }
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{perf.student_name}</h3>
                            <Badge className={`${
                              perf.grade === 'A+' || perf.grade === 'A' ? 'bg-green-100 text-green-800' :
                              perf.grade === 'B+' || perf.grade === 'B' ? 'bg-blue-100 text-blue-800' :
                              perf.grade === 'C' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {perf.grade}
                            </Badge>
                            {stats && (
                              <span className="text-xs text-gray-500">
                                Avg: {stats.avgPercentage}% ({stats.avgGrade})
                              </span>
                            )}
                          </div>
                          <div className="grid md:grid-cols-2 gap-2 text-sm text-gray-600">
                            <p><strong>Roll No:</strong> {perf.roll_no}</p>
                            <p><strong>Subject:</strong> {perf.subject}</p>
                            <p><strong>Assessment:</strong> {perf.assessment_type}</p>
                            <p><strong>Marks:</strong> {perf.marks_obtained}/{perf.total_marks} ({perf.percentage}%)</p>
                            <p><strong>Date:</strong> {perf.assessment_date}</p>
                            <p><strong>Batch:</strong> {batches.find(b => b.batch_id === perf.batch_id)?.batch_name}</p>
                          </div>
                          {perf.remarks && <p className="text-sm text-gray-500 mt-2 italic">{perf.remarks}</p>}
                        </div>
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button variant="outline" size="icon" onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(perf);
                          }}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="icon" onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(perf.id);
                          }}>
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ManageStudentEmailsModal 
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        students={students}
        onUpdate={loadData}
      />

      {/* Enhanced Student Summary Dialog with Charts */}
      {studentDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4" onClick={() => setStudentDialog(null)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-8 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-4xl font-bold mb-3">{studentDialog.student.name}</h2>
                  <div className="flex gap-4 text-blue-100">
                    <span className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Roll: {studentDialog.student.roll_no}</span>
                    {studentDialog.student.prn && <span>• PRN: {studentDialog.student.prn}</span>}
                    {studentDialog.student.email && <span>• {studentDialog.student.email}</span>}
                  </div>
                </div>
                <button onClick={() => setStudentDialog(null)} className="text-white hover:bg-white/20 rounded-full p-3 transition-all">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-8">
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-8">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="attendance">Attendance</TabsTrigger>
                  <TabsTrigger value="performance">Performance</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-6">
                  {/* Export Button */}
                  <div className="flex justify-end mb-4">
                    <Button 
                      onClick={() => exportStudentPDF(studentDialog)}
                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Export Full Report (PDF)
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-xl">
                      <CardContent className="p-6">
                        <Award className="w-10 h-10 mb-3 opacity-80" />
                        <div className="text-3xl font-bold">{studentDialog.stats?.avgGrade || 'N/A'}</div>
                        <div className="text-green-100">Avg Grade</div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-xl">
                      <CardContent className="p-6">
                        <TrendingUp className="w-10 h-10 mb-3 opacity-80" />
                        <div className="text-3xl font-bold">{studentDialog.stats?.avgPercentage || 0}%</div>
                        <div className="text-blue-100">Avg Score</div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-xl">
                      <CardContent className="p-6">
                        <BarChart3 className="w-10 h-10 mb-3 opacity-80" />
                        <div className="text-3xl font-bold">{studentDialog.stats?.totalAssessments || 0}</div>
                        <div className="text-purple-100">Assessments</div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0 shadow-xl">
                      <CardContent className="p-6">
                        <Calendar className="w-10 h-10 mb-3 opacity-80" />
                        <div className="text-3xl font-bold">{(() => {
                          const totalSessions = studentDialog.sessions?.length || 0;
                          const presentCount = studentDialog.attendance?.filter(a => a.is_present).length || 0;
                          return totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;
                        })()}%</div>
                        <div className="text-orange-100">Attendance</div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Profile Details */}
                  <Card className="bg-gradient-to-br from-gray-50 to-blue-50">
                    <CardHeader>
                      <CardTitle>Student Profile</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-gray-600">Batch</Label>
                        <p className="font-semibold">{batches.find(b => b.batch_id === studentDialog.student.batch_id)?.batch_name || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-gray-600">College</Label>
                        <p className="font-semibold">{studentDialog.student.college_name || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-gray-600">Year</Label>
                        <p className="font-semibold">{studentDialog.student.year || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-gray-600">Branch</Label>
                        <p className="font-semibold">{studentDialog.student.branch || 'N/A'}</p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Attendance Tab */}
                <TabsContent value="attendance" className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="bg-gradient-to-br from-blue-100 to-blue-200">
                      <CardContent className="p-6 text-center">
                        <BookOpen className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                        <div className="text-2xl font-bold text-blue-900">{studentDialog.sessions?.length || 0}</div>
                        <div className="text-sm text-blue-700">Total Sessions</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-green-100 to-green-200">
                      <CardContent className="p-6 text-center">
                        <Award className="w-8 h-8 mx-auto mb-2 text-green-600" />
                        <div className="text-2xl font-bold text-green-900">{studentDialog.attendance?.filter(a => a.is_present).length || 0}</div>
                        <div className="text-sm text-green-700">Present</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-red-100 to-red-200">
                      <CardContent className="p-6 text-center">
                        <svg className="w-8 h-8 mx-auto mb-2 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <div className="text-2xl font-bold text-red-900">{studentDialog.attendance?.filter(a => !a.is_present).length || 0}</div>
                        <div className="text-sm text-red-700">Absent</div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Attendance Percentage</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const totalSessions = studentDialog.sessions?.length || 0;
                        const presentCount = studentDialog.attendance?.filter(a => a.is_present).length || 0;
                        const attendancePercent = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;
                        return (
                          <>
                            <div className="w-full bg-gray-200 rounded-full h-8">
                              <div 
                                className="bg-gradient-to-r from-blue-500 to-green-500 h-8 rounded-full flex items-center justify-center text-white font-bold transition-all duration-1000"
                                style={{ width: `${attendancePercent}%` }}
                              >
                                {attendancePercent}%
                              </div>
                            </div>
                            <p className="text-center mt-4 text-gray-600">
                              {attendancePercent >= 75 ? '✅ Good Standing' : '⚠️ Below 75% - Needs Improvement'}
                            </p>
                          </>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Performance Tab with Charts */}
                <TabsContent value="performance" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Performance Trend */}
                    <Card>
                      <CardHeader className="bg-gradient-to-r from-purple-100 to-pink-100">
                        <CardTitle>Performance Trend</CardTitle>
                      </CardHeader>
                      <CardContent className="p-6">
                        <ResponsiveContainer width="100%" height={250}>
                          <LineChart data={studentDialog.perfs.slice(-8).map(p => ({
                            subject: p.subject.substring(0, 10),
                            percentage: p.percentage
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="subject" angle={-45} textAnchor="end" height={80} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="percentage" stroke="#8b5cf6" strokeWidth={3} name="Score %" />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Subject-wise Performance */}
                    <Card>
                      <CardHeader className="bg-gradient-to-r from-blue-100 to-indigo-100">
                        <CardTitle>Subject-wise Average</CardTitle>
                      </CardHeader>
                      <CardContent className="p-6">
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={(() => {
                            const subjectPerformance = studentDialog.perfs.reduce((acc, p) => {
                              if (!acc[p.subject]) {
                                acc[p.subject] = { subject: p.subject, total: 0, count: 0 };
                              }
                              acc[p.subject].total += p.percentage;
                              acc[p.subject].count += 1;
                              return acc;
                            }, {});
                            return Object.values(subjectPerformance).map(s => ({
                              subject: s.subject.substring(0, 12),
                              avg: Math.round(s.total / s.count)
                            }));
                          })()}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="subject" angle={-45} textAnchor="end" height={80} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="avg" fill="#3b82f6" name="Avg %" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* History Tab */}
                <TabsContent value="history" className="space-y-4">
                  {/* Violations & Issues Section */}
                  <Card className="bg-gradient-to-r from-red-50 to-orange-50 border-red-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-red-800">
                        <AlertTriangle className="w-5 h-5" />
                        Violations & Issues
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {(() => {
                        const totalSessions = studentDialog.sessions?.length || 0;
                        const presentCount = studentDialog.attendance?.filter(a => a.is_present).length || 0;
                        const attendancePercent = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;
                        return (
                          <>
                            {attendancePercent < 75 && (
                              <div className="bg-red-100 border border-red-300 rounded-lg p-3">
                                <p className="text-red-900 font-semibold">⚠️ Low Attendance Warning</p>
                                <p className="text-red-700 text-sm">Current attendance: {attendancePercent}% (Below 75% threshold)</p>
                              </div>
                            )}
                            {studentDialog.complaints?.length > 0 && (
                              <div className="bg-orange-100 border border-orange-300 rounded-lg p-3">
                                <p className="text-orange-900 font-semibold">📋 Complaints Filed: {studentDialog.complaints.length}</p>
                                {studentDialog.complaints.slice(0, 3).map(c => (
                                  <p key={c.id} className="text-orange-700 text-sm mt-1">• {c.title} ({c.status})</p>
                                ))}
                              </div>
                            )}
                            {studentDialog.assignments && studentDialog.assignments.filter(a => a.is_late).length > 0 && (
                              <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-3">
                                <p className="text-yellow-900 font-semibold">⏰ Late Submissions: {studentDialog.assignments.filter(a => a.is_late).length}</p>
                              </div>
                            )}
                            {studentDialog.feedback?.length > 0 && (
                              <div className="bg-blue-100 border border-blue-300 rounded-lg p-3">
                                <p className="text-blue-900 font-semibold">💬 Feedback Submitted: {studentDialog.feedback.length}</p>
                              </div>
                            )}
                            {attendancePercent >= 75 && (!studentDialog.complaints || studentDialog.complaints.length === 0) && (
                              <div className="bg-green-100 border border-green-300 rounded-lg p-3">
                                <p className="text-green-900 font-semibold">✅ No violations or issues recorded</p>
                                <p className="text-green-700 text-sm">Student is in good standing</p>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </CardContent>
                  </Card>

                  {/* Assignment Activity */}
                  {studentDialog.assignments?.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="w-5 h-5" />
                          Assignment Activity
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {studentDialog.assignments.slice(0, 5).map(a => (
                            <div key={a.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                              <div>
                                <p className="font-semibold text-sm">{a.assignment_id}</p>
                                <p className="text-xs text-gray-600">{a.status}</p>
                              </div>
                              {a.is_late && <Badge className="bg-red-500 text-white">Late</Badge>}
                              {a.marks_obtained && <Badge className="bg-green-500 text-white">{a.marks_obtained} marks</Badge>}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <h3 className="text-xl font-bold">Assessment History</h3>
                  {studentDialog.perfs.length === 0 ? (
                    <p className="text-center text-gray-500 py-12">No assessment records found</p>
                  ) : (
                    studentDialog.perfs.map(perf => (
                      <div key={perf.id} className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-5 border border-gray-200 hover:shadow-lg transition-all">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <span className="font-bold text-lg">{perf.subject}</span>
                              <Badge className={`${
                                perf.grade === 'A+' || perf.grade === 'A' ? 'bg-green-500 text-white' :
                                perf.grade === 'B+' || perf.grade === 'B' ? 'bg-blue-500 text-white' :
                                perf.grade === 'C' ? 'bg-yellow-500 text-white' :
                                'bg-red-500 text-white'
                              } text-lg px-3 py-1`}>
                                {perf.grade}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm text-gray-700">
                              <span><strong>Type:</strong> {perf.assessment_type}</span>
                              <span><strong>Score:</strong> {perf.marks_obtained}/{perf.total_marks} ({perf.percentage}%)</span>
                              {perf.semester && <span><strong>Semester:</strong> {perf.semester}</span>}
                              {perf.remarks && <span className="col-span-2 italic text-gray-600">{perf.remarks}</span>}
                            </div>
                          </div>
                          <span className="text-sm text-gray-500 bg-white px-3 py-1 rounded-lg">{perf.assessment_date}</span>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}