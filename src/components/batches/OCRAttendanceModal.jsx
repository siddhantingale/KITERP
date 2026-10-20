
import React, { useState, useRef } from "react";
import { Session, AttendanceRecord, User } from "@/entities/all";
import { UploadFile, ExtractDataFromUploadedFile } from "@/integrations/Core";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Camera, FileText, CheckCircle2, Loader2, Info } from "lucide-react";
import { format } from "date-fns";

export default function OCRAttendanceModal({ isOpen, onClose, onSuccess, batch, students }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [sessionDate, setSessionDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [sessionTime, setSessionTime] = useState("09:00");
  const [topic, setTopic] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [matchResults, setMatchResults] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && (file.type === 'application/pdf' || file.type.includes('image'))) {
      setSelectedFile(file);
      setMatchResults(null);
    } else {
      alert('Please select a PDF or image file containing the signed attendance sheet.');
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && (file.type === 'application/pdf' || file.type.includes('image'))) {
      setSelectedFile(file);
      setMatchResults(null);
    }
  };

  const processOCRAttendance = async () => {
    if (!selectedFile || !sessionDate || !sessionTime) {
      alert("Please provide an attendance sheet PDF, date, and time.");
      return;
    }

    setIsProcessing(true);
    try {
      // Step 1: Upload file
      setProcessingStep("Uploading attendance sheet PDF...");
      const { file_url } = await UploadFile({ file: selectedFile });

      // Step 2: Extract data using SIGNATURE-FOCUSED OCR
      setProcessingStep("Analyzing signatures with advanced OCR...");
      const ocrSchema = {
        type: "object",
        properties: {
          attendance_records: {
            type: "array",
            description: "From the provided attendance sheet (likely a PDF), extract each student's attendance record. Identify students by name, PRN, or roll number.",
            items: {
              type: "object",
              properties: {
                name: { 
                  type: "string", 
                  description: "Student's full name as written on the sheet." 
                },
                prn: { 
                  type: "string", 
                  description: "Student's PRN or registration number, if available." 
                },
                roll_no: { 
                  type: "string", 
                  description: "Student's roll number or seat number." 
                },
                is_present: {
                  type: "boolean",
                  description: "CRITICAL: Determine if the student is present. A student is present ONLY if there is a handwritten signature in their corresponding row. A checkmark, 'P', or any other mark does not count as present. If the signature box is empty or has anything other than a signature, the student is absent (false)."
                }
              },
              required: ["is_present"]
            }
          }
        },
        required: ["attendance_records"]
      };

      const ocrResult = await ExtractDataFromUploadedFile({
        file_url,
        json_schema: ocrSchema
      });

      if (ocrResult.status !== "success" || !ocrResult.output?.attendance_records) {
        throw new Error("Could not extract attendance data from the PDF. Please ensure the file is clear and contains student signatures.");
      }

      // Step 3: Match with existing students
      setProcessingStep("Matching students with database records...");
      const extractedRecords = ocrResult.output.attendance_records;
      
      const sortedStudents = [...students].sort((a, b) => {
        return (a.roll_no || "").localeCompare(b.roll_no || "", undefined, { numeric: true });
      });

      const matches = [];
      const unmatched = [];

      extractedRecords.forEach(record => {
        let matchedStudent = null;
        const studentIdentifier = record.prn || record.roll_no || record.name;

        if (!studentIdentifier) {
          unmatched.push(record); // Add records without identifiable info to unmatched
          return;
        }
        
        // Try matching by PRN, then Roll No, then Name
        if (record.prn) {
          matchedStudent = sortedStudents.find(s => s.prn && s.prn.toLowerCase() === record.prn.toLowerCase());
        }
        if (!matchedStudent && record.roll_no) {
          matchedStudent = sortedStudents.find(s => s.roll_no && s.roll_no.toLowerCase() === record.roll_no.toLowerCase());
        }
        if (!matchedStudent && record.name) {
          matchedStudent = sortedStudents.find(s => s.name && s.name.toLowerCase() === record.name.toLowerCase().trim());
        }

        if (matchedStudent) {
          matches.push({
            student: matchedStudent,
            is_present: record.is_present || false
          });
        } else {
          unmatched.push(record);
        }
      });

      setMatchResults({ matches, unmatched, total: extractedRecords.length });
      setProcessingStep(`Successfully matched ${matches.length} out of ${extractedRecords.length} students.`);

    } catch (error) {
      console.error("OCR processing error:", error);
      alert(`Error processing attendance sheet: ${error.message}`);
    }
    
    setIsProcessing(false);
  };

  const handleSaveAttendance = async () => {
    if (!matchResults || matchResults.matches.length === 0) {
      alert("No matched students found. Please try again with a clearer image.");
      return;
    }

    setIsProcessing(true);
    try {
      const user = await User.me();

      // Step 1: Create new session
      setProcessingStep("Creating session record...");
      const sessionData = {
        session_name: topic || `OCR Attendance - ${format(new Date(sessionDate), 'dd MMM yyyy')}`,
        college_name: batch.college_name || "OCR Import",
        year: batch.year || "Mixed",
        branch: batch.branch,
        division: batch.division,
        batch_description: batch.batch_description || batch.batch_name,
        faculty_name: user.full_name || "Faculty",
        faculty_email: user.email,
        topic_taught: topic || "OCR Imported Session",
        session_date: sessionDate,
        session_time: sessionTime,
        duration: "1 Hour",
        batch_id: batch.batch_id,
        status: "completed",
        total_students: students.length,
        present_count: matchResults.matches.filter(m => m.is_present).length
      };

      const newSession = await Session.create(sessionData);

      // Step 2: Create attendance records
      setProcessingStep("Creating attendance records...");
      const attendanceRecords = [];

      // Create records for matched students
      matchResults.matches.forEach(match => {
        attendanceRecords.push({
          student_id: match.student.id,
          session_id: newSession.id,
          batch_id: batch.batch_id,
          is_present: match.is_present,
          marked_at: new Date().toISOString(),
          marked_by: user.email
        });
      });

      // Create absent records for unmatched students in the batch
      const matchedStudentIds = new Set(matchResults.matches.map(m => m.student.id));
      students.forEach(student => {
        if (!matchedStudentIds.has(student.id)) {
          attendanceRecords.push({
            student_id: student.id,
            session_id: newSession.id,
            batch_id: batch.batch_id,
            is_present: false, // Mark as absent if not found in attendance sheet
            marked_at: new Date().toISOString(),
            marked_by: user.email
          });
        }
      });

      await AttendanceRecord.bulkCreate(attendanceRecords);

      setProcessingStep("Attendance successfully imported!");
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);

    } catch (error) {
      console.error("Error saving OCR attendance:", error);
      alert(`Error saving attendance: ${error.message}`);
      setIsProcessing(false);
    }
  };

  const resetModal = () => {
    setSelectedFile(null);
    setMatchResults(null);
    setTopic("");
    setProcessingStep("");
    setIsProcessing(false);
    // Optionally reset date/time to current or default
    setSessionDate(format(new Date(), "yyyy-MM-dd"));
    setSessionTime("09:00");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { resetModal(); onClose(); } }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-6 h-6" />
            📸 Advanced OCR Attendance (Signature-Based)
          </DialogTitle>
          <DialogDescription>
            Upload a **PDF** of your signed attendance sheet for <strong>{batch?.batch_name}</strong>. 
            The system will mark students as present if it detects a signature.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              For best results, use a clear, scanned PDF. The AI is trained to look for handwritten signatures to mark attendance.
            </AlertDescription>
          </Alert>

          {/* File Upload Section */}
          <div className="space-y-4">
            <div>
              <Label>📁 Upload Signed Attendance Sheet (PDF Recommended)</Label>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                {selectedFile ? (
                  <div className="space-y-2">
                    <FileText className="w-12 h-12 text-green-500 mx-auto" />
                    <p className="font-medium text-green-700">✅ {selectedFile.name}</p>
                    <p className="text-sm text-gray-500">Click to change file</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                    <div>
                      <p className="font-medium">🖋️ Drop signed PDF here or click to browse</p>
                      <p className="text-sm text-gray-500">Supports: PDF (recommended), JPG, PNG</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Session Details */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="topic">📚 Topic (Optional)</Label>
                <Input
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Java Programming"
                />
              </div>
              <div>
                <Label htmlFor="date">📅 Session Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="time">⏰ Session Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={sessionTime}
                  onChange={(e) => setSessionTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Processing Status */}
          {isProcessing && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <span className="text-blue-800 font-medium">{processingStep}</span>
              </div>
            </div>
          )}

          {/* Match Results */}
          {matchResults && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 mb-2">🎯 Matching Results</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{matchResults.matches.length}</div>
                    <div className="text-green-700">✅ Matched</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{matchResults.unmatched.length}</div>
                    <div className="text-orange-700">❓ Unmatched</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{matchResults.matches.filter(m => m.is_present).length}</div>
                    <div className="text-blue-700">👥 Present</div>
                  </div>
                </div>
              </div>

              {/* Matched Students Preview */}
              {matchResults.matches.length > 0 && (
                <div className="bg-white border rounded-lg p-4 max-h-60 overflow-y-auto">
                  <h4 className="font-semibold mb-3">✅ Matched Students ({matchResults.matches.length})</h4>
                  <div className="space-y-2">
                    {matchResults.matches.slice(0, 10).map((match, index) => (
                      <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{match.student.name}</span>
                          <span className="text-sm text-gray-500">Roll: {match.student.roll_no}</span>
                          <span className="text-sm text-gray-500">PRN: {match.student.prn}</span>
                        </div>
                        <Badge className={match.is_present ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                          {match.is_present ? "Present" : "Absent"}
                        </Badge>
                      </div>
                    ))}
                    {matchResults.matches.length > 10 && (
                      <p className="text-sm text-gray-500 text-center">... and {matchResults.matches.length - 10} more</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetModal(); onClose(); }}>
            Cancel
          </Button>
          
          {!matchResults ? (
            <Button 
              onClick={processOCRAttendance}
              disabled={!selectedFile || isProcessing}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 mr-2" />
                  🔍 Extract Attendance
                </>
              )}
            </Button>
          ) : (
            <Button 
              onClick={handleSaveAttendance}
              disabled={isProcessing || matchResults.matches.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  💾 Save Attendance ({matchResults.matches.length} students)
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
