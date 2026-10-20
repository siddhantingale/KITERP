import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format, parseISO } from "date-fns";

import { Batch, Student, Session, AttendanceRecord } from "@/entities/all";
import { createPageUrl } from "@/utils";

// Note: StatCard component is not provided in the outline.
// Assuming it's either imported from elsewhere or its content
// would be expanded here. For a functional file, basic div replacements are used below.

export default function BatchDetailsPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [batch, setBatch] = useState(null);
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState({ totalPresent: 0, totalPossible: 0, overallRate: 0 });
  const [sessionAttendanceRates, setSessionAttendanceRates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [batchId, setBatchId] = useState(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get('batch_id');
    if (id) {
      setBatchId(id);
    } else {
      // Redirect to Batches page if no batch_id is found in the URL
      navigate(createPageUrl("Batches"));
    }
  }, [location, navigate]);

  const fetchData = useCallback(async () => {
    if (!batchId) return;
    setIsLoading(true);
    try {
      const batchData = await Batch.get(batchId);
      setBatch(batchData);

      const studentsData = await Student.filter({ batch_id: batchId });
      setStudents(studentsData);

      // Fetch sessions and sort them by session_date descending as per original code,
      // which is useful for displaying latest sessions first in some UI contexts.
      const sessionsData = await Session.filter({ batch_id: batchId }, "-session_date");
      setSessions(sessionsData);

      let totalPresentOverall = 0;
      let totalPossibleOverall = 0;
      const sessionRates = [];

      for (const session of sessionsData) {
        if (session.status === 'completed') {
          totalPresentOverall += session.present_count || 0;
          totalPossibleOverall += session.total_students || 0;
          const rate = (session.total_students && session.total_students > 0) ? ((session.present_count || 0) / session.total_students * 100) : 0;
          sessionRates.push({
            name: format(parseISO(session.session_date), "dd/MM") + ` (${session.session_name.substring(0,10)}...)`,
            attendance: parseFloat(rate.toFixed(1))
          });
        }
      }

      setAttendanceSummary({
        totalPresent: totalPresentOverall,
        totalPossible: totalPossibleOverall,
        overallRate: totalPossibleOverall > 0 ? parseFloat(((totalPresentOverall / totalPossibleOverall) * 100).toFixed(1)) : 0
      });
      // Reverse for chronological chart display if sessions were fetched in descending order
      setSessionAttendanceRates(sessionRates.reverse());

    } catch (error) {
      console.error("Error fetching batch details:", error);
      // Implement user-facing error message here if needed
    }
    setIsLoading(false);
  }, [batchId]);

  useEffect(() => {
    if (batchId) {
      fetchData();
    }
  }, [batchId, fetchData]);

  const handleDeleteBatch = async () => {
    // This is a placeholder for the actual handleDeleteBatch logic.
    // Example:
    // if (window.confirm("Are you sure you want to delete this batch? This action cannot be undone.")) {
    //   try {
    //     await Batch.delete(batch.id);
    //     navigate(createPageUrl("Batches")); // Redirect after successful deletion
    //   } catch (error) {
    //     console.error("Error deleting batch:", error);
    //     alert("Failed to delete batch. Please try again.");
    //   }
    // }
    alert("Delete Batch functionality is a placeholder.");
    console.log("Delete Batch triggered for batch ID:", batch?.id);
  };

  const handleUpdateBatch = (updatedBatchData) => {
    // This is a placeholder for the actual handleUpdateBatch logic.
    // Example:
    // try {
    //   await Batch.update(batch.id, updatedBatchData);
    //   fetchData(); // Re-fetch data to update UI
    //   setIsEditDialogOpen(false);
    // } catch (error) {
    //   console.error("Error updating batch:", error);
    //   alert("Failed to update batch. Please try again.");
    // }
    alert("Update Batch functionality is a placeholder.");
    console.log("Update Batch triggered with data:", updatedBatchData);
    setIsEditDialogOpen(false); // Close the dialog
  };

  const exportBatchDataDetailed = async () => {
    if (!batch || students.length === 0) {
      alert("No data to export.");
      return;
    }
    setIsExporting(true);
    try {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Attendance Report');

      const studentsInBatch = [...students].sort((a,b) => (parseInt(a.roll_no) || 0) - (parseInt(b.roll_no) || 0));
      
      // Fetch all sessions for this batch
      const sessionsForBatch = await Session.filter({ batch_id: batch.id });
      // Fetch all attendance records for this batch
      const attendanceRecordsForBatch = await AttendanceRecord.filter({ batch_id: batch.id });

      const uniqueSessionDates = [...new Set(sessionsForBatch.map(s => s.session_date))]
        .sort((a,b) => new Date(parseISO(a)) - new Date(parseISO(b)))
        .map(dateString => format(parseISO(dateString), 'dd/MM/yy'));

      const sessionIdToDateMap = {};
      sessionsForBatch.forEach(session => {
        sessionIdToDateMap[session.id] = format(parseISO(session.session_date), 'dd/MM/yy');
      });

      const studentAttendanceMap = {};
      attendanceRecordsForBatch.forEach(record => {
        if (!studentAttendanceMap[record.student_id]) {
          studentAttendanceMap[record.student_id] = {};
        }
        const sessionDate = sessionIdToDateMap[record.session_id];
        if (sessionDate) {
          studentAttendanceMap[record.student_id][sessionDate] = record.is_present;
        }
      });

      // Title and Header Section
      const title = `EDU TRACK - Attendance Report`;
      const subtitle = `${batch.college_name} - ${batch.branch} (${batch.year})`;
      const academicYear = `Academic Year: ${new Date(batch.created_date).getFullYear()}-${new Date(batch.created_date).getFullYear()+1}`;
      
      // Merge cells for title
      worksheet.mergeCells('A1:' + String.fromCharCode(67 + uniqueSessionDates.length) + '1');
      worksheet.getCell('A1').value = title;
      worksheet.getCell('A1').font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getCell('A1').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F46E5' }
      };
      worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 30;

      // Subtitle
      worksheet.mergeCells('A2:' + String.fromCharCode(67 + uniqueSessionDates.length) + '2');
      worksheet.getCell('A2').value = subtitle;
      worksheet.getCell('A2').font = { name: 'Calibri', size: 12, bold: true };
      worksheet.getCell('A2').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E7FF' }
      };
      worksheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(2).height = 25;

      // Academic Year & Generated Date
      worksheet.mergeCells('A3:' + String.fromCharCode(67 + uniqueSessionDates.length) + '3');
      worksheet.getCell('A3').value = `${academicYear} | Generated: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`;
      worksheet.getCell('A3').font = { name: 'Calibri', size: 10, italic: true };
      worksheet.getCell('A3').alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(3).height = 20;

      // Empty row
      worksheet.addRow([]);

      // Header Row with session dates
      const headerRow = ['Roll No.', 'PRN', 'Student Name', ...uniqueSessionDates];
      const excelHeaderRow = worksheet.addRow(headerRow);
      excelHeaderRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      excelHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF3B82F6' }
      };
      excelHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };
      excelHeaderRow.height = 25;
      
      // Set column widths
      worksheet.getColumn(1).width = 12;
      worksheet.getColumn(2).width = 15;
      worksheet.getColumn(3).width = 30;
      uniqueSessionDates.forEach((_, index) => {
        worksheet.getColumn(index + 4).width = 12;
      });

      // Data rows with colored cells
      studentsInBatch.forEach((student, index) => {
        const row = [
          student.roll_no || (index + 1).toString(),
          student.prn || '',
          student.name || ''
        ];
        
        const dataRow = worksheet.addRow(row);
        dataRow.font = { name: 'Calibri', size: 10 };
        dataRow.alignment = { vertical: 'middle', horizontal: 'left' };
        
        // Student info cells with light background
        dataRow.getCell(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF3F4F6' }
        };
        dataRow.getCell(2).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF3F4F6' }
        };
        dataRow.getCell(3).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF3F4F6' }
        };

        // Attendance cells with GREEN (Present) or RED (Absent)
        uniqueSessionDates.forEach((date, dateIndex) => {
          const isPresent = studentAttendanceMap[student.id] && studentAttendanceMap[student.id][date];
          const cell = dataRow.getCell(dateIndex + 4);
          
          if (isPresent) {
            // GREEN for present
            cell.value = 'P';
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FF10B981' } // Green
            };
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          } else {
            // RED for absent
            cell.value = 'A';
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFEF4444' } // Red
            };
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          }
          
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          };
        });

        // Add borders to student info cells
        dataRow.getCell(1).border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        dataRow.getCell(2).border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        dataRow.getCell(3).border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      // Add footer row
      worksheet.addRow([]);
      const footerRow = worksheet.addRow(['Legend: P = Present (Green) | A = Absent (Red)']);
      worksheet.mergeCells(footerRow.number, 1, footerRow.number, 3 + uniqueSessionDates.length);
      footerRow.getCell(1).font = { name: 'Calibri', size: 9, italic: true };
      footerRow.getCell(1).alignment = { horizontal: 'center' };

      const watermarkRow = worksheet.addRow(['Generated by EDU TRACK Education Management System']);
      worksheet.mergeCells(watermarkRow.number, 1, watermarkRow.number, 3 + uniqueSessionDates.length);
      watermarkRow.getCell(1).font = { name: 'Calibri', size: 8, italic: true, color: { argb: 'FF6B7280' } };
      watermarkRow.getCell(1).alignment = { horizontal: 'center' };

      // Add borders to header
      excelHeaderRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF000000' } },
          left: { style: 'medium', color: { argb: 'FF000000' } },
          bottom: { style: 'medium', color: { argb: 'FF000000' } },
          right: { style: 'medium', color: { argb: 'FF000000' } }
        };
      });

      // Generate and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = `${batch.college_name}_${batch.year}_${batch.branch}_Attendance_Report_${format(new Date(), 'dd-MM-yyyy')}.xlsx`.replace(/\s+/g, '_');
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Error exporting detailed batch data:", error);
      alert("Error exporting attendance data. Please try again.");
    }
    setIsExporting(false);
  };

  if (isLoading || !batch) {
    // Placeholder for loading skeleton UI
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Loading batch details...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">{batch.college_name} - {batch.branch} ({batch.year})</h1>
      <p className="text-gray-600 mb-4">Created: {format(parseISO(batch.created_date), 'dd MMMM yyyy')}</p>

      <div className="flex space-x-2 my-4">
        <button
          onClick={() => setIsEditDialogOpen(true)}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Edit Batch
        </button>
        <button
          onClick={handleDeleteBatch}
          className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
        >
          Delete Batch
        </button>
        <button
          onClick={exportBatchDataDetailed}
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 flex items-center gap-2"
          disabled={isExporting}
        >
          {isExporting ? (
            <>
              <span className="animate-spin">⏳</span>
              Generating Professional Report...
            </>
          ) : (
            <>
              <span>📊</span>
              Export Professional Attendance Report (Excel)
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4">
        {/* These would typically be StatCard components */}
        <div className="p-4 border rounded shadow">
          <h3 className="text-lg font-semibold">Total Students</h3>
          <p className="text-xl">{students.length}</p>
        </div>
        <div className="p-4 border rounded shadow">
          <h3 className="text-lg font-semibold">Total Sessions</h3>
          <p className="text-xl">{sessions.length}</p>
        </div>
        <div className="p-4 border rounded shadow">
          <h3 className="text-lg font-semibold">Overall Attendance Rate</h3>
          <p className="text-xl">{attendanceSummary.overallRate}%</p>
        </div>
      </div>

      <h2 className="text-xl font-semibold mt-6 mb-3">Sessions</h2>
      {sessions.length > 0 ? (
        <ul className="list-disc pl-5">
          {sessions.map(session => (
            <li key={session.id} className="mb-1">
              {format(parseISO(session.session_date), 'dd/MM/yyyy')} - {session.session_name} ({session.status})
              {session.total_students > 0 && session.status === 'completed' &&
                ` - Present: ${session.present_count}/${session.total_students} (${((session.present_count || 0) / session.total_students * 100).toFixed(1)}%)`}
            </li>
          ))}
        </ul>
      ) : (
        <p>No sessions found for this batch.</p>
      )}

      <h2 className="text-xl font-semibold mt-6 mb-3">Students</h2>
      {students.length > 0 ? (
        <ul className="list-disc pl-5">
          {students.map(student => (
            <li key={student.id} className="mb-1">
              {student.roll_no} - {student.name} {student.prn ? `(${student.prn})` : ''}
            </li>
          ))}
        </ul>
      ) : (
        <p>No students found for this batch.</p>
      )}

      {/* Edit batch dialog/modal */}
      {isEditDialogOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Edit Batch</h3>
            {/* Placeholder form for editing batch data */}
            <form onSubmit={(e) => { e.preventDefault(); handleUpdateBatch({ /* Gather form data here, e.g., college_name: e.target.collegeName.value */ }); }}>
              <div className="mb-4">
                <label htmlFor="collegeName" className="block text-gray-700 text-sm font-bold mb-2">College Name:</label>
                <input
                  type="text"
                  id="collegeName"
                  name="collegeName"
                  defaultValue={batch.college_name}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
              </div>
              <div className="mb-4">
                <label htmlFor="branch" className="block text-gray-700 text-sm font-bold mb-2">Branch:</label>
                <input
                  type="text"
                  id="branch"
                  name="branch"
                  defaultValue={batch.branch}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
              </div>
              <div className="mb-4">
                <label htmlFor="year" className="block text-gray-700 text-sm font-bold mb-2">Year:</label>
                <input
                  type="text"
                  id="year"
                  name="year"
                  defaultValue={batch.year}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
              </div>
              <div className="flex justify-end">
                <button type="submit" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mr-2">Save</button>
                <button type="button" onClick={() => setIsEditDialogOpen(false)} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}