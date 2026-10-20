import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Batch, Student, Session, AttendanceRecord, User, Faculty } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Users, Calendar, Edit, Trash2, TrendingUp, Download, Clock, Camera, Plus, ScanLine, Upload } from "lucide-react";
import { createPageUrl } from "@/utils";
import { format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import EditStudentModal from "../components/batches/EditStudentModal";
import AddStudentToBatchModal from "../components/batches/AddStudentToBatchModal";
import AddPastSessionModal from "../components/batches/AddPastSessionModal";
import OCRAttendanceModal from "../components/batches/OCRAttendanceModal";
import CorrectAttendanceModal from "../components/batches/CorrectAttendanceModal";
import EditSessionModal from "../components/batches/EditSessionModal";
import UploadAttendanceModal from "../components/batches/UploadAttendanceModal";

export default function BatchDetails() {
  const location = useLocation();
  const navigate = useNavigate();
  const [batch, setBatch] = useState(null);
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [attendanceData, setAttendanceData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [editingStudent, setEditingStudent] = useState(null);
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [isAddSessionModalOpen, setIsAddSessionModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showOCRModal, setShowOCRModal] = useState(false);
  const [isCorrectingModalOpen, setIsCorrectingModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Get batch_id from query parameters
  const batchId = new URLSearchParams(location.search).get("batch_id");

  const loadBatchData = useCallback(async () => {
    if (!batchId) {
      console.error("No batchId found in URL parameters");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      console.log("Loading batch with ID:", batchId);
      const batchData = await Batch.get(batchId);
      setBatch(batchData);

      if (batchData && batchData.batch_id) {
        console.log("Found batch:", batchData.batch_name, "with batch_id:", batchData.batch_id);

        // Fetch related data more robustly using Promise.allSettled
        const results = await Promise.allSettled([
          Student.filter({ batch_id: batchData.batch_id }),
          Session.filter({ batch_id: batchData.batch_id }),
          AttendanceRecord.filter({ batch_id: batchData.batch_id })
        ]);

        const studentResult = results[0];
        const sessionResult = results[1];
        const attendanceResult = results[2];

        if (studentResult.status === 'fulfilled') {
          setStudents(studentResult.value.sort((a, b) => (parseInt(a.roll_no) || 0) - (parseInt(b.roll_no) || 0)));
        } else {
          console.error("Failed to load students:", studentResult.reason);
          setStudents([]); // Set to empty array on failure
        }

        if (sessionResult.status === 'fulfilled') {
          setSessions(sessionResult.value.sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime()));
        } else {
          console.error("Failed to load sessions:", sessionResult.reason);
          setSessions([]); // Set to empty array on failure
        }

        if (attendanceResult.status === 'fulfilled') {
          const newAttendanceData = {};
          attendanceResult.value.forEach(record => {
            if (!newAttendanceData[record.student_id]) {
              newAttendanceData[record.student_id] = {};
            }
            newAttendanceData[record.student_id][record.session_id] = record;
          });
          setAttendanceData(newAttendanceData);
        } else {
          console.error("Failed to load attendance records:", attendanceResult.reason);
          setAttendanceData({}); // Set to empty object on failure
        }

      } else {
         console.warn("Batch data or batch_id is missing or batch not found.", batchData);
         setStudents([]);
         setSessions([]);
         setAttendanceData({});
      }
    } catch (error) {
      console.error("Error loading batch details:", error);
      // Ensure states are reset or handled even if the initial batch.get() fails
      setBatch(null);
      setStudents([]);
      setSessions([]);
      setAttendanceData({});
    }
    setIsLoading(false);
  }, [batchId]);

  useEffect(() => {
    if (batchId) {
      loadBatchData();
    }
  }, [batchId, loadBatchData]);

  const handleToggleAttendance = async (studentId, sessionId) => {
    try {
      const existingRecord = attendanceData[studentId]?.[sessionId];
      const newStatus = existingRecord ? !existingRecord.is_present : true;

      if (existingRecord) {
        await AttendanceRecord.update(existingRecord.id, { is_present: newStatus });
        setAttendanceData(prev => ({
          ...prev,
          [studentId]: {
            ...prev[studentId],
            [sessionId]: { ...existingRecord, is_present: newStatus }
          }
        }));
      } else {
        const session = sessions.find(s => s.id === sessionId);
        if (!session) {
          console.error("Session not found for ID:", sessionId);
          return;
        }
        const user = await User.me();
        const newRecord = await AttendanceRecord.create({
          student_id: studentId,
          session_id: sessionId,
          batch_id: session.batch_id,
          is_present: newStatus,
          marked_at: new Date().toISOString(),
          marked_by: user.email
        });
        setAttendanceData(prev => ({
          ...prev,
          [studentId]: {
            ...prev[studentId],
            [sessionId]: newRecord
          }
        }));
      }
    } catch (error) {
      console.error("Failed to toggle attendance:", error);
      alert("Error updating attendance. Please try again.");
    }
  };

  const handleStudentUpdated = () => {
    setEditingStudent(null);
    loadBatchData();
  };

  const handleStudentAdded = () => {
    setIsAddStudentModalOpen(false);
    loadBatchData();
  };
  
  const handleAddPastSession = async (sessionDetails) => {
    if (!batch) return;

    try {
        const user = await User.me();
        const allFaculties = await Faculty.list();
        const selectedFaculty = allFaculties.find(f => f.email === sessionDetails.facultyEmail);

        const newSessionData = {
            session_name: sessionDetails.topic ? `Past Session: ${sessionDetails.topic}` : "Past Session",
            topic_taught: sessionDetails.topic || "To be updated",
            faculty_name: selectedFaculty?.name || user.full_name,
            faculty_email: sessionDetails.facultyEmail || user.email,
            session_date: sessionDetails.sessionDate,
            session_time: sessionDetails.sessionTime,
            duration: "1 Hour",
            status: "completed",
            present_count: 0,
            total_students: students.length,
            batch_id: batch.batch_id,
            college_name: batch.college_name,
            year: batch.year,
            branch: batch.branch,
            division: batch.division,
            batch_description: batch.batch_description,
        };

        const newSession = await Session.create(newSessionData);
        
        const defaultRecords = students.map(student => ({
            student_id: student.id,
            session_id: newSession.id,
            batch_id: batch.batch_id,
            is_present: false,
            marked_at: new Date().toISOString(),
            marked_by: user.email,
        }));
        
        await AttendanceRecord.bulkCreate(defaultRecords);
        
        setIsAddSessionModalOpen(false);
        loadBatchData();
    } catch (error) {
        console.error("Failed to create past session:", error);
        alert("Error: Could not create the past session. " + error.message);
    }
  };

  const exportShiftWiseHTML = async () => {
    setIsExporting(true);
    try {
      const sortedStudents = [...students].sort((a, b) => (parseInt(a.roll_no) || 0) - (parseInt(b.roll_no) || 0));
      const sortedSessions = [...sessions].sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime());

      // Group sessions by date and shift
      const sessionsByDate = {};
      sortedSessions.forEach(session => {
        const date = session.session_date;
        if (!sessionsByDate[date]) sessionsByDate[date] = [];
        sessionsByDate[date].push(session);
      });

      const dates = Object.keys(sessionsByDate).sort();

      // Calculate individual student attendance
      const studentAttendance = sortedStudents.map(student => {
        let totalPresent = 0;
        let totalSessions = 0;
        const sessionDetails = {};

        sortedSessions.forEach(session => {
          const record = attendanceData[student.id]?.[session.id];
          if (record !== undefined) {
            totalSessions++;
            if (record.is_present) totalPresent++;
            sessionDetails[session.id] = record.is_present;
          }
        });

        return {
          ...student,
          totalPresent,
          totalSessions,
          percentage: totalSessions > 0 ? ((totalPresent / totalSessions) * 100).toFixed(1) : 0,
          sessionDetails
        };
      });

      // Identify defaulters (below 75%)
      const defaulters = studentAttendance.filter(s => parseFloat(s.percentage) < 75);

      // Calculate overall stats
      const totalRecords = Object.values(attendanceData).flatMap(s => Object.values(s));
      const totalPresent = totalRecords.filter(r => r.is_present).length;
      const overallRate = totalRecords.length > 0 ? ((totalPresent / totalRecords.length) * 100).toFixed(1) : 0;

      // Generate stunning HTML report
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>APT-TECH Attendance Report - ${batch.batch_name}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes gradientShift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: linear-gradient(-45deg, #667eea, #764ba2, #f093fb, #4facfe);
            background-size: 400% 400%;
            animation: gradientShift 15s ease infinite;
            padding: 20px; 
            min-height: 100vh;
        }
        .container { max-width: 1400px; margin: 0 auto; animation: fadeIn 1s ease; }
        .header { 
            background: linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 100%);
            backdrop-filter: blur(10px);
            padding: 40px; 
            border-radius: 25px; 
            box-shadow: 0 25px 70px rgba(0,0,0,0.4); 
            text-align: center; 
            margin-bottom: 30px;
            border: 2px solid rgba(255,255,255,0.3);
        }
        .logo { 
            width: 120px; 
            height: 120px; 
            margin: 0 auto 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 48px;
            font-weight: 900;
            color: white;
            box-shadow: 0 10px 30px rgba(102, 126, 234, 0.5);
        }
        .header h1 { 
            font-size: 3em; 
            margin-bottom: 15px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #667eea 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-weight: 900;
        }
        .batch-info { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 15px; 
            margin-top: 20px; 
        }
        .info-item { 
            padding: 15px; 
            background: #f8f9fa; 
            border-radius: 10px; 
            border-left: 4px solid #667eea; 
        }
        .info-label { font-size: 0.85em; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
        .info-value { font-size: 1.2em; color: #333; font-weight: bold; margin-top: 5px; }
        .stats-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
            gap: 20px; 
            margin-bottom: 30px; 
        }
        .stat-card { 
            background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%);
            backdrop-filter: blur(10px);
            padding: 35px; 
            border-radius: 20px; 
            box-shadow: 0 15px 40px rgba(0,0,0,0.25); 
            transition: all 0.4s ease;
            border: 2px solid rgba(255,255,255,0.5);
        }
        .stat-card:hover { transform: translateY(-10px) scale(1.02); box-shadow: 0 20px 50px rgba(0,0,0,0.35); }
        .stat-icon { font-size: 2.5em; margin-bottom: 10px; }
        .stat-label { color: #666; font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
        .stat-value { 
            font-size: 2.5em; 
            font-weight: bold; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-top: 10px; 
        }
        .section { 
            background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%);
            backdrop-filter: blur(10px);
            padding: 35px; 
            border-radius: 25px; 
            box-shadow: 0 20px 50px rgba(0,0,0,0.3); 
            margin-bottom: 30px;
            border: 2px solid rgba(255,255,255,0.4);
        }
        .section-title { 
            font-size: 1.8em; 
            color: #333; 
            margin-bottom: 20px; 
            padding-bottom: 10px; 
            border-bottom: 3px solid #667eea; 
        }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }
        th { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-weight: 600; }
        .present { background: #C6EFCE; color: #006100; font-weight: bold; text-align: center; }
        .absent { background: #FFC7CE; color: #9C0006; font-weight: bold; text-align: center; }
        .percentage-high { color: #10b981; font-weight: bold; }
        .percentage-low { color: #ef4444; font-weight: bold; }
        .defaulter-row { background: #fee2e2; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">APT</div>
            <h1>📊 Comprehensive Attendance Report</h1>
            <div class="batch-info">
                <div class="info-item">
                    <div class="info-label">Batch Name</div>
                    <div class="info-value">${batch.batch_name}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">College</div>
                    <div class="info-value">${batch.college_name || 'Private Batch'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Year</div>
                    <div class="info-value">${batch.year || 'N/A'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Branch</div>
                    <div class="info-value">${batch.branch || 'N/A'}</div>
                </div>
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon">👥</div>
                <div class="stat-label">Total Students</div>
                <div class="stat-value">${students.length}</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📅</div>
                <div class="stat-label">Total Sessions</div>
                <div class="stat-value">${sortedSessions.length}</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📈</div>
                <div class="stat-label">Overall Attendance</div>
                <div class="stat-value">${overallRate}%</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">⚠️</div>
                <div class="stat-label">Defaulters (<75%)</div>
                <div class="stat-value">${defaulters.length}</div>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">📊 Day-wise & Shift-wise Attendance</h2>
            <table>
                <thead>
                    <tr>
                        <th>Roll No</th>
                        <th>PRN</th>
                        <th>Student Name</th>
                        ${sortedSessions.map(s => `<th style="min-width: 100px;">${s.session_name.replace('Uploaded: ', '')}</th>`).join('')}
                        <th>Present</th>
                        <th>Total</th>
                        <th>%</th>
                    </tr>
                </thead>
                <tbody>
                    ${studentAttendance.map(student => `
                        <tr ${parseFloat(student.percentage) < 75 ? 'class="defaulter-row"' : ''}>
                            <td>${student.roll_no}</td>
                            <td>${student.prn || 'N/A'}</td>
                            <td><strong>${student.name}</strong></td>
                            ${sortedSessions.map(session => {
                              const isPresent = student.sessionDetails[session.id];
                              return `<td class="${isPresent ? 'present' : 'absent'}">${isPresent ? 'P' : 'A'}</td>`;
                            }).join('')}
                            <td><strong>${student.totalPresent}</strong></td>
                            <td><strong>${student.totalSessions}</strong></td>
                            <td class="${parseFloat(student.percentage) >= 75 ? 'percentage-high' : 'percentage-low'}"><strong>${student.percentage}%</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        ${defaulters.length > 0 ? `
        <div class="section">
            <h2 class="section-title">⚠️ Defaulters List (Below 75% Attendance)</h2>
            <table>
                <thead>
                    <tr>
                        <th>Roll No</th>
                        <th>PRN</th>
                        <th>Student Name</th>
                        <th>Present</th>
                        <th>Total</th>
                        <th>Attendance %</th>
                    </tr>
                </thead>
                <tbody>
                    ${defaulters.map(student => `
                        <tr class="defaulter-row">
                            <td>${student.roll_no}</td>
                            <td>${student.prn || 'N/A'}</td>
                            <td><strong>${student.name}</strong></td>
                            <td>${student.totalPresent}</td>
                            <td>${student.totalSessions}</td>
                            <td class="percentage-low"><strong>${student.percentage}%</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}

        <div class="section">
            <h2 class="section-title">📋 Session Summary</h2>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Session Name</th>
                        <th>Topic</th>
                        <th>Faculty</th>
                        <th>Present/Total</th>
                        <th>Attendance %</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedSessions.map(session => {
                      const sessionRecords = Object.values(attendanceData).filter(s => s[session.id]).map(s => s[session.id]);
                      const presentCount = sessionRecords.filter(r => r.is_present).length;
                      const totalCount = sessionRecords.length;
                      const sessionRate = totalCount > 0 ? ((presentCount / totalCount) * 100).toFixed(1) : 0;
                      return `
                        <tr>
                            <td>${new Date(session.session_date).toLocaleDateString('en-GB')}</td>
                            <td>${session.session_name}</td>
                            <td>${session.topic_taught || 'N/A'}</td>
                            <td>${session.faculty_name}</td>
                            <td><strong>${presentCount}/${totalCount}</strong></td>
                            <td class="${parseFloat(sessionRate) >= 75 ? 'percentage-high' : 'percentage-low'}"><strong>${sessionRate}%</strong></td>
                        </tr>
                      `;
                    }).join('')}
                </tbody>
            </table>
        </div>

        <div class="section" style="text-align: center; background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);">
            <p style="font-size: 0.9em; color: #666; margin-bottom: 10px;">Report Generated: ${new Date().toLocaleString()}</p>
            <p style="font-weight: bold; font-size: 1.2em; color: #333;">Powered by APT-TECH Professional Training</p>
            <p style="font-size: 0.85em; color: #888; margin-top: 10px;">Advanced Attendance Management System</p>
        </div>
    </div>
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${batch.batch_name.replace(/[^\w\s]/g, '_')}_Comprehensive_Report_${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export report. Please try again.");
    }
    setIsExporting(false);
  };

  const exportBatchData = async () => {
    setIsExporting(true);
    try {
      const sortedStudents = [...students].sort((a, b) => (parseInt(a.roll_no) || 0) - (parseInt(b.roll_no) || 0));
      const sortedSessions = [...sessions].sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime());

      let htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="UTF-8">
          <style>
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; vertical-align: middle; font-family: Calibri, sans-serif; font-size: 11pt; }
            .header { font-size: 20pt; font-weight: bold; text-align: center; background-color: #DDEBF7; }
            .subheader { font-size: 12pt; font-weight: bold; text-align: center; background-color: #E2EFDA; }
            .section-title { font-size: 12pt; font-weight: bold; background-color: #BFBFBF; color: #FFFFFF; text-align: left; }
            .bold { font-weight: bold; }
            .present { background-color: #C6EFCE; color: #006100; text-align: center; font-weight: bold; }
            .absent { background-color: #FFC7CE; color: #9C0006; text-align: center; font-weight: bold; }
            .na { background-color: #F2F2F2; color: #595959; text-align: center; }
          </style>
        </head>
        <body>
      `;

      const totalColumns = 3 + sortedSessions.length + 3;

      htmlContent += `
        <table>
          <tr><td colspan="${totalColumns}" class="header">APT-TECH Professional Training Attendance Report</td></tr>
          <tr><td colspan="${totalColumns}" class="subheader">${batch.college_name || 'Private Batch'}</td></tr>
          <tr><td colspan="${totalColumns}" class="subheader">Batch: ${batch.batch_name} (${batch.year || 'N/A'})</td></tr>
          <tr><td colspan="${totalColumns}"></td></tr>
        </table>
      `;

      if (sortedSessions.length > 0) {
        htmlContent += `
          <table>
            <tr><td colspan="6" class="section-title">SESSION DETAILS</td></tr>
            <tr class="bold"><td>Date</td><td>Session Name</td><td>Topic</td><td>Faculty</td><td>Time</td><td>Duration</td></tr>
        `;
        sortedSessions.forEach(session => {
          htmlContent += `
            <tr>
              <td>${format(new Date(session.session_date), 'dd/MM/yy')}</td>
              <td>${session.session_name || ''}</td>
              <td>${session.topic_taught || ''}</td>
              <td>${session.faculty_name || ''}</td>
              <td>${session.session_time || ''}</td>
              <td>${session.duration || ''}</td>
            </tr>
          `;
        });
        htmlContent += `</table><br/>`;
      }

      htmlContent += `
        <table>
          <tr><td colspan="${totalColumns}" class="section-title">ATTENDANCE RECORD</td></tr>
          <tr class="bold"><td>Sr.</td><td>Roll No</td><td>Student Name</td>
      `;
      sortedSessions.forEach(session => {
        htmlContent += `<td>${format(new Date(session.session_date), 'dd/MM')}</td>`;
      });
      htmlContent += `<td>Present</td><td>Total</td><td>%</td></tr>`;

      sortedStudents.forEach((student, index) => {
        let presentCount = 0;
        let attendanceRow = '';
        sortedSessions.forEach(session => {
          const record = attendanceData[student.id]?.[session.id];
          const isPresent = record?.is_present;
          if (record === undefined) {
            attendanceRow += `<td class="na">N/A</td>`;
          } else if (isPresent) {
            presentCount++;
            attendanceRow += `<td class="present">P</td>`;
          } else {
            attendanceRow += `<td class="absent">A</td>`;
          }
        });

        const totalSessions = sortedSessions.length;
        const percentage = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;

        htmlContent += `
          <tr>
            <td>${index + 1}</td>
            <td>${student.roll_no || ''}</td>
            <td class="bold">${student.name || ''}</td>
            ${attendanceRow}
            <td class="bold">${presentCount}</td>
            <td class="bold">${totalSessions}</td>
            <td class="bold">${percentage}%</td>
          </tr>
        `;
      });
      htmlContent += `</table><br/>`;

      const totalStudents = sortedStudents.length;
      const totalSessions = sortedSessions.length;
      
      const overallAttendanceRecords = Object.values(attendanceData).flatMap(studentSessions => Object.values(studentSessions));
      const totalPresent = overallAttendanceRecords.filter(record => record.is_present).length;
      const totalPossibleAttendances = totalStudents * totalSessions;
      const overallRate = totalPossibleAttendances > 0 ? Math.round((totalPresent / totalPossibleAttendances) * 100) : 0;

      htmlContent += `
        <table>
          <tr><td colspan="2" class="section-title">SUMMARY</td></tr>
          <tr><td class="bold">Total Students:</td><td>${totalStudents}</td></tr>
          <tr><td class="bold">Total Sessions:</td><td>${totalSessions}</td></tr>
          <tr><td class="bold">Overall Attendance:</td><td>${overallRate}%</td></tr>
          <tr><td class="bold">Generated:</td><td>${format(new Date(), 'dd/MM/yyyy HH:mm')}</td></tr>
        </table>
      `;

      htmlContent += `</body></html>`;

      const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${batch.batch_name.replace(/[^\w\s]/g, '_')}_Attendance_Report.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export report. Please try again.");
    }
    setIsExporting(false);
  };

  const handleDeleteStudent = async (studentId) => {
    try {
        await Student.delete(studentId);
        const updatedStudents = students.filter(s => s.id !== studentId);
        setStudents(updatedStudents);
        setAttendanceData(prev => {
          const newAttData = { ...prev };
          delete newAttData[studentId];
          return newAttData;
        });
        await Batch.update(batch.id, { student_count: updatedStudents.length });
    } catch (error) {
        console.error("Failed to delete student", error);
        alert("Failed to delete student. Please try again.");
    }
  };

  const handleEditStudent = (student) => {
    setEditingStudent(student);
  };

  const handleOCRSuccess = () => {
    loadBatchData();
    setShowOCRModal(false);
  };

  const handleEditSession = (session) => {
    setEditingSession(session);
  };

  const handleSessionUpdated = () => {
    setEditingSession(null);
    loadBatchData();
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      // Delete all attendance records for this session first
      const attendanceRecords = await AttendanceRecord.filter({ session_id: sessionId });
      for (const record of attendanceRecords) {
        await AttendanceRecord.delete(record.id);
      }
      
      // Then delete the session
      await Session.delete(sessionId);
      loadBatchData();
    } catch (error) {
      console.error("Failed to delete session:", error);
      alert("Failed to delete session. Please try again.");
    }
  };
  
  if (!batchId) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-red-600">Error: No Batch ID Provided</h2>
        <p className="text-gray-600 mt-2">Please navigate back and try again.</p>
        <Button onClick={() => navigate(createPageUrl("Batches"))} className="mt-4">
          Back to Batches
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-10 w-1/2 mb-4" />
        <Skeleton className="h-8 w-1/4 mb-8" />
        <div className="grid md:grid-cols-2 gap-8">
            <Card><CardHeader><Skeleton className="h-8 w-full" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
            <Card><CardHeader><Skeleton className="h-8 w-full" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
        </div>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-red-600">Batch Not Found</h2>
        <p className="text-gray-600 mt-2">The batch with ID "{batchId}" could not be found.</p>
        <Button onClick={() => navigate(createPageUrl("Batches"))} className="mt-4">
          Back to Batches
        </Button>
      </div>
    );
  }

  const overallAttendanceRecords = Object.values(attendanceData).flatMap(studentSessions => Object.values(studentSessions));
  const totalPresent = overallAttendanceRecords.filter(record => record.is_present).length;
  const totalPossibleAttendances = students.length * sessions.length;
  const attendanceRate = totalPossibleAttendances > 0 ? (totalPresent / totalPossibleAttendances) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => navigate(createPageUrl("Batches"))}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">{batch.batch_name}</h1>
            <p className="text-gray-600">{batch.college_name || 'Private Batch'} - {batch.year || 'Custom'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="flex items-center gap-4 p-4">
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 text-blue-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Overall Attendance</p>
              <p className="text-2xl font-bold text-gray-900">{attendanceRate.toFixed(1)}%</p>
            </div>
          </Card>
          <Card className="flex items-center gap-4 p-4">
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-green-100 text-green-600">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Students</p>
              <p className="text-2xl font-bold text-gray-900">{students.length}</p>
            </div>
          </Card>
          <Card className="flex items-center gap-4 p-4">
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-purple-100 text-purple-600">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Sessions</p>
              <p className="text-2xl font-bold text-gray-900">{sessions.length}</p>
            </div>
          </Card>
        </div>

        <div className="space-y-8">
          <div className="flex flex-wrap gap-3 justify-end">
            <Button
              onClick={() => setIsUploadModalOpen(true)}
              className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-lg"
            >
              <Upload className="w-4 h-4 mr-2" />
              📤 Upload Attendance File
            </Button>
            <Button
              onClick={() => setShowOCRModal(true)}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg"
            >
              <Camera className="w-4 h-4 mr-2" />
              📸 OCR Attendance
            </Button>
            <Button 
              onClick={() => setIsAddStudentModalOpen(true)}
              className="bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 shadow-lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              ➕ Add Student
            </Button>
            <Button 
              onClick={() => setIsAddSessionModalOpen(true)}
              className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 shadow-lg"
            >
              <Calendar className="w-4 h-4 mr-2" />
              📅 Add Past Session
            </Button>
            <Button 
              onClick={() => setIsCorrectingModalOpen(true)}
              className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white shadow-lg"
            >
              <ScanLine className="w-4 h-4 mr-2" />
              📖 Bulk Correct via PDF
            </Button>
            <Button 
              onClick={exportShiftWiseHTML}
              disabled={isExporting}
              className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 shadow-lg"
            >
              {isExporting ? (
                <Clock className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              🎨 Export HTML Report
            </Button>
            <Button 
              onClick={exportBatchData}
              disabled={isExporting}
              variant="outline"
              className="shadow-lg"
            >
              {isExporting ? (
                <Clock className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              📊 Export Excel
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="lg:col-span-2">
              <Card className="shadow-md border-0">
                <CardHeader className="bg-white border-b flex flex-col md:flex-row items-start md:items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-600"/>
                      Students ({students.length}) with Attendance History
                    </CardTitle>
                    <CardDescription>Click on any 'A' or 'P' to toggle attendance status for past sessions.</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-gray-600">Roll No.</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-600">Name</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-600">PRN</th>
                          {sessions.map(session => (
                            <th key={session.id} className="px-2 py-3 text-center font-semibold text-gray-600 text-xs min-w-[80px]" title={session.topic_taught || session.session_name}>
                              <div className="flex flex-col items-center gap-1">
                                <span>{format(new Date(session.session_date), 'dd/MM')}</span>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditSession(session)}
                                    className="h-6 w-6 p-0 hover:bg-blue-100"
                                    title="Edit this session"
                                  >
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 hover:bg-red-100 text-red-600"
                                        title="Delete this session and all attendance records"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>🗑️ Delete Session?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will permanently delete the session on <strong>{format(new Date(session.session_date), 'dd MMM yyyy')}</strong> and ALL attendance records for this date.
                                          <br /><br />
                                          <strong>Topic:</strong> {session.topic_taught || session.session_name}
                                          <br />
                                          <strong>Faculty:</strong> {session.faculty_name}
                                          <br /><br />
                                          This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>❌ Cancel</AlertDialogCancel>
                                        <AlertDialogAction 
                                          onClick={() => handleDeleteSession(session.id)} 
                                          className="bg-red-600 hover:bg-red-700"
                                        >
                                          🗑️ Delete Session
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>
                            </th>
                          ))}
                          <th className="px-4 py-3 text-center font-semibold text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map(student => (
                          <tr key={student.id} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono font-bold">{student.roll_no}</td>
                            <td className="px-4 py-3 font-medium">{student.name}</td>
                            <td className="px-4 py-3 text-sm">{student.prn || 'N/A'}</td>
                            {sessions.map(session => {
                              const record = attendanceData[student.id]?.[session.id];
                              const isPresent = record?.is_present;
                              return (
                                <td 
                                  key={session.id} 
                                  className="px-2 py-3 text-center cursor-pointer hover:bg-gray-200 transition-colors"
                                  onClick={() => handleToggleAttendance(student.id, session.id)}
                                  title="Click to toggle attendance"
                                >
                                  <span className={`font-bold text-sm px-2 py-1 rounded ${
                                    record === undefined ? 'bg-gray-100 text-gray-500' : isPresent ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                  }`}>
                                    {record === undefined ? '-' : (isPresent ? 'P' : 'A')}
                                  </span>
                                </td>
                              );
                            })}
                            <td className="px-4 py-3 flex gap-2 justify-center">
                              <Button variant="outline" size="icon" onClick={() => handleEditStudent(student)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="icon">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Student?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete '<strong>{student.name}</strong>' and all their attendance records. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteStudent(student.id)} className="bg-red-600 hover:bg-red-700">
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="lg:col-span-2">
              <Card className="shadow-md border-0">
                <CardHeader className="bg-white border-b">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-green-600"/>
                    Sessions ({sessions.length}) - Click to Edit/Delete
                  </CardTitle>
                  <CardDescription>Manage all sessions for this batch. You can edit session details or delete duplicates.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-3 max-h-96 overflow-y-auto">
                  {sessions.map(session => {
                    const sessionAttendance = Object.values(attendanceData)
                      .filter(studentRecords => studentRecords[session.id])
                      .map(studentRecords => studentRecords[session.id]);
                    const presentCount = sessionAttendance.filter(r => r.is_present).length;
                    const totalStudentsForSession = students.length > 0 ? students.length : session.total_students;
                    return (
                      <div key={session.id} className="p-4 border rounded-lg hover:bg-blue-50 transition-colors">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-semibold text-lg">{session.topic_taught || session.session_name}</p>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditSession(session)}
                                  className="hover:bg-blue-100"
                                >
                                  <Edit className="w-4 h-4 mr-1" />
                                  Edit
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm">
                                      <Trash2 className="w-4 h-4 mr-1" />
                                      Delete
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Session?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will permanently delete the session '<strong>{session.topic_taught || session.session_name}</strong>' and all its attendance records. This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction 
                                        onClick={() => handleDeleteSession(session.id)}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        Delete Session
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 mb-1">{session.faculty_name}</p>
                            <p className="text-xs text-gray-500 mb-2">
                              📅 {format(new Date(session.session_date), "dd MMM, yyyy")} at {session.session_time}
                            </p>
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-blue-600">
                                👥 {presentCount}/{totalStudentsForSession} present ({totalStudentsForSession > 0 ? Math.round((presentCount/totalStudentsForSession)*100) : 0}%)
                              </p>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                session.status === 'completed' ? 'bg-green-100 text-green-800' :
                                session.status === 'active' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {session.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {sessions.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>No sessions found for this batch.</p>
                      <Button 
                        onClick={() => setIsAddSessionModalOpen(true)}
                        className="mt-2"
                      >
                        Add First Session
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <EditStudentModal
        isOpen={!!editingStudent}
        onClose={() => setEditingStudent(null)}
        student={editingStudent}
        onStudentUpdated={handleStudentUpdated}
      />
      <AddStudentToBatchModal
        isOpen={isAddStudentModalOpen}
        onClose={() => setIsAddStudentModalOpen(false)}
        onStudentAdded={handleStudentAdded}
        batch={batch}
      />
      <AddPastSessionModal
        isOpen={isAddSessionModalOpen}
        onClose={() => setIsAddSessionModalOpen(false)}
        onSave={handleAddPastSession}
        batch={batch}
      />
      <OCRAttendanceModal
        isOpen={showOCRModal}
        onClose={() => setShowOCRModal(false)}
        onSuccess={handleOCRSuccess}
        batch={batch}
        students={students}
      />
      <CorrectAttendanceModal
        isOpen={isCorrectingModalOpen}
        onClose={() => setIsCorrectingModalOpen(false)}
        onSuccess={loadBatchData}
        batch={batch}
        students={students}
        sessions={sessions}
      />
      <EditSessionModal
        isOpen={!!editingSession}
        onClose={() => setEditingSession(null)}
        session={editingSession}
        onSessionUpdated={handleSessionUpdated}
        batch={batch}
      />
      <UploadAttendanceModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={loadBatchData}
        batch={batch}
        students={students}
      />
    </div>
  );
}