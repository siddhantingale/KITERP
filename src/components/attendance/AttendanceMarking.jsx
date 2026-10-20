import React, { useState, useEffect, useCallback } from "react";
import { Session, AttendanceRecord, Student, User } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Save, UserCheck, Plus, CheckCircle2, XCircle, ArrowUpDown } from "lucide-react";
import { format } from "date-fns";

export default function AttendanceMarking({ session, students, onComplete, onBack, isLoading }) {
  const [attendance, setAttendance] = useState({});
  const [historicalSessions, setHistoricalSessions] = useState([]);
  const [historicalAttendance, setHistoricalAttendance] = useState({});
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentData, setNewStudentData] = useState({ name: '', prn: '', roll_no: '' });
  const [localStudents, setLocalStudents] = useState([]);

  // Advanced sorting function for roll numbers like A01, A02, B01, and "jdbc 01" etc.
  const sortStudentsByRollNumber = (studentsArray) => {
    return [...studentsArray].sort((a, b) => {
      const rollA = (a.roll_no || "").trim();
      const rollB = (b.roll_no || "").trim();

      // Regex to separate non-digit prefix from the numeric suffix
      const matchA = rollA.match(/^(\D*)(\d+)$/);
      const matchB = rollB.match(/^(\D*)(\d+)$/);

      if (matchA && matchB) {
        const prefixA = matchA[1].trim();
        const numA = parseInt(matchA[2], 10);
        const prefixB = matchB[1].trim();
        const numB = parseInt(matchB[2], 10);

        // Case-insensitive prefix comparison
        const prefixComparison = prefixA.localeCompare(prefixB, undefined, { sensitivity: 'base' });
        if (prefixComparison !== 0) {
          return prefixComparison;
        }

        // Numeric comparison if prefixes are the same
        return numA - numB;
      }

      // Fallback for strings that don't fit the pattern (e.g., "A-10", "B-2")
      // This provides a "natural sort" order
      return rollA.localeCompare(rollB, undefined, { numeric: true, sensitivity: 'base' });
    });
  };

  const handleManualSort = () => {
    const sortedStudents = sortStudentsByRollNumber([...localStudents]);
    setLocalStudents(sortedStudents);
    
    // Show confirmation
    alert(`✅ Students sorted successfully!\nOrder: ${sortedStudents.slice(0, 5).map(s => s.roll_no).join(', ')}${sortedStudents.length > 5 ? '...' : ''}`);
  };

  const loadHistoricalData = useCallback(async () => {
    try {
      if (!session || !session.batch_id) return; // Add check for session and batch_id

      const allSessions = await Session.filter({ 
        batch_id: session.batch_id, 
        status: 'completed' 
      }, '-session_date', 10);
      
      const sortedHistoricalSessions = allSessions.sort((a,b) => new Date(a.session_date) - new Date(b.session_date));
      setHistoricalSessions(sortedHistoricalSessions);
      
      if (allSessions.length > 0) {
        const allAttendanceRecords = await AttendanceRecord.filter({ 
          batch_id: session.batch_id 
        });
        
        const attendanceMap = {};
        allAttendanceRecords.forEach(record => {
          if (!attendanceMap[record.student_id]) {
            attendanceMap[record.student_id] = {};
          }
          // Store the full record for inline editing
          attendanceMap[record.student_id][record.session_id] = record;
        });
        
        setHistoricalAttendance(attendanceMap);
      }
    } catch (error) {
      console.error("Error loading historical data:", error);
    }
  }, [session]); // Add 'session' as a dependency

  useEffect(() => {
    // CRITICAL: Sort students using advanced sorting
    const sortedStudents = sortStudentsByRollNumber([...students]);
    setLocalStudents(sortedStudents);
    
    const loadAndSetInitialAttendance = async () => {
      if (!session || !session.id) {
        // If no session, default all to absent
        const initialAttendance = {};
        sortedStudents.forEach(student => {
          initialAttendance[student.id] = false;
        });
        setAttendance(initialAttendance);
        return;
      }

      // Fetch existing records for this session
      const records = await AttendanceRecord.filter({ session_id: session.id });
      const initialAttendance = {};
      sortedStudents.forEach(student => {
        const record = records.find(r => r.student_id === student.id);
        initialAttendance[student.id] = record ? record.is_present : false;
      });
      setAttendance(initialAttendance);
    };

    loadAndSetInitialAttendance();
    loadHistoricalData();
  }, [students, session, loadHistoricalData]); // Update dependency to loadHistoricalData

  useEffect(() => {
    // Polling for real-time QR updates
    const pollInterval = setInterval(async () => {
      if (!session || !session.id) return;
      
      try {
        const records = await AttendanceRecord.filter({ session_id: session.id });
        
        if (records.length > 0) {
          setAttendance(prevAttendance => {
            const newAttendance = { ...prevAttendance };
            let isUpdated = false;
            records.forEach(record => {
              if (newAttendance[record.student_id] !== record.is_present) {
                newAttendance[record.student_id] = record.is_present;
                isUpdated = true;
              }
            });
            return isUpdated ? newAttendance : prevAttendance;
          });
        }
      } catch (error) {
        console.error("Error polling for attendance updates:", error);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval); // Cleanup on unmount
  }, [session]);


  const handleTogglePastAttendance = async (student_id, session_id) => {
    const attendanceRecord = historicalAttendance[student_id]?.[session_id];
    const newStatus = attendanceRecord ? !attendanceRecord.is_present : true; // Default to Present if no record exists

    try {
      let updatedRecord;
      if (attendanceRecord) {
        // Update existing record
        updatedRecord = await AttendanceRecord.update(attendanceRecord.id, { is_present: newStatus });
      } else {
        // Create new record if one doesn't exist
        const user = await User.me();
        const historicalSession = historicalSessions.find(s => s.id === session_id);
        if (!historicalSession) {
          throw new Error("Historical session not found for creating attendance record.");
        }
        updatedRecord = await AttendanceRecord.create({
          student_id,
          session_id,
          batch_id: historicalSession.batch_id,
          is_present: newStatus,
          marked_at: new Date().toISOString(),
          marked_by: user.email
        });
      }
      
      // Update local state for immediate feedback
      setHistoricalAttendance(prev => {
        const newStudentAttendance = { ...(prev[student_id] || {}) };
        newStudentAttendance[session_id] = updatedRecord;
        return {
          ...prev,
          [student_id]: newStudentAttendance
        };
      });

    } catch(error) {
      console.error("Failed to update past attendance:", error);
      alert("Error updating past attendance. Please try again.");
    }
  };

  const toggleAttendance = (studentId) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  const markAllPresent = () => {
    const allPresentAttendance = {};
    localStudents.forEach(student => {
      allPresentAttendance[student.id] = true;
    });
    setAttendance(allPresentAttendance);
  };

  const markAllAbsent = () => {
    const allAbsentAttendance = {};
    localStudents.forEach(student => {
      allAbsentAttendance[student.id] = false;
    });
    setAttendance(allAbsentAttendance);
  };

  const handleAddStudent = async () => {
    try {
      const studentData = {
        ...newStudentData,
        college_name: session.college_name,
        year: session.year,
        branch: session.branch || session.batch_description,
        division: session.division || "Mixed",
        batch_id: session.batch_id
      };
      
      const newStudent = await Student.create(studentData);
      
      // CRITICAL: Re-sort students after adding new student
      const updatedStudents = sortStudentsByRollNumber([...localStudents, newStudent]);
      setLocalStudents(updatedStudents);
      setAttendance(prev => ({ ...prev, [newStudent.id]: false }));
      setNewStudentData({ name: '', prn: '', roll_no: '' });
      setShowAddStudent(false);
    } catch (error) {
      console.error("Error adding student:", error);
      alert("Error adding student. Please try again.");
    }
  };

  const handleSaveAttendance = async () => {
    await onComplete(attendance);
  };

  const presentCount = Object.values(attendance).filter(Boolean).length;
  const absentCount = localStudents.length - presentCount;

  return (
    <div className="bg-gray-50 p-2 sm:p-3 md:p-4 min-h-screen safe-area-inset">
      <div className="max-w-7xl mx-auto space-y-3 sm:space-y-4">
        {/* Session Info Card */}
        <Card className="bg-white border border-gray-200 overflow-hidden">
          <CardHeader className="bg-blue-600 text-white px-3 py-3 sm:px-4 sm:py-4">
            <CardTitle className="text-base sm:text-lg md:text-xl flex items-center gap-2 sm:gap-3">
              <UserCheck className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
              📋 Mark Attendance
            </CardTitle>
            <div className="mt-2 sm:mt-3 text-xs sm:text-sm space-y-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                <p className="truncate"><strong>📖 Session:</strong> {session.session_name}</p>
                <p><strong>📅 Date:</strong> {format(new Date(session.session_date), "dd MMM yyyy")}</p>
                <p className="truncate"><strong>🎯 Topic:</strong> {session.topic_taught}</p>
                <p className="truncate"><strong>👨‍🏫 Faculty:</strong> {session.faculty_name}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4">
            {/* Stats Badges - Responsive */}
            <div className="flex flex-wrap gap-2 sm:gap-4 mb-3 sm:mb-4">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs sm:text-sm px-2 py-1">
                ✅ Present: <strong className="ml-1">{presentCount}</strong>
              </Badge>
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs sm:text-sm px-2 py-1">
                ❌ Absent: <strong className="ml-1">{absentCount}</strong>
              </Badge>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs sm:text-sm px-2 py-1">
                👥 Total: <strong className="ml-1">{localStudents.length}</strong>
              </Badge>
            </div>
            
            {/* Quick Actions - Responsive Grid */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3">
              <Button 
                onClick={markAllPresent}
                className="bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm h-9 sm:h-8 touch-manipulation"
                size="sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
                <span className="truncate">Mark All Present</span>
              </Button>
              <Button 
                onClick={markAllAbsent}
                variant="outline"
                className="border-red-200 text-red-700 hover:bg-red-50 text-xs sm:text-sm h-9 sm:h-8 touch-manipulation"
                size="sm"
              >
                <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
                <span className="truncate">Mark All Absent</span>
              </Button>
              <Button 
                onClick={() => setShowAddStudent(true)}
                variant="outline"
                className="border-blue-200 text-blue-700 hover:bg-blue-50 text-xs sm:text-sm h-9 sm:h-8 touch-manipulation"
                size="sm"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
                <span className="truncate">Add Student</span>
              </Button>
              <Button 
                onClick={handleManualSort}
                variant="outline"
                className="border-purple-200 text-purple-700 hover:bg-purple-50 text-xs sm:text-sm h-9 sm:h-8 touch-manipulation"
                size="sm"
              >
                <ArrowUpDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
                <span className="truncate">Sort Roll No.</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Table */}
        <Card className="bg-white border border-gray-200">
          <CardContent className="p-0">
            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Sr.</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">👤 Student Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">🆔 PRN</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">📝 Roll No.</th>
                    {historicalSessions.map(sess => (
                      <th key={sess.id} className="px-2 py-3 text-center font-semibold text-gray-700 text-xs" title={sess.topic_taught}>
                        {format(new Date(sess.session_date), 'dd/MM')}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center font-semibold text-blue-700 bg-blue-50">
                      📋 Today
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">✅ Mark</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Students are now properly sorted */}
                  {localStudents.map((student, index) => (
                    <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-700">{index + 1}</td>
                      <td className="px-4 py-3 font-semibold text-gray-800">{student.name}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{student.prn}</td>
                      <td className="px-4 py-3 text-gray-600 font-bold">{student.roll_no}</td>
                      {historicalSessions.map(sess => {
                        const isPresent = historicalAttendance[student.id]?.[sess.id]?.is_present;
                        return (
                          <td 
                            key={sess.id} 
                            className="px-2 py-3 text-center cursor-pointer hover:bg-gray-200"
                            onClick={() => handleTogglePastAttendance(student.id, sess.id)}
                            title="Click to toggle status"
                          >
                            {isPresent ? (
                              <span className="text-green-600 font-bold">P</span>
                            ) : (
                              <span className="text-red-600 font-bold">A</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center bg-blue-50">
                        <Badge className={attendance[student.id] ? "bg-green-500 text-white" : "bg-red-500 text-white"}>
                          {attendance[student.id] ? 'P' : 'A'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Switch
                          checked={attendance[student.id] || false}
                          onCheckedChange={() => toggleAttendance(student.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View - Also properly sorted */}
            <div className="md:hidden space-y-2 sm:space-y-3 p-2 sm:p-4">
              {localStudents.map((student) => (
                <Card key={student.id} className={`border-2 transition-all duration-200 ${
                  attendance[student.id] ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                }`}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 text-sm sm:text-base truncate">👤 {student.name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          🆔 PRN: {student.prn} | 📝 Roll: <strong>{student.roll_no}</strong>
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 sm:mt-2">
                          <Badge className={`text-xs ${attendance[student.id] ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                            {attendance[student.id] ? '✅ Present' : '❌ Absent'}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <Switch
                          checked={attendance[student.id] || false}
                          onCheckedChange={() => toggleAttendance(student.id)}
                          className="data-[state=checked]:bg-green-600 touch-manipulation"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons - Sticky on mobile for better UX */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 pt-2 sm:pt-4 sticky bottom-0 bg-gray-50 pb-2 sm:pb-0 sm:static">
          <Button variant="outline" onClick={onBack} className="w-full sm:flex-1 h-11 sm:h-12 text-sm sm:text-base touch-manipulation">
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
            🔙 Back to Sessions
          </Button>
          <Button 
            onClick={handleSaveAttendance}
            disabled={isLoading}
            className="w-full sm:flex-1 h-11 sm:h-12 text-sm sm:text-base bg-green-600 hover:bg-green-700 touch-manipulation"
          >
            <Save className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
            {isLoading ? "Saving..." : "💾 Save & Generate Report"}
          </Button>
        </div>
      </div>

      {/* Add Student Dialog */}
      <Dialog open={showAddStudent} onOpenChange={setShowAddStudent}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>👤 Add New Student</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Student Name *</label>
              <Input
                value={newStudentData.name}
                onChange={(e) => setNewStudentData({...newStudentData, name: e.target.value})}
                placeholder="Enter student name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">PRN *</label>
              <Input
                value={newStudentData.prn}
                onChange={(e) => setNewStudentData({...newStudentData, prn: e.target.value})}
                placeholder="Enter PRN"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Roll Number *</label>
              <Input
                value={newStudentData.roll_no}
                onChange={(e) => setNewStudentData({...newStudentData, roll_no: e.target.value})}
                placeholder='Enter roll number (e.g., A01, "jdbc 01")'
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddStudent(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddStudent}
              disabled={!newStudentData.name || !newStudentData.roll_no}
              className="bg-blue-600 hover:bg-blue-700"
            >
              ➕ Add Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}