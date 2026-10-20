import React, { useState, useEffect } from "react";
import { StudentPerformance, Student, Batch } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Plus, Edit, Trash2, Award, FileText, Mail, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import ManageStudentEmailsModal from "../components/students/ManageStudentEmailsModal";
import StudentDetailModal from "../components/student/StudentDetailModal";

const examTypes = ["Internal Test 1", "Internal Test 2", "Internal Test 3", "Mid Semester", "End Semester", "Assignment", "Project", "Quiz"];

export default function StudentPerformancePage() {
  const [performances, setPerformances] = useState([]);
  const [students, setStudents] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState(null);
  const [formData, setFormData] = useState({
    student_id: "",
    student_name: "",
    roll_no: "",
    batch_id: "",
    subject_name: "",
    exam_type: "Internal Test 1",
    marks_obtained: "",
    total_marks: "",
    percentage: 0,
    grade: "",
    exam_date: "",
    semester: "",
    remarks: ""
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedBatch) {
      loadStudentsForBatch(selectedBatch);
    }
  }, [selectedBatch]);

  useEffect(() => {
    if (selectedStudent) {
      loadPerformanceForStudent(selectedStudent);
    }
  }, [selectedStudent]);

  const loadData = async () => {
    const batchData = await Batch.list();
    setBatches(batchData);
  };

  const loadStudentsForBatch = async (batchId) => {
    const studentData = await Student.filter({ batch_id: batchId });
    setStudents(studentData);
    setSelectedStudent("");
    setPerformances([]);
  };

  const loadPerformanceForStudent = async (studentId) => {
    const data = await StudentPerformance.filter({ student_id: studentId });
    setPerformances(data.sort((a, b) => new Date(b.exam_date) - new Date(a.exam_date)));
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

  const handleStudentChange = (studentId) => {
    const student = students.find(s => s.id === studentId);
    if (student) {
      setFormData({
        ...formData,
        student_id: studentId,
        student_name: student.name,
        roll_no: student.roll_no,
        batch_id: student.batch_id
      });
    }
  };

  const handleMarksChange = (obtained, total) => {
    const percentage = total > 0 ? (obtained / total) * 100 : 0;
    const grade = calculateGrade(percentage);
    setFormData({
      ...formData,
      marks_obtained: obtained,
      total_marks: total,
      percentage: percentage.toFixed(2),
      grade: grade
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingEntry) {
      await StudentPerformance.update(editingEntry.id, formData);
    } else {
      await StudentPerformance.create(formData);
    }
    setIsDialogOpen(false);
    resetForm();
    if (selectedStudent) loadPerformanceForStudent(selectedStudent);
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setFormData(entry);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this record?")) {
      await StudentPerformance.delete(id);
      if (selectedStudent) loadPerformanceForStudent(selectedStudent);
    }
  };

  const resetForm = () => {
    setEditingEntry(null);
    setFormData({
      student_id: "",
      student_name: "",
      roll_no: "",
      batch_id: "",
      subject_name: "",
      exam_type: "Internal Test 1",
      marks_obtained: "",
      total_marks: "",
      percentage: 0,
      grade: "",
      exam_date: "",
      semester: "",
      remarks: ""
    });
  };

  const avgPerformance = performances.length > 0
    ? (performances.reduce((sum, p) => sum + parseFloat(p.percentage || 0), 0) / performances.length).toFixed(2)
    : 0;

  const getGradeColor = (grade) => {
    if (["A+", "A"].includes(grade)) return "bg-green-100 text-green-800";
    if (["B+", "B"].includes(grade)) return "bg-blue-100 text-blue-800";
    if (["C"].includes(grade)) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -right-20 w-96 h-96 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        <div className="backdrop-blur-xl bg-white/60 rounded-3xl border border-white/50 shadow-2xl p-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-indigo-600" />
                Student Performance Tracking
              </h1>
              <p className="text-gray-700 mt-1">Track and manage student academic performance</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setShowEmailModal(true)} variant="outline" className="gap-2">
                <Mail className="w-4 h-4" />
                Manage Emails
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Performance
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingEntry ? "Edit Performance" : "Add Performance Record"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Student *</Label>
                  <Select value={formData.student_id} onValueChange={handleStudentChange} required>
                    <SelectTrigger><SelectValue placeholder="Select student"/></SelectTrigger>
                    <SelectContent>
                      {students.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.roll_no} - {s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Subject Name *</Label>
                    <Input value={formData.subject_name} onChange={(e) => setFormData({...formData, subject_name: e.target.value})} required />
                  </div>
                  <div>
                    <Label>Exam Type *</Label>
                    <Select value={formData.exam_type} onValueChange={(v) => setFormData({...formData, exam_type: v})} required>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        {examTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Marks Obtained *</Label>
                    <Input type="number" value={formData.marks_obtained} onChange={(e) => handleMarksChange(parseFloat(e.target.value), formData.total_marks)} required />
                  </div>
                  <div>
                    <Label>Total Marks *</Label>
                    <Input type="number" value={formData.total_marks} onChange={(e) => handleMarksChange(formData.marks_obtained, parseFloat(e.target.value))} required />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Percentage</Label>
                    <Input value={formData.percentage} disabled className="bg-gray-50" />
                  </div>
                  <div>
                    <Label>Grade</Label>
                    <Input value={formData.grade} disabled className="bg-gray-50" />
                  </div>
                  <div>
                    <Label>Exam Date</Label>
                    <Input type="date" value={formData.exam_date} onChange={(e) => setFormData({...formData, exam_date: e.target.value})} />
                  </div>
                </div>
                <div>
                  <Label>Semester</Label>
                  <Input value={formData.semester} onChange={(e) => setFormData({...formData, semester: e.target.value})} />
                </div>
                <div>
                  <Label>Remarks</Label>
                  <Input value={formData.remarks} onChange={(e) => setFormData({...formData, remarks: e.target.value})} />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" className="bg-blue-600">{editingEntry ? "Update" : "Add"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="backdrop-blur-xl bg-white/70 border-white/50 shadow-xl">
            <CardHeader className="bg-gray-50">
              <CardTitle>Select Batch</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                <SelectTrigger><SelectValue placeholder="Select a batch"/></SelectTrigger>
                <SelectContent>
                  {batches.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.batch_name} - {b.college_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedBatch && (
            <Card className="backdrop-blur-xl bg-white/70 border-white/50 shadow-xl">
              <CardHeader className="bg-gray-50">
                <CardTitle>Select Student</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                  <SelectTrigger><SelectValue placeholder="Select a student"/></SelectTrigger>
                  <SelectContent>
                    {students.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.roll_no} - {s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}
        </div>

        {selectedStudent && (
          <>
            <Card className="backdrop-blur-xl bg-gradient-to-r from-blue-50/80 to-purple-50/80 border-white/50 shadow-xl">
              <CardContent className="pt-6">
                <div className="flex items-center justify-around">
                  <div className="text-center">
                    <FileText className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Total Records</p>
                    <p className="text-3xl font-bold text-gray-900">{performances.length}</p>
                  </div>
                  <div className="text-center">
                    <Award className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Average Performance</p>
                    <p className="text-3xl font-bold text-gray-900">{avgPerformance}%</p>
                  </div>
                  <div className="text-center">
                    <TrendingUp className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Overall Grade</p>
                    <p className="text-3xl font-bold text-gray-900">{calculateGrade(avgPerformance)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="backdrop-blur-xl bg-white/70 border-white/50 shadow-xl">
              <CardHeader className="bg-white/50">
                <CardTitle>Performance Records</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {performances.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No performance records found for this student.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="mb-4">
                      <Button 
                        onClick={() => {
                          const student = students.find(s => s.id === selectedStudent);
                          setSelectedStudentForDetail(student);
                        }}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Detailed Analytics
                      </Button>
                    </div>
                    {performances.map(perf => (
                     <div key={perf.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                       <div className="flex-1 grid grid-cols-5 gap-4">
                         <div>
                           <p className="font-semibold">{perf.subject_name}</p>
                           <p className="text-sm text-gray-500">{perf.exam_type}</p>
                         </div>
                         <div className="text-center">
                           <p className="text-sm text-gray-600">Marks</p>
                           <p className="font-semibold">{perf.marks_obtained}/{perf.total_marks}</p>
                         </div>
                         <div className="text-center">
                           <p className="text-sm text-gray-600">Percentage</p>
                           <p className="font-semibold">{perf.percentage}%</p>
                         </div>
                         <div className="text-center">
                           <Badge className={getGradeColor(perf.grade)}>{perf.grade}</Badge>
                         </div>
                         <div>
                           <p className="text-sm text-gray-600">Date</p>
                           <p className="text-sm">{perf.exam_date || "N/A"}</p>
                         </div>
                       </div>
                       <div className="flex gap-2">
                         <Button size="sm" variant="ghost" onClick={() => handleEdit(perf)}><Edit className="w-4 h-4" /></Button>
                         <Button size="sm" variant="ghost" onClick={() => handleDelete(perf.id)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                       </div>
                     </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <ManageStudentEmailsModal 
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        students={students}
        onUpdate={loadData}
      />

      <StudentDetailModal
        isOpen={!!selectedStudentForDetail}
        onClose={() => setSelectedStudentForDetail(null)}
        student={selectedStudentForDetail}
      />

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
      `}</style>
    </div>
  );
}