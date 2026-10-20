import React, { useState, useEffect } from "react";
import { Student, Batch } from "@/entities/all";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Mail, Edit, Save, X, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function StudentRecordsPage() {
  const [students, setStudents] = useState([]);
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [editEmail, setEditEmail] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const batchId = urlParams.get('batch_id');

      const batchData = await api.entities.Batch.get(batchId);
      const studentsData = await Student.filter({ batch_id: batchData.batch_id });
      
      setBatch(batchData);
      setStudents(studentsData.sort((a, b) => (parseInt(a.roll_no) || 0) - (parseInt(b.roll_no) || 0)));
    } catch (error) {
      console.error("Error loading students:", error);
      setMessage({ type: "error", text: "Failed to load students" });
    }
    setLoading(false);
  };

  const startEditEmail = (student) => {
    setEditingStudentId(student.id);
    setEditEmail(student.email || "");
  };

  const saveEmail = async (studentId) => {
    try {
      // Validate email format
      if (editEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail)) {
        setMessage({ type: "error", text: "Invalid email format" });
        return;
      }

      // UPSERT: Update student email
      await Student.update(studentId, { email: editEmail.trim() });
      
      setMessage({ type: "success", text: "Email updated successfully" });
      setEditingStudentId(null);
      await loadStudents();
      
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Error updating email:", error);
      setMessage({ type: "error", text: "Failed to update email" });
    }
  };

  const cancelEdit = () => {
    setEditingStudentId(null);
    setEditEmail("");
  };

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.roll_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.prn && s.prn.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        <Card className="backdrop-blur-xl bg-white/90 border-0 shadow-2xl">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Users className="w-6 h-6" />
                  Student Records - {batch?.batch_name}
                </CardTitle>
                <p className="text-blue-100 text-sm mt-1">
                  {batch?.college_name} • {batch?.year} • {batch?.branch}
                </p>
              </div>
              <Badge className="bg-white text-blue-600 font-bold text-lg px-4 py-2">
                {students.length} Students
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {message && (
              <Alert className={`mb-6 ${message.type === "error" ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
                <AlertDescription className={message.type === "error" ? "text-red-800" : "text-green-800"}>
                  {message.text}
                </AlertDescription>
              </Alert>
            )}

            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder="Search by name, roll no, PRN, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12 text-base"
                />
              </div>
            </div>

            {/* Student Table */}
            <div className="overflow-x-auto border-2 border-blue-200 rounded-xl shadow-lg">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                    <th className="border-2 border-white px-4 py-3 text-left font-bold">Roll No</th>
                    <th className="border-2 border-white px-4 py-3 text-left font-bold">PRN</th>
                    <th className="border-2 border-white px-4 py-3 text-left font-bold">Name</th>
                    <th className="border-2 border-white px-4 py-3 text-left font-bold">Email (Editable)</th>
                    <th className="border-2 border-white px-4 py-3 text-center font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filteredStudents.map((student, idx) => (
                    <tr key={student.id} className={`${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-blue-50 transition-colors`}>
                      <td className="border-2 border-gray-300 px-4 py-3 font-semibold">
                        {student.roll_no}
                      </td>
                      <td className="border-2 border-gray-300 px-4 py-3 text-sm text-gray-600">
                        {student.prn || "—"}
                      </td>
                      <td className="border-2 border-gray-300 px-4 py-3 font-medium">
                        {student.name}
                      </td>
                      <td className="border-2 border-gray-300 px-4 py-3">
                        {editingStudentId === student.id ? (
                          <Input
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            placeholder="student@gmail.com"
                            className="h-9 text-sm"
                            autoFocus
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <span className="text-sm">{student.email || "Not set"}</span>
                          </div>
                        )}
                      </td>
                      <td className="border-2 border-gray-300 px-4 py-3">
                        <div className="flex justify-center gap-2">
                          {editingStudentId === student.id ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => saveEmail(student.id)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Save className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelEdit}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEditEmail(student)}
                              className="hover:bg-blue-100"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredStudents.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>No students found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}