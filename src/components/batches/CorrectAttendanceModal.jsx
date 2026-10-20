import React, { useState, useRef } from "react";
import { AttendanceRecord, User, Session } from "@/entities/all";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, CheckCircle2, AlertTriangle, Loader2, ScanLine } from "lucide-react";
import { format } from "date-fns";

export default function CorrectAttendanceModal({ isOpen, onClose, onSuccess, batch, students, sessions }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [corrections, setCorrections] = useState([]);
  const [newSessions, setNewSessions] = useState([]);
  const [debugInfo, setDebugInfo] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setCorrections([]);
      setNewSessions([]);
      setDebugInfo(null);
    } else {
      alert('Please select a PDF file containing the complete attendance report.');
    }
  };

  const processBulkCorrection = async () => {
    if (!selectedFile) {
      alert("Please select a PDF file first.");
      return;
    }

    setIsProcessing(true);
    setCorrections([]);
    setNewSessions([]);
    setDebugInfo(null);

    try {
      setProcessingStep("📤 Uploading attendance report PDF...");
      
      const { file_url } = await UploadFile({ file: selectedFile });

      setProcessingStep("🔍 Analyzing attendance grid with ultra-precise OCR...");
      
      // Create student PRN reference for the AI
      const studentPRNList = students.map(s => `PRN: ${s.prn} - Name: ${s.name}`).join('\n');
      
      const precisionOCRSchema = {
        type: "object",
        properties: {
          extraction_metadata: {
            type: "object",
            description: "Quality check information",
            properties: {
              total_students_found: { type: "number", description: "Number of student rows identified" },
              total_date_columns_found: { type: "number", description: "Number of date columns identified" },
              extraction_confidence: { type: "string", description: "HIGH/MEDIUM/LOW confidence level" }
            }
          },
          date_columns: {
            type: "array",
            description: "Extract EXACTLY the date headers from the table. Look for dates like '18/7', '25/7', '01/8', '08/8', etc. in the column headers.",
            items: {
              type: "object", 
              properties: {
                raw_date_text: { type: "string", description: "Exact text found in header (e.g., '18/7', '25/7')" },
                column_position: { type: "number", description: "Column number from left (starting at 1)" }
              }
            }
          },
          student_attendance_grid: {
            type: "array",
            description: `Extract attendance for each student row. CRITICAL: For each student, analyze EACH INDIVIDUAL CELL at the intersection of their row and each date column. 

MATCHING RULES:
- Match students by PRN number first, then by name
- Known students in this batch: ${studentPRNList}

PRESENCE DETECTION RULES:
- PRESENT (true): Handwritten signature, name, initials, or clear handwritten text in the cell
- ABSENT (false): Empty cell, "A", "AB", diagonal line through cell, or just ruled lines

EXAMPLES:
- "Gaurav", "गौरव", any signature → PRESENT  
- "AB", empty cell, diagonal line → ABSENT
- "Shinde", handwritten initials → PRESENT
- Just table grid lines → ABSENT`,
            items: {
              type: "object",
              properties: {
                student_prn: { type: "string", description: "PRN number from the row" },
                student_name: { type: "string", description: "Full name from the row" },
                row_number: { type: "number", description: "Row number in the table" },
                attendance_by_column: {
                  type: "array",
                  description: "For each date column, analyze the specific cell and determine presence",
                  items: {
                    type: "object",
                    properties: {
                      column_position: { type: "number", description: "Column number (matches date_columns)" },
                      cell_content_description: { type: "string", description: "What you see in this specific cell" },
                      is_present: { type: "boolean", description: "true if signature/handwriting present, false otherwise" }
                    }
                  }
                }
              },
              required: ["student_prn", "student_name", "attendance_by_column"]
            }
          }
        },
        required: ["date_columns", "student_attendance_grid", "extraction_metadata"]
      };

      const ocrResult = await ExtractDataFromUploadedFile({
        file_url,
        json_schema: precisionOCRSchema
      });

      if (ocrResult.status !== "success" || !ocrResult.output?.student_attendance_grid) {
        throw new Error(`OCR extraction failed: ${ocrResult.details || 'Unknown error'}`);
      }

      const ocrData = ocrResult.output;
      setDebugInfo(ocrData.extraction_metadata);

      setProcessingStep("🔄 Processing extracted data and matching with existing records...");

      // Process dates and create date mapping
      const dateMapping = {};
      const extractedDates = [];
      
      ocrData.date_columns.forEach(dateCol => {
        try {
          // Parse dates like "18/7", "25/7" etc.
          let dateStr = dateCol.raw_date_text.trim();
          let parsedDate;
          
          if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 2) {
              const day = parseInt(parts[0]);
              const month = parseInt(parts[1]);
              const currentYear = new Date().getFullYear();
              parsedDate = new Date(currentYear, month - 1, day);
            }
          }
          
          if (parsedDate && !isNaN(parsedDate)) {
            const formattedDate = format(parsedDate, 'yyyy-MM-dd');
            dateMapping[dateCol.column_position] = formattedDate;
            extractedDates.push(formattedDate);
          }
        } catch (error) {
          console.error(`Failed to parse date: ${dateCol.raw_date_text}`, error);
        }
      });

      // Match students and process attendance
      const corrections = [];
      const sessionsToCreate = [];
      
      for (const ocrStudent of ocrData.student_attendance_grid) {
        // Find matching student by PRN first, then by name
        let matchingStudent = students.find(s => s.prn === ocrStudent.student_prn);
        if (!matchingStudent) {
          matchingStudent = students.find(s => 
            s.name.toLowerCase().includes(ocrStudent.student_name.toLowerCase()) ||
            ocrStudent.student_name.toLowerCase().includes(s.name.toLowerCase())
          );
        }

        if (!matchingStudent) {
          console.warn(`No matching student found for PRN: ${ocrStudent.student_prn}, Name: ${ocrStudent.student_name}`);
          continue;
        }

        // Process each attendance entry for this student
        for (const attendance of ocrStudent.attendance_by_column) {
          const sessionDate = dateMapping[attendance.column_position];
          if (!sessionDate) continue;

          // Find or create session for this date
          let matchingSession = sessions.find(s => 
            format(new Date(s.session_date), 'yyyy-MM-dd') === sessionDate
          );

          if (!matchingSession) {
            // Create new session
            const newSessionData = {
              session_name: `Training Session`,
              topic_taught: "Campus Recruitment Training", 
              faculty_name: "Training Faculty",
              faculty_email: "faculty@training.com",
              session_date: sessionDate,
              session_time: "10:00",
              duration: "2 Hours",
              college_name: batch.college_name || "College",
              year: batch.year || "Second Year",
              branch: batch.branch || "Electronics & Telecommunication",
              division: batch.division || "B",
              batch_id: batch.batch_id,
              batch_description: batch.batch_description || "Training Batch",
              status: "completed",
              total_students: students.length,
              present_count: 0
            };
            sessionsToCreate.push({ date: sessionDate, data: newSessionData });
          }

          // Record correction needed
          corrections.push({
            student: matchingStudent,
            date: sessionDate,
            shouldBePresent: attendance.is_present,
            cellDescription: attendance.cell_content_description,
            currentStatus: null // Will be determined when applying corrections
          });
        }
      }

      setCorrections(corrections);
      setNewSessions(sessionsToCreate);

      setProcessingStep(`✅ Analysis complete! Found ${corrections.length} attendance records across ${extractedDates.length} dates.`);

    } catch (error) {
      console.error("Bulk correction failed:", error);
      setProcessingStep(`❌ Failed: ${error.message}`);
      setCorrections([]);
    }
    
    setIsProcessing(false);
  };

  const applyCorrections = async () => {
    if (corrections.length === 0 && newSessions.length === 0) {
      alert("No corrections to apply.");
      return;
    }

    setIsProcessing(true);
    setProcessingStep("🔧 Applying corrections...");

    try {
      const user = await User.me();

      // Create new sessions first
      const createdSessions = [];
      for (const sessionInfo of newSessions) {
        try {
          const createdSession = await Session.create(sessionInfo.data);
          createdSessions.push({ date: sessionInfo.date, session: createdSession });
          setProcessingStep(`📅 Created session for ${sessionInfo.date}`);
        } catch (error) {
          console.error(`Failed to create session for ${sessionInfo.date}:`, error);
        }
      }

      // Reload sessions to include newly created ones
      const allSessions = await Session.filter({ batch_id: batch.batch_id });

      // Apply attendance corrections
      let correctionCount = 0;
      for (const correction of corrections) {
        try {
          // Find the session for this date
          const matchingSession = allSessions.find(s => 
            format(new Date(s.session_date), 'yyyy-MM-dd') === correction.date
          );

          if (!matchingSession) {
            console.warn(`No session found for date ${correction.date}`);
            continue;
          }

          // Check if attendance record already exists
          const existingRecords = await AttendanceRecord.filter({
            student_id: correction.student.id,
            session_id: matchingSession.id
          });

          if (existingRecords.length > 0) {
            // Update existing record if different
            const existingRecord = existingRecords[0];
            if (existingRecord.is_present !== correction.shouldBePresent) {
              await AttendanceRecord.update(existingRecord.id, {
                is_present: correction.shouldBePresent,
                marked_at: new Date().toISOString(),
                marked_by: user.email
              });
              correctionCount++;
            }
          } else {
            // Create new attendance record
            await AttendanceRecord.create({
              student_id: correction.student.id,
              session_id: matchingSession.id,
              batch_id: batch.batch_id,
              is_present: correction.shouldBePresent,
              marked_at: new Date().toISOString(),
              marked_by: user.email
            });
            correctionCount++;
          }
        } catch (error) {
          console.error(`Failed to apply correction for ${correction.student.name}:`, error);
        }
      }

      setProcessingStep(`✅ Applied ${correctionCount} corrections successfully!`);
      
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);

    } catch (error) {
      console.error("Failed to apply corrections:", error);
      setProcessingStep(`❌ Failed to apply corrections: ${error.message}`);
    }
    
    setIsProcessing(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="w-6 h-6 text-teal-600" />
            📖 Bulk Correct Attendance via PDF OCR
          </DialogTitle>
          <DialogDescription>
            Upload your complete attendance report PDF and the system will automatically correct all attendance records.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* File Upload Section */}
          <div className="space-y-4">
            <h3 className="font-semibold">Step 1: Upload Attendance Report PDF</h3>
            <div
              onDrop={(e) => { e.preventDefault(); handleFileSelect({ target: { files: e.dataTransfer.files } }); }}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-teal-400 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <div className="space-y-4">
                <FileText className="w-12 h-12 mx-auto text-gray-400" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {selectedFile ? selectedFile.name : "Drop your PDF here"}
                  </h3>
                  <p className="text-gray-600">
                    Upload the complete attendance report PDF with all dates and signatures
                  </p>
                </div>
                <Button variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  Browse Files
                </Button>
              </div>
            </div>
          </div>

          {/* Processing Status */}
          {processingStep && (
            <Alert className="border-blue-200 bg-blue-50">
              <Loader2 className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
              <AlertDescription>{processingStep}</AlertDescription>
            </Alert>
          )}

          {/* Debug Information */}
          {debugInfo && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <strong>Extraction Quality:</strong> {debugInfo.extraction_confidence} | 
                <strong> Students Found:</strong> {debugInfo.total_students_found} | 
                <strong> Dates Found:</strong> {debugInfo.total_date_columns_found}
              </AlertDescription>
            </Alert>
          )}

          {/* Preview Corrections */}
          {corrections.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Step 2: Preview Corrections ({corrections.length} changes)</h3>
              <div className="max-h-64 overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Student</th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">OCR Found</th>
                      <th className="px-3 py-2 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {corrections.slice(0, 10).map((correction, index) => (
                      <tr key={index} className="border-t">
                        <td className="px-3 py-2 font-medium">{correction.student.name}</td>
                        <td className="px-3 py-2">{format(new Date(correction.date), 'dd MMM yyyy')}</td>
                        <td className="px-3 py-2 text-xs text-gray-600">{correction.cellDescription}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            correction.shouldBePresent 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            Mark as {correction.shouldBePresent ? 'Present' : 'Absent'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {corrections.length > 10 && (
                  <div className="px-3 py-2 text-center text-gray-500 text-sm">
                    And {corrections.length - 10} more corrections...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* New Sessions */}
          {newSessions.length > 0 && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription>
                <strong>{newSessions.length} new sessions</strong> will be created for dates not found in the system.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          {selectedFile && !isProcessing && corrections.length === 0 && (
            <Button onClick={processBulkCorrection} className="bg-blue-600 hover:bg-blue-700">
              <ScanLine className="w-4 h-4 mr-2" />
              Analyze PDF
            </Button>
          )}
          {corrections.length > 0 && !isProcessing && (
            <Button onClick={applyCorrections} className="bg-teal-600 hover:bg-teal-700">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Apply {corrections.length} Corrections
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}