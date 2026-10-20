import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, Loader2, CheckCircle } from "lucide-react";
import { UploadFile, ExtractDataFromUploadedFile } from "@/integrations/Core";
import { Session, AttendanceRecord, User } from "@/entities/all";

export default function UploadAttendanceModal({ isOpen, onClose, onSuccess, batch, students }) {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState(null);
  const [uploadStats, setUploadStats] = useState(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv') || 
                 file.type === 'application/vnd.ms-excel' || file.name.endsWith('.xlsx') ||
                 file.type === 'application/pdf' || file.name.endsWith('.pdf') ||
                 file.type === 'text/html' || file.name.endsWith('.html') || file.name.endsWith('.htm'))) {
      setSelectedFile(file);
      setMessage(null);
    } else {
      setMessage({ type: "error", text: "Please select a valid CSV, Excel, PDF, or HTML file" });
    }
  };

  const parseCSV = (text) => {
    const lines = text.trim().split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) return { headers: [], data: [] };
    
    console.log('📄 Parsing CSV with', lines.length, 'lines');
    
    const parseLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };
    
    // Detect multi-row headers (date row + shift sub-row structure)
    let dateRowIndex = -1;
    let shiftRowIndex = -1;
    let dataStartIndex = 0;
    
    const metadataKeywords = ['SL NO', 'ROLL NO', 'ROLL', 'SERIAL', 'SR', 'PRN', 'STUDENT NAME', 'NAME', 'STUDENT'];
    const shiftKeywords = ['MORNING', 'AFTERNOON', 'EVENING', 'AM', 'PM'];
    
    // Find date row and shift row
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const lineUpper = lines[i].toUpperCase();
      
      const hasMetadata = metadataKeywords.some(keyword => lineUpper.includes(keyword));
      const hasShifts = shiftKeywords.some(keyword => lineUpper.includes(keyword));
      const hasDate = /\d{1,2}\.\d{1,2}\.\d{4}/.test(lineUpper);
      
      if (hasMetadata && hasDate && dateRowIndex === -1) {
        dateRowIndex = i;
        console.log(`✅ Found date header row at line ${i}`);
      }
      
      if (hasShifts && shiftRowIndex === -1) {
        shiftRowIndex = i;
        console.log(`✅ Found shift sub-header row at line ${i}`);
      }
      
      if (dateRowIndex !== -1 && (shiftRowIndex !== -1 || i > dateRowIndex)) {
        dataStartIndex = Math.max(dateRowIndex, shiftRowIndex) + 1;
        break;
      }
    }
    
    if (dateRowIndex === -1) {
      console.log('⚠️ No date row detected, using simple header parsing');
      dateRowIndex = 0;
      dataStartIndex = 1;
    }
    
    // Parse date row and shift row
    const dateRow = parseLine(lines[dateRowIndex]);
    const shiftRow = shiftRowIndex !== -1 ? parseLine(lines[shiftRowIndex]) : [];
    
    console.log('Date row:', dateRow.slice(0, 15));
    console.log('Shift row:', shiftRow.slice(0, 15));
    
    // Build comprehensive headers by combining date + shift
    const headers = [];
    let currentDate = '';
    
    for (let i = 0; i < dateRow.length; i++) {
      const dateCell = (dateRow[i] || '').trim();
      const shiftCell = shiftRow[i] ? shiftRow[i].trim() : '';
      
      // Check if this is a metadata column
      const isMetadataCol = metadataKeywords.some(k => dateCell.toUpperCase().includes(k));
      
      if (isMetadataCol) {
        // Keep metadata columns as-is
        headers.push(dateCell);
      } else {
        // Update current date if this cell contains a date
        if (dateCell && /\d{1,2}\.\d{1,2}\.\d{4}/.test(dateCell)) {
          currentDate = dateCell;
        }
        
        // Build session header: date + shift
        if (currentDate && shiftCell) {
          headers.push(`${currentDate} ${shiftCell}`);
        } else if (currentDate && dateCell && dateCell === currentDate) {
          // Skip duplicate date headers (they span multiple columns)
          continue;
        } else if (dateCell) {
          headers.push(dateCell);
        }
      }
    }
    
    console.log('✅ Built comprehensive headers:', headers.length, 'columns');
    console.log('Final headers:', headers);
    
    // Parse data rows
    const data = [];
    for (let i = dataStartIndex; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      if (values.length < 3 || !values.some(v => v && v.trim())) continue;
      
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      // Only include rows with student names
      let hasName = false;
      for (const key of Object.keys(row)) {
        if (key.toUpperCase().includes('NAME') && row[key] && row[key].trim().length > 2) {
          hasName = true;
          break;
        }
      }
      
      if (hasName) {
        data.push(row);
      }
    }
    
    console.log('✅ CSV Parsed:', {
      dateRowIndex,
      shiftRowIndex,
      dataStartIndex,
      totalHeaders: headers.length,
      totalDataRows: data.length,
      sampleRow: data[0] ? Object.keys(data[0]) : []
    });
    
    return { headers, data };
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage({ type: "error", text: "Please select a file" });
      return;
    }

    setIsProcessing(true);
    setMessage({ type: "info", text: "🔄 Processing file..." });

    try {
      let headers, data;

      // Handle HTML files
      if (selectedFile.type === 'text/html' || selectedFile.name.endsWith('.html') || selectedFile.name.endsWith('.htm')) {
        const reader = new FileReader();
        await new Promise((resolve) => {
          reader.onload = (e) => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(e.target.result, 'text/html');
            const tables = doc.querySelectorAll('table');
            let foundTable = null;
            
            for (const table of tables) {
              const headerRow = table.querySelector('tr');
              if (headerRow && headerRow.textContent.match(/PRN|Student|Roll|Name/i)) {
                foundTable = table;
                break;
              }
            }
            
            if (!foundTable) throw new Error("Could not find attendance table in HTML file");
            
            const rows = Array.from(foundTable.querySelectorAll('tr'));
            headers = Array.from(rows[0].querySelectorAll('th, td')).map(cell => cell.textContent.trim());
            
            data = rows.slice(1).map(row => {
              const cells = Array.from(row.querySelectorAll('td'));
              const rowData = {};
              headers.forEach((header, index) => {
                if (cells[index]) rowData[header] = cells[index].textContent.trim();
              });
              return rowData;
            }).filter(row => Object.values(row).some(val => val && val.length > 0));
            
            resolve();
          };
          reader.readAsText(selectedFile);
        });
      }
      // Handle PDF files
      else if (selectedFile.type === 'application/pdf' || selectedFile.name.endsWith('.pdf')) {
        setMessage({ type: "info", text: "📄 Uploading PDF..." });
        const { file_url } = await UploadFile({ file: selectedFile });
        
        setMessage({ type: "info", text: "🔍 Extracting attendance data..." });
        
        const ocrSchema = {
          type: "object",
          properties: {
            headers: {
              type: "array",
              description: "Extract ALL column headers including PRN, Student Name, and all date columns",
              items: { type: "string" }
            },
            students: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  prn: { type: "string" },
                  name: { type: "string" },
                  attendance_data: { type: "array", items: { type: "string" } }
                },
                required: ["prn", "attendance_data"]
              }
            }
          },
          required: ["headers", "students"]
        };
        
        const ocrResult = await ExtractDataFromUploadedFile({ file_url, json_schema: ocrSchema });
        
        if (ocrResult.status !== "success" || !ocrResult.output?.students || !ocrResult.output?.headers) {
          throw new Error("Failed to extract data from PDF");
        }
        
        headers = ocrResult.output.headers;
        const extractedStudents = ocrResult.output.students;
        
        const dateColumns = headers.filter(h => {
          const upper = h.toUpperCase();
          return !['PRN', 'NAME', 'STUDENT', 'ROLL', 'SL', 'SR'].some(meta => upper.includes(meta));
        });
        
        data = extractedStudents.map(student => {
          const row = { 'PRN': student.prn, 'STUDENT NAME': student.name };
          dateColumns.forEach((dateCol, idx) => {
            row[dateCol] = student.attendance_data[idx] || '';
          });
          return row;
        });
      }
      // Handle CSV files
      else {
        const reader = new FileReader();
        await new Promise((resolve) => {
          reader.onload = (e) => {
            const parsed = parseCSV(e.target.result);
            headers = parsed.headers;
            data = parsed.data;
            resolve();
          };
          reader.readAsText(selectedFile);
        });
      }

      if (!data || data.length === 0) {
        throw new Error("No data found in file");
      }

      setMessage({ type: "info", text: "📊 Analyzing attendance data..." });

      // Identify PRN column
      const prnColumn = headers.find(h => h.toUpperCase().includes('PRN')) || headers[1];
      
      // Identify date columns (anything that's not metadata)
      const metadataKeywords = ['SL NO', 'ROLL', 'PRN', 'NAME', 'STUDENT', 'SR'];
      const dateColumns = headers.filter(h => {
        const upper = h.toUpperCase().trim();
        return h.trim() && !metadataKeywords.some(meta => upper.includes(meta));
      });

      console.log('📅 Found date columns:', dateColumns);

      // Match students by PRN
      const studentMap = {};
      students.forEach(student => {
        if (student.prn) studentMap[student.prn.trim().toUpperCase()] = student;
      });

      // Process attendance data
      const user = await User.me();
      const sessionsCreated = [];
      const recordsCreated = [];
      let matchedStudents = 0;

      for (const dateCol of dateColumns) {
        // Create session for this date/shift
        const sessionData = {
          session_name: `Uploaded: ${dateCol}`,
          topic_taught: `Attendance for ${dateCol}`,
          faculty_name: user.full_name,
          faculty_email: user.email,
          session_date: new Date().toISOString().split('T')[0],
          session_time: "Uploaded",
          duration: "As per schedule",
          status: "completed",
          batch_id: batch.batch_id,
          college_name: batch.college_name,
          year: batch.year,
          branch: batch.branch,
          division: batch.division,
          batch_description: batch.batch_description,
          total_students: students.length
        };

        const session = await Session.create(sessionData);
        sessionsCreated.push(session);

        // Create attendance records in batches to avoid rate limits
        let presentCount = 0;
        const recordsToCreate = [];

        for (const row of data) {
          const prn = row[prnColumn]?.toString().trim().toUpperCase();
          if (!prn) continue;

          const student = studentMap[prn];
          if (!student) continue;

          matchedStudents++;

          const attendanceValue = row[dateCol]?.toString().trim().toUpperCase();
          const isPresent = ['P', 'PRESENT', '✓', '✔', 'Y', 'YES', '1'].includes(attendanceValue);

          if (isPresent) presentCount++;

          recordsToCreate.push({
            student_id: student.id,
            session_id: session.id,
            batch_id: batch.batch_id,
            is_present: isPresent,
            marked_at: new Date().toISOString(),
            marked_by: user.email
          });
        }

        // Batch create with delays to avoid rate limits
        const batchSize = 20;
        for (let i = 0; i < recordsToCreate.length; i += batchSize) {
          const batch = recordsToCreate.slice(i, i + batchSize);
          const created = await AttendanceRecord.bulkCreate(batch);
          recordsCreated.push(...created);

          // Add delay between batches to avoid rate limits
          if (i + batchSize < recordsToCreate.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        // Update session present count
        await Session.update(session.id, { present_count: presentCount });
      }

      setUploadStats({
        sessionsCreated: sessionsCreated.length,
        recordsCreated: recordsCreated.length,
        matchedStudents: new Set(recordsCreated.map(r => r.student_id)).size,
        totalStudents: students.length
      });

      setMessage({ 
        type: "success", 
        text: `✅ Successfully uploaded ${sessionsCreated.length} sessions with ${recordsCreated.length} attendance records!` 
      });

      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 2000);

    } catch (error) {
      console.error("Upload error:", error);
      setMessage({ type: "error", text: `Error: ${error.message}` });
    }

    setIsProcessing(false);
  };

  const handleClose = () => {
    setSelectedFile(null);
    setMessage(null);
    setUploadStats(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Upload className="w-6 h-6 text-blue-600" />
            Upload Attendance File
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {!uploadStats ? (
            <>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.pdf,.html,.htm"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <FileSpreadsheet className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {selectedFile ? selectedFile.name : "Select attendance file"}
                </h3>
                <p className="text-gray-600 text-sm">
                  CSV, Excel, PDF, or HTML with PRN and date columns
                </p>
                <Button className="mt-4">
                  <Upload className="w-4 h-4 mr-2" />
                  Browse Files
                </Button>
              </div>

              {message && (
                <div className={`p-4 rounded-lg ${message.type === 'error' ? 'bg-red-50 text-red-800' : message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-blue-50 text-blue-800'}`}>
                  {message.text}
                </div>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-900 mb-2">📋 File Format Requirements:</h4>
                <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                  <li>File must contain a <strong>PRN</strong> column</li>
                  <li>Date columns should be named with date or shift info (e.g., "08.12.2025 Morning")</li>
                  <li>Attendance marked as <strong>P</strong> (Present) or <strong>A</strong> (Absent)</li>
                  <li>Students matched by PRN number</li>
                  <li>Supports multiple shifts per day (Morning, Afternoon, Evening)</li>
                </ul>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button onClick={handleUpload} disabled={!selectedFile || isProcessing}>
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Attendance
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-green-900 mb-4">Upload Successful!</h3>
              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600">{uploadStats.sessionsCreated}</div>
                  <div className="text-sm text-blue-800">Sessions Created</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-3xl font-bold text-green-600">{uploadStats.recordsCreated}</div>
                  <div className="text-sm text-green-800">Records Created</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-3xl font-bold text-purple-600">{uploadStats.matchedStudents}</div>
                  <div className="text-sm text-purple-800">Students Matched</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="text-3xl font-bold text-orange-600">{uploadStats.totalStudents}</div>
                  <div className="text-sm text-orange-800">Total Students</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}