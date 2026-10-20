import React, { useState, useRef } from "react";
import { College } from "@/entities/all";
import { api } from "@/api/client";
import { UploadFile, ExtractDataFromUploadedFile, InvokeLLM } from "@/integrations/Core";
import { parseAttendanceFile } from "@/functions/parseAttendanceFile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, TrendingUp, FileSpreadsheet, Sparkles, Download, Loader2, Send, Zap, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, parse } from "date-fns";
import { distributeAnalysisReport } from "@/functions/distributeAnalysisReport";

const years = ["First Year", "Second Year", "Third Year", "Fourth Year"];
const branches = [
  "Computer Science Engineering",
  "Artificial Intelligence & Machine Learning",
  "Data Science",
  "Computer Science & Business Systems",
  "Electronics & Telecommunication",
  "Information Technology",
  "Mechanical Engineering",
  "Civil Engineering",
  "Textile Engineering",
  "Bio-Technology Engineering",
  "Chemical Engineering",
  "Environmental Engineering",
  "Electrical Engineering",
  "Production Engineering"
];

export default function AdvancedAnalysis() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [colleges, setColleges] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState(null);
  const [formData, setFormData] = useState({
    academicYear: "",
    division: ""
  });
  const [reportConfig, setReportConfig] = useState({
    includeCharts: true,
    includeTopPerformers: true,
    includeAtRisk: true,
    includeStats: true,
    theme: 'gradient',
    notes: ''
  });
  const [showReportSettings, setShowReportSettings] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [isDistributing, setIsDistributing] = useState(false);
  const [lastReportHTML, setLastReportHTML] = useState(null);

  React.useEffect(() => {
    const loadColleges = async () => {
      try {
        const collegeData = await College.list();
        setColleges(collegeData);
      } catch (error) {
        console.error("Error loading colleges:", error);
      }
    };
    loadColleges();
  }, []);

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

    // Enhanced CSV parser with better quote and delimiter handling
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

    // Smart header detection with multiple strategies
    let headerRowIndex = 0;
    let headers = [];

    const headerKeywords = ['SL NO', 'ROLL NO', 'ROLL', 'SERIAL', 'SR', 'PRN', 'STUDENT NAME', 'NAME', 'STUDENT'];

    for (let i = 0; i < Math.min(15, lines.length); i++) {
      const parsed = parseLine(lines[i]);
      const lineUpper = lines[i].toUpperCase();

      // Count how many header keywords this line contains
      const keywordCount = headerKeywords.filter(keyword => lineUpper.includes(keyword)).length;

      // If line has at least 2 key identifiers, it's likely the header
      if (keywordCount >= 2) {
        headerRowIndex = i;
        headers = parsed.map(h => h.trim()).filter(h => h.length > 0);
        console.log(`✅ Found header row at line ${i} (${keywordCount} keywords matched):`, headers.slice(0, 10));
        break;
      }
    }

    if (headers.length === 0) {
      console.log('⚠️ No header row auto-detected, using first non-empty line');
      headerRowIndex = 0;
      headers = parseLine(lines[0]).map(h => h.trim()).filter(h => h.length > 0);
    }

    // Parse data rows with robust error handling
    const data = [];
    for (let i = headerRowIndex + 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);

      // Skip completely empty rows
      if (values.length < 3 || !values.some(v => v && v.trim())) continue;

      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      // Identify name field (could be in different positions)
      let studentName = '';
      for (const key of Object.keys(row)) {
        const keyUpper = key.toUpperCase();
        if (keyUpper.includes('NAME') && !keyUpper.includes('COLLEGE') && !keyUpper.includes('BATCH')) {
          studentName = row[key];
          break;
        }
      }

      // Only include rows with valid student names (at least 3 chars, contains letters)
      if (studentName && studentName.trim().length >= 3 && /[a-zA-Z]/.test(studentName)) {
        data.push(row);
      }
    }

    console.log('✅ CSV Parsed:', { 
      totalLines: lines.length,
      headerIndex: headerRowIndex,
      headers: headers.length, 
      dataRows: data.length,
      sampleHeaders: headers.slice(0, 5),
      firstRow: data[0]
    });

    return { headers, data };
  };

  const cleanAndValidateData = (rawHeaders, rawData) => {
    const cleaningLog = [];

    // Step 1: Enhanced column name standardization
    const columnMapping = {
      'SL NO': ['SL NO', 'SL NO.', 'SL.NO.', 'SLNO', 'SERIAL NO', 'SR NO', 'SR.NO.', 'SR. NO.', 'S.NO.', 'S NO', 'Roll No.', 'Roll No', 'ROLL NO', 'ROLL NO.', 'ROLL', 'SR'],
      'PRN': ['PRN', 'P.R.N.', 'P.R.N', 'PRN NO', 'PRN NUMBER', 'PERMANENT REGISTRATION NUMBER', 'REGISTRATION NO'],
      'STUDENT NAME': ['STUDENT NAME', 'NAME', 'STUDENT', 'FULL NAME', 'NAME OF STUDENT', 'STUDENT FULL NAME', 'Name', 'Student Name', 'Students Name']
    };

    const standardizeColumnName = (col) => {
      if (!col || col.trim() === '') return '';
      const upper = col.toUpperCase().trim();

      for (const [standard, variants] of Object.entries(columnMapping)) {
        for (const variant of variants) {
          if (upper === variant || upper.includes(variant)) {
            if (upper !== standard) cleaningLog.push(`Standardized "${col}" → "${standard}"`);
            return standard;
          }
        }
      }
      return col.trim();
    };

    const headers = rawHeaders.map(h => standardizeColumnName(h)).filter(h => h.length > 0);

    // Step 2: Advanced attendance value normalization
    const normalizeAttendance = (val) => {
      if (!val || val === null || val === undefined) return '';
      const normalized = val.toString().trim().toUpperCase();

      // Present variations (comprehensive list)
      if (['P', 'PRESENT', '✓', '✔', 'YES', 'Y', '1', 'TRUE', 'T', 'ATTENDED', 'HERE'].includes(normalized)) return 'P';

      // Absent variations (comprehensive list)
      if (['A', 'ABSENT', 'X', '✗', '✘', 'NO', 'N', '0', '-', 'FALSE', 'F', 'MISSING', 'NOT PRESENT'].includes(normalized)) return 'A';

      // If it looks like a checkmark or cross symbol
      if (normalized.includes('✓') || normalized.includes('✔')) return 'P';
      if (normalized.includes('✗') || normalized.includes('✘') || normalized.includes('X')) return 'A';

      return val;
    };

    let data = rawData.map((row) => {
      const cleanedRow = {};
      headers.forEach((header, i) => {
        const originalHeader = rawHeaders[i];
        const value = row[originalHeader];

        // Normalize attendance for non-metadata columns
        const isMetadata = ['SL NO', 'PRN', 'STUDENT NAME'].includes(header);
        cleanedRow[header] = isMetadata ? (value || '').toString().trim() : normalizeAttendance(value);
      });
      return cleanedRow;
    });

    // Step 3: Enhanced duplicate removal with fuzzy matching
    const seen = new Set();
    const originalCount = data.length;
    data = data.filter((row) => {
      const name = (row['STUDENT NAME'] || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const prn = (row['PRN'] || '').toLowerCase().trim();
      const key = `${name}_${prn}`;

      if (seen.has(key)) {
        cleaningLog.push(`Removed duplicate: ${row['STUDENT NAME']}`);
        return false;
      }
      seen.add(key);
      return true;
    });

    if (originalCount > data.length) {
      cleaningLog.push(`Removed ${originalCount - data.length} duplicate entries`);
    }

    // Step 4: Enhanced date format standardization
    const standardizeDateColumn = (col) => {
      // Match various date formats
      const dateMatch = col.match(/(\d{1,2})[\.\/-](\d{1,2})[\.\/-](\d{2,4})/);
      if (dateMatch) {
        const day = dateMatch[1].padStart(2, '0');
        const month = dateMatch[2].padStart(2, '0');
        let year = dateMatch[3];
        if (year.length === 2) year = '20' + year;

        // Extract time of day if present
        const timeOfDay = col.match(/(morning|afternoon|evening|am|pm)/i)?.[1] || '';
        const standardized = timeOfDay 
          ? `${day}.${month}.${year} ${timeOfDay.charAt(0).toUpperCase() + timeOfDay.slice(1).toLowerCase()}`
          : `${day}.${month}.${year}`;

        if (standardized !== col) {
          cleaningLog.push(`Date format: "${col}" → "${standardized}"`);
        }
        return standardized;
      }
      return col;
    };

    const finalHeaders = headers.map(h => standardizeDateColumn(h));
    const finalData = data.map(row => {
      const newRow = {};
      headers.forEach((oldHeader, i) => {
        newRow[finalHeaders[i]] = row[oldHeader];
      });
      return newRow;
    });

    cleaningLog.unshift(`✅ Successfully processed ${finalData.length} student records`);
    console.log('🧹 Data Cleaning Report:', {
      originalRows: rawData.length,
      cleanedRows: finalData.length,
      headers: finalHeaders.length,
      changes: cleaningLog
    });

    return { headers: finalHeaders, data: finalData, cleaningLog };
  };

  const analyzeAttendanceTrends = (headers, data) => {
    console.log('🔍 Analyzing attendance trends...', { 
      totalHeaders: headers.length, 
      headers: headers,
      dataLength: data.length,
      sampleRow: data[0],
      allRowKeys: data[0] ? Object.keys(data[0]) : []
    });
    
    // Check if this is a summary CSV with pre-calculated attendance
    // Look for columns like: Total Days, Days Present, Days Absent, Attendance %
    const headerUpper = headers.map(h => h.toUpperCase().trim());
    const hasTotalDays = headerUpper.some(h => h.includes('TOTAL') && h.includes('DAY'));
    const hasDaysPresent = headerUpper.some(h => (h.includes('PRESENT') || h.includes('DAYS PRESENT')));
    const hasAttendancePercent = headerUpper.some(h => h.includes('ATTENDANCE') || h.includes('%'));
    
    const isSummaryFormat = hasTotalDays || hasDaysPresent || hasAttendancePercent;
    
    console.log('📋 Format detection:', { isSummaryFormat, hasTotalDays, hasDaysPresent, hasAttendancePercent });
    
    if (isSummaryFormat) {
      // Handle summary CSV format (Roll No, Student Name, Class, Total Days, Days Present, Days Absent, Attendance %)
      console.log('📊 Detected SUMMARY format CSV with pre-calculated attendance');
      
      // Find column names (case-insensitive matching)
      const findColumn = (keywords) => {
        for (const h of headers) {
          const upper = h.toUpperCase().trim();
          if (keywords.some(k => upper.includes(k) || upper === k)) {
            return h;
          }
        }
        return null;
      };
      
      const rollNoCol = findColumn(['ROLL NO', 'ROLL', 'SL NO', 'SR NO', 'SERIAL']);
      const nameCol = findColumn(['STUDENT NAME', 'NAME', 'STUDENT']);
      const classCol = findColumn(['CLASS', 'BATCH', 'DIVISION']);
      const totalDaysCol = findColumn(['TOTAL DAYS', 'TOTAL']);
      const presentCol = findColumn(['DAYS PRESENT', 'PRESENT']);
      const absentCol = findColumn(['DAYS ABSENT', 'ABSENT']);
      const percentCol = findColumn(['ATTENDANCE %', 'ATTENDANCE', '%', 'PERCENT']);
      
      console.log('📌 Column mapping:', { rollNoCol, nameCol, classCol, totalDaysCol, presentCol, absentCol, percentCol });
      
      // Parse student attendance from summary data
      const studentAttendance = data.map(row => {
        const name = row[nameCol] || '';
        const rollNo = row[rollNoCol] || '';
        const studentClass = row[classCol] || '';
        const totalDays = parseInt(row[totalDaysCol]) || 0;
        const daysPresent = parseInt(row[presentCol]) || 0;
        const daysAbsent = parseInt(row[absentCol]) || 0;
        
        // Get percentage - either from CSV or calculate it
        let percentage = 0;
        if (percentCol && row[percentCol]) {
          // Remove % sign and parse
          percentage = parseFloat(row[percentCol].toString().replace('%', '').trim()) || 0;
        } else if (totalDays > 0) {
          percentage = ((daysPresent / totalDays) * 100);
        }
        
        return {
          name: name.trim(),
          rollNo: rollNo.toString().trim(),
          prn: '',
          studentClass,
          present: daysPresent,
          absent: daysAbsent,
          total: totalDays,
          percentage: percentage.toFixed(1)
        };
      }).filter(s => s.name && s.name.trim().length > 0);
      
      // Sort by attendance percentage (descending)
      studentAttendance.sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));
      
      // Calculate overall statistics
      const totalStudents = studentAttendance.length;
      const avgAttendance = totalStudents > 0 
        ? (studentAttendance.reduce((sum, s) => sum + parseFloat(s.percentage), 0) / totalStudents)
        : 0;
      
      // For summary format, we don't have session-wise data, so create a summary view
      const totalDaysValue = studentAttendance.length > 0 ? studentAttendance[0].total : 0;
      
      // Create attendance distribution as "attendanceByDate" for charts
      const attendanceByDate = [
        { date: 'Overall', present: Math.round(avgAttendance), total: 100, percentage: avgAttendance.toFixed(1) }
      ];
      
      // Add distribution breakdown for better visualization
      const ranges = [
        { range: '90-100%', min: 90, max: 100 },
        { range: '80-89%', min: 80, max: 90 },
        { range: '75-79%', min: 75, max: 80 },
        { range: '70-74%', min: 70, max: 75 },
        { range: '60-69%', min: 60, max: 70 },
        { range: '<60%', min: 0, max: 60 }
      ];
      
      ranges.forEach(r => {
        const count = studentAttendance.filter(s => {
          const p = parseFloat(s.percentage);
          return p >= r.min && p < r.max;
        }).length;
        attendanceByDate.push({
          date: r.range,
          present: count,
          total: totalStudents,
          percentage: totalStudents > 0 ? ((count / totalStudents) * 100).toFixed(1) : 0
        });
      });
      
      console.log('✅ Summary analysis complete:', { 
        students: studentAttendance.length, 
        avgAttendance: avgAttendance.toFixed(1),
        totalDays: totalDaysValue
      });
      
      return { 
        attendanceByDate, 
        studentAttendance, 
        totalSessions: totalDaysValue,
        isSummaryFormat: true
      };
    }
    
    // Original session-wise P/A format handling
    // Extract date columns - look for any column that's NOT metadata columns
    const metadataColumns = ['SL NO', 'PRN', 'STUDENT NAME'];
    const dateColumns = headers.filter(h => {
      // Skip empty headers
      if (!h || h.trim() === '') {
        return false;
      }
      
      const upper = h.toUpperCase().trim();
      
      // Check if this is a metadata column
      const isMetadata = metadataColumns.some(meta => upper === meta || upper.includes(meta));
      if (isMetadata) {
        return false;
      }
      
      // Check if this column has attendance data
      let pCount = 0;
      let aCount = 0;
      let sampleValues = [];
      
      data.forEach((row, idx) => {
        const val = row[h];
        if (idx < 3) sampleValues.push(val); // Collect first 3 values for debugging
        
        if (val !== undefined && val !== null && val !== '') {
          const valStr = val.toString().trim().toUpperCase();
          // Comprehensive attendance value detection
          if (valStr === 'P' || valStr === 'PRESENT' || valStr === '✓' || valStr === '✔' || valStr === 'Y' || valStr === 'YES' || valStr === '1') pCount++;
          if (valStr === 'A' || valStr === 'ABSENT' || valStr === 'X' || valStr === '✗' || valStr === '✘' || valStr === 'N' || valStr === 'NO' || valStr === '-' || valStr === '0') aCount++;
        }
      });
      
      const hasData = pCount > 0 || aCount > 0;
      if (!hasData && h.match(/\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}/)) {
        console.log(`⚠️ Date-like column "${h}" has no P/A values. Sample values:`, sampleValues);
      }
      
      return hasData;
    });

    console.log('📅 Detected date columns:', dateColumns.length, dateColumns.slice(0, 5));

    const students = data.map(row => ({
      name: row['STUDENT NAME'] || row['Student Name'] || row['Name'] || row['NAME'] || row['name'] || '',
      rollNo: row['SL NO'] || row['SL NO.'] || row['Roll No.'] || row['Roll No'] || row['ROLL NO'] || row['Serial No'] || '',
      prn: row['PRN'] || row['prn'] || ''
    })).filter(s => s.name && s.name.trim().length > 0);

    console.log('👥 Detected students:', students.length);
    
    if (dateColumns.length === 0) {
      console.error('❌ No date columns detected!', { 
        headers,
        firstRowKeys: data[0] ? Object.keys(data[0]) : [],
        sampleData: data.slice(0, 2)
      });
      throw new Error('No attendance data detected. Please ensure your file has attendance marked as P/A or Present/Absent in date columns, OR has pre-calculated columns like Total Days, Days Present, Attendance %.');
    }

    // Calculate attendance for each date column
    const attendanceByDate = dateColumns.map(dateCol => {
      let present = 0;
      data.forEach(row => {
        const value = row[dateCol]?.toString().trim().toUpperCase();
        // Comprehensive present value detection
        if (value === 'P' || value === 'PRESENT' || value === '✓' || value === '✔' || value === 'Y' || value === 'YES' || value === '1') {
          present++;
        }
      });
      
      // Simplify date display
      let displayDate = dateCol;
      const dateMatch = dateCol.match(/(\d{1,2}[\.\/-]\d{1,2}[\.\/-]\d{2,4})/);
      if (dateMatch) {
        displayDate = dateMatch[1];
      }
      
      const result = {
        date: displayDate,
        present,
        total: students.length,
        percentage: students.length > 0 ? ((present / students.length) * 100).toFixed(1) : 0
      };
      
      console.log(`📊 Session "${dateCol}": ${result.present}/${result.total} (${result.percentage}%)`);
      
      return result;
    });

    console.log('✅ Attendance by date calculated:', attendanceByDate.length);

    // Calculate individual student attendance
    const studentAttendance = students.map(student => {
      const studentRow = data.find(r => {
        const rowName = (r['STUDENT NAME'] || r['Student Name'] || r['Name'] || r['NAME'] || r['name'] || '').trim();
        return rowName === student.name.trim();
      });
      
      if (!studentRow) return { ...student, present: 0, total: 0, percentage: 0 };

      let present = 0;
      dateColumns.forEach(dateCol => {
        const value = studentRow[dateCol]?.toString().trim().toUpperCase();
        // Comprehensive present value detection
        if (value === 'P' || value === 'PRESENT' || value === '✓' || value === '✔' || value === 'Y' || value === 'YES' || value === '1') {
          present++;
        }
      });

      return {
        ...student,
        present,
        total: dateColumns.length,
        percentage: dateColumns.length > 0 ? ((present / dateColumns.length) * 100).toFixed(1) : 0
      };
    });

    // Sort students by attendance percentage
    studentAttendance.sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));

    console.log('Analysis complete:', { sessions: dateColumns.length, students: students.length });

    return { attendanceByDate, studentAttendance, totalSessions: dateColumns.length, isSummaryFormat: false };
  };

  const exportToCSV = (analysis, batchInfo) => {
    const { attendanceByDate, studentAttendance } = analysis;
    
    const csvRows = [];
    csvRows.push([`Attendance Report - ${batchInfo.academicYear} AIML Division ${batchInfo.division}`]);
    csvRows.push([`KIT's College of Engineering, Kolhapur`]);
    csvRows.push([]);
    
    // Student attendance data
    csvRows.push(['Roll No', 'PRN', 'Student Name', 'Present', 'Total', 'Percentage']);
    studentAttendance.forEach(s => {
      csvRows.push([s.rollNo, s.prn, s.name, s.present, s.total, `${s.percentage}%`]);
    });
    
    csvRows.push([]);
    csvRows.push(['Session-wise Attendance']);
    csvRows.push(['Date', 'Present', 'Total', 'Percentage']);
    attendanceByDate.forEach(d => {
      csvRows.push([d.date, d.present, d.total, `${d.percentage}%`]);
    });
    
    const csvContent = csvRows.map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Attendance_Report_${batchInfo.academicYear}_AIML_Div${batchInfo.division}_${format(new Date(), 'dd-MM-yyyy')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getThemeColors = (theme) => {
    const themes = {
      gradient: {
        bg: 'linear-gradient(-45deg, #667eea, #764ba2, #f093fb, #4facfe)',
        card: 'rgba(255,255,255,0.95)',
        primary: '#667eea',
        secondary: '#764ba2'
      },
      ocean: {
        bg: 'linear-gradient(-45deg, #2193b0, #6dd5ed, #00c6ff, #0072ff)',
        card: 'rgba(255,255,255,0.95)',
        primary: '#2193b0',
        secondary: '#0072ff'
      },
      sunset: {
        bg: 'linear-gradient(-45deg, #f12711, #f5af19, #ff6b6b, #ee5a6f)',
        card: 'rgba(255,255,255,0.95)',
        primary: '#f12711',
        secondary: '#f5af19'
      },
      forest: {
        bg: 'linear-gradient(-45deg, #134e5e, #71b280, #56ab2f, #a8e063)',
        card: 'rgba(255,255,255,0.95)',
        primary: '#134e5e',
        secondary: '#56ab2f'
      }
    };
    return themes[theme] || themes.gradient;
  };

  const generateHTMLReport = (analysis, batchInfo, config) => {
    const { attendanceByDate, studentAttendance, totalSessions, isSummaryFormat } = analysis;
    const theme = getThemeColors(config.theme);
    
    // Calculate overall attendance from student data for accuracy
    const overallAttendance = studentAttendance.length > 0 
      ? (studentAttendance.reduce((sum, s) => sum + parseFloat(s.percentage), 0) / studentAttendance.length).toFixed(1)
      : 0;

    const topPerformers = studentAttendance.slice(0, 10);
    const needsAttention = studentAttendance.filter(s => parseFloat(s.percentage) < 75).slice(0, 10);
    const excellent = studentAttendance.filter(s => parseFloat(s.percentage) >= 90).length;
    const good = studentAttendance.filter(s => parseFloat(s.percentage) >= 75 && parseFloat(s.percentage) < 90).length;
    const average = studentAttendance.filter(s => parseFloat(s.percentage) >= 60 && parseFloat(s.percentage) < 75).length;
    const poor = studentAttendance.filter(s => parseFloat(s.percentage) < 60).length;

    // For summary format, create distribution chart data
    const chartData = isSummaryFormat 
      ? attendanceByDate.slice(1).map(d => `['${d.date.replace(/'/g, "\\'")}', ${d.present}]`).join(',')
      : attendanceByDate.map(d => `['${d.date.replace(/'/g, "\\'")}', ${parseFloat(d.percentage)}]`).join(',');
    
    const studentChartData = studentAttendance.slice(0, 20).map(s => 
      `['${s.name.substring(0, 20).replace(/'/g, "\\'")}', ${parseFloat(s.percentage)}]`
    ).join(',');
    const pieChartData = `['Excellent (≥90%)', ${excellent}], ['Good (75-89%)', ${good}], ['Average (60-74%)', ${average}], ['Poor (<60%)', ${poor}]`;
    
    // Distribution by attendance range (accurate student counts)
    const below75 = studentAttendance.filter(s => parseFloat(s.percentage) < 75).length;
    const between75_89 = studentAttendance.filter(s => parseFloat(s.percentage) >= 75 && parseFloat(s.percentage) < 90).length;
    const above90 = studentAttendance.filter(s => parseFloat(s.percentage) >= 90).length;
    
    const attendanceRanges = [
      { range: '90-100%', count: studentAttendance.filter(s => parseFloat(s.percentage) >= 90).length },
      { range: '80-89%', count: studentAttendance.filter(s => parseFloat(s.percentage) >= 80 && parseFloat(s.percentage) < 90).length },
      { range: '70-79%', count: studentAttendance.filter(s => parseFloat(s.percentage) >= 70 && parseFloat(s.percentage) < 80).length },
      { range: '60-69%', count: studentAttendance.filter(s => parseFloat(s.percentage) >= 60 && parseFloat(s.percentage) < 70).length },
      { range: '<60%', count: studentAttendance.filter(s => parseFloat(s.percentage) < 60).length }
    ];
    const distributionChartData = attendanceRanges.map(r => `['${r.range}', ${r.count}]`).join(',');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Attendance Analysis - ${batchInfo.academicYear} AIML Div ${batchInfo.division}</title>
    <script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: ${theme.bg};
            background-size: 400% 400%;
            animation: gradientShift 15s ease infinite;
            padding: 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            animation: fadeIn 1s ease-in;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .header {
            background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%);
            backdrop-filter: blur(10px);
            padding: 40px;
            border-radius: 25px;
            box-shadow: 0 25px 70px rgba(0,0,0,0.4);
            text-align: center;
            margin-bottom: 30px;
            animation: slideDown 0.8s ease-out;
            border: 2px solid rgba(255,255,255,0.3);
        }
        @keyframes slideDown {
            from { transform: translateY(-50px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        .header h1 {
            font-size: 3em;
            margin-bottom: 15px;
            background: linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 50%, ${theme.primary} 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            font-weight: 900;
            text-shadow: 2px 2px 20px rgba(102, 126, 234, 0.3);
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
        .info-label {
            font-size: 0.85em;
            color: #666;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .info-value {
            font-size: 1.2em;
            color: #333;
            font-weight: bold;
            margin-top: 5px;
        }
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
            animation: scaleIn 0.5s ease-out;
            animation-fill-mode: both;
            transition: all 0.4s ease;
            border: 2px solid rgba(255,255,255,0.5);
        }
        .stat-card:hover {
            transform: translateY(-10px) scale(1.02);
            box-shadow: 0 20px 50px rgba(0,0,0,0.35);
            border-color: rgba(102, 126, 234, 0.6);
        }
        @keyframes scaleIn {
            from { transform: scale(0.8); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
        .stat-card:nth-child(1) { animation-delay: 0.1s; }
        .stat-card:nth-child(2) { animation-delay: 0.2s; }
        .stat-card:nth-child(3) { animation-delay: 0.3s; }
        .stat-card:nth-child(4) { animation-delay: 0.4s; }
        .stat-icon {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        .stat-label {
            color: #666;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 600;
        }
        .stat-value {
            font-size: 2.5em;
            font-weight: bold;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-top: 10px;
        }
        .chart-container {
            background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%);
            backdrop-filter: blur(10px);
            padding: 35px;
            border-radius: 25px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.3);
            margin-bottom: 30px;
            animation: fadeInUp 0.8s ease-out;
            border: 2px solid rgba(255,255,255,0.4);
        }
        @keyframes fadeInUp {
            from { transform: translateY(30px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        .chart-title {
            font-size: 1.5em;
            color: #333;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 3px solid #667eea;
        }
        .students-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }
        .student-card {
            background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%);
            backdrop-filter: blur(10px);
            padding: 25px;
            border-radius: 18px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
            border-left: 6px solid transparent;
            border-image: linear-gradient(135deg, #667eea, #764ba2) 1;
            transition: all 0.4s ease;
            animation: fadeInUp 0.5s ease-out;
            animation-fill-mode: both;
            border: 2px solid rgba(255,255,255,0.3);
            border-left: 6px solid #667eea;
        }
        .student-card:hover {
            transform: translateX(10px) scale(1.03);
            box-shadow: 0 15px 35px rgba(0,0,0,0.25);
            border-left-color: #764ba2;
        }
        .student-name {
            font-weight: bold;
            font-size: 1.1em;
            color: #333;
            margin-bottom: 5px;
        }
        .student-details {
            font-size: 0.9em;
            color: #666;
            margin-bottom: 10px;
        }
        .progress-bar {
            height: 8px;
            background: #e0e0e0;
            border-radius: 10px;
            overflow: hidden;
            margin-top: 10px;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            transition: width 1s ease-out;
            animation: fillBar 1.5s ease-out;
        }
        @keyframes fillBar {
            from { width: 0; }
        }
        .percentage {
            font-size: 1.2em;
            font-weight: bold;
            color: #667eea;
            margin-top: 5px;
        }
        .attention {
            border-left-color: #e74c3c;
        }
        .attention .progress-fill {
            background: linear-gradient(90deg, #e74c3c 0%, #c0392b 100%);
        }
        .attention .percentage {
            color: #e74c3c;
        }
        .section-title {
            font-size: 2.2em;
            color: white;
            margin: 40px 0 25px 0;
            font-weight: 900;
            text-shadow: 3px 3px 10px rgba(0,0,0,0.5);
            background: linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.8) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.8; }
        }
        .footer {
            background: white;
            padding: 20px;
            border-radius: 15px;
            text-align: center;
            margin-top: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .footer p {
            color: #666;
            margin: 5px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Advanced Attendance Analysis Report</h1>
            <div class="batch-info">
                <div class="info-item">
                    <div class="info-label">College</div>
                    <div class="info-value">KIT Kolhapur</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Branch</div>
                    <div class="info-value">AIML</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Academic Year</div>
                    <div class="info-value">${batchInfo.academicYear}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Division</div>
                    <div class="info-value">${batchInfo.division}</div>
                </div>
            </div>
            </div>

            ${config.aiInsights ? `
            <div class="chart-container" style="background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);">
                <h2 class="chart-title">🤖 AI-Generated Insights & Recommendations</h2>
                <div style="white-space: pre-wrap; line-height: 1.8; color: #333; font-size: 15px;">${config.aiInsights}</div>
            </div>
            ` : ''}

            <div class="chart-container" style="background: linear-gradient(135deg, rgba(255,215,0,0.1) 0%, rgba(255,140,0,0.1) 100%);">
                <h2 class="chart-title">📊 Batch Attendance Summary</h2>
                <div style="line-height: 1.8; color: #333;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-top: 20px;">
                        <div style="padding: 20px; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <div style="font-size: 14px; color: #666; font-weight: 600; text-transform: uppercase; margin-bottom: 8px;">Overall Performance</div>
                            <div style="font-size: 32px; font-weight: bold; color: ${theme.primary};">${overallAttendance}%</div>
                            <div style="font-size: 12px; color: #888; margin-top: 5px;">Average attendance rate</div>
                        </div>
                        <div style="padding: 20px; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <div style="font-size: 14px; color: #666; font-weight: 600; text-transform: uppercase; margin-bottom: 8px;">Total Students</div>
                            <div style="font-size: 32px; font-weight: bold; color: ${theme.secondary};">${studentAttendance.length}</div>
                            <div style="font-size: 12px; color: #888; margin-top: 5px;">Active in batch</div>
                        </div>
                        <div style="padding: 20px; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <div style="font-size: 14px; color: #666; font-weight: 600; text-transform: uppercase; margin-bottom: 8px;">Sessions Analyzed</div>
                            <div style="font-size: 32px; font-weight: bold; color: #10b981;">${totalSessions}</div>
                            <div style="font-size: 12px; color: #888; margin-top: 5px;">Classes tracked</div>
                        </div>
                        <div style="padding: 20px; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <div style="font-size: 14px; color: #666; font-weight: 600; text-transform: uppercase; margin-bottom: 8px;">Risk Students</div>
                            <div style="font-size: 32px; font-weight: bold; color: #ef4444;">${needsAttention.length}</div>
                            <div style="font-size: 12px; color: #888; margin-top: 5px;">Below 75% attendance</div>
                        </div>
                    </div>

                    <div style="margin-top: 30px; padding: 20px; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                       <h3 style="font-size: 18px; font-weight: bold; color: #333; margin-bottom: 15px;">📈 Performance Distribution</h3>
                       <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                           <div style="padding: 15px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 10px; color: white;">
                               <div style="font-size: 28px; font-weight: bold;">${excellent}</div>
                               <div style="font-size: 13px; opacity: 0.9;">Excellent (≥90%)</div>
                               <div style="font-size: 11px; opacity: 0.7; margin-top: 5px;">${studentAttendance.length > 0 ? ((excellent / studentAttendance.length) * 100).toFixed(1) : 0}% of students</div>
                           </div>
                           <div style="padding: 15px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 10px; color: white;">
                               <div style="font-size: 28px; font-weight: bold;">${good}</div>
                               <div style="font-size: 13px; opacity: 0.9;">Good (75-89%)</div>
                               <div style="font-size: 11px; opacity: 0.7; margin-top: 5px;">${studentAttendance.length > 0 ? ((good / studentAttendance.length) * 100).toFixed(1) : 0}% of students</div>
                           </div>
                           <div style="padding: 15px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 10px; color: white;">
                               <div style="font-size: 28px; font-weight: bold;">${average}</div>
                               <div style="font-size: 13px; opacity: 0.9;">Average (60-74%)</div>
                               <div style="font-size: 11px; opacity: 0.7; margin-top: 5px;">${studentAttendance.length > 0 ? ((average / studentAttendance.length) * 100).toFixed(1) : 0}% of students</div>
                           </div>
                           <div style="padding: 15px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 10px; color: white;">
                               <div style="font-size: 28px; font-weight: bold;">${poor}</div>
                               <div style="font-size: 13px; opacity: 0.9;">Poor (<60%)</div>
                               <div style="font-size: 11px; opacity: 0.7; margin-top: 5px;">${studentAttendance.length > 0 ? ((poor / studentAttendance.length) * 100).toFixed(1) : 0}% of students</div>
                           </div>
                       </div>
                    </div>
                </div>
            </div>

            ${config.notes ? `
            <div class="chart-container">
                <h2 class="chart-title">📝 Custom Notes & Observations</h2>
                <div style="white-space: pre-wrap; line-height: 1.6; color: #333;">${config.notes}</div>
            </div>
            ` : ''}

            ${config.includeStats ? `
            <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon">👥</div>
                <div class="stat-label">Total Students</div>
                <div class="stat-value">${studentAttendance.length}</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📅</div>
                <div class="stat-label">Total Sessions</div>
                <div class="stat-value">${totalSessions}</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📈</div>
                <div class="stat-label">Overall Attendance</div>
                <div class="stat-value">${overallAttendance}%</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">⚠️</div>
                <div class="stat-label">Below 75%</div>
                <div class="stat-value">${needsAttention.length}</div>
            </div>
            </div>
            ` : ''}

            ${config.includeCharts ? `
            ${!isSummaryFormat ? `
            <div class="chart-container">
                <h2 class="chart-title">📊 Attendance Trend Over Time (Line Chart)</h2>
                <div id="line_chart" style="width: 100%; height: 400px;"></div>
            </div>
            ` : ''}

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
                <div class="chart-container">
                    <h2 class="chart-title">📊 Performance Distribution (Pie Chart)</h2>
                    <div id="pie_chart" style="width: 100%; height: 400px;"></div>
                </div>
                <div class="chart-container">
                    <h2 class="chart-title">📊 Attendance Range Distribution</h2>
                    <div id="distribution_chart" style="width: 100%; height: 400px;"></div>
                </div>
            </div>

            <div class="chart-container">
                <h2 class="chart-title">📊 Student-wise Performance (Bar Chart - Top 20)</h2>
                <div id="bar_chart" style="width: 100%; height: 500px;"></div>
            </div>

            ${!isSummaryFormat ? `
            <div class="chart-container">
                <h2 class="chart-title">📊 Session-wise Attendance Comparison (Area Chart)</h2>
                <div id="area_chart" style="width: 100%; height: 400px;"></div>
            </div>
            ` : ''}
            ` : ''}

            ${config.includeTopPerformers ? `
            <h2 class="section-title">🏆 Top Performers (>90% Attendance)</h2>
        <div class="students-grid">
            ${topPerformers.map((student, index) => `
                <div class="student-card" style="animation-delay: ${index * 0.05}s;">
                    <div class="student-name">${student.name}</div>
                    <div class="student-details">Roll: ${student.rollNo} | PRN: ${student.prn}</div>
                    <div class="percentage">${student.percentage}%</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${student.percentage}%;"></div>
                    </div>
                    <div style="margin-top: 5px; color: #666; font-size: 0.85em;">
                        ${student.present}/${student.total} sessions
                    </div>
                </div>
            `).join('')}
            </div>
            ` : ''}

            ${config.includeAtRisk && needsAttention.length > 0 ? `
        <h2 class="section-title">⚠️ Students Needing Attention (<75% Attendance)</h2>
        <div class="students-grid">
            ${needsAttention.map((student, index) => `
                <div class="student-card attention" style="animation-delay: ${index * 0.05}s;">
                    <div class="student-name">${student.name}</div>
                    <div class="student-details">Roll: ${student.rollNo} | PRN: ${student.prn}</div>
                    <div class="percentage">${student.percentage}%</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${student.percentage}%;"></div>
                    </div>
                    <div style="margin-top: 5px; color: #666; font-size: 0.85em;">
                        ${student.present}/${student.total} sessions
                    </div>
                </div>
            `).join('')}
        </div>
        ` : ''}

        <div class="footer">
            <p><strong>Report Generated:</strong> ${format(new Date(), 'PPP p')}</p>
            <p><strong>Powered by APT-TECH</strong> | Advanced Attendance Analytics System</p>
            <p style="margin-top: 10px; font-size: 0.9em; color: #999;">This is an automated analysis report</p>
        </div>
    </div>

    <script type="text/javascript">
        google.charts.load('current', {'packages':['corechart']});
        google.charts.setOnLoadCallback(drawCharts);

        function drawCharts() {
            ${!isSummaryFormat ? `
            // Line Chart (only for session-wise data)
            var lineData = google.visualization.arrayToDataTable([
                ['Date', 'Attendance %'],
                ${chartData}
            ]);

            var lineOptions = {
                title: 'Session-wise Attendance Trend',
                curveType: 'function',
                legend: { position: 'bottom' },
                colors: ['${theme.primary}'],
                animation: {
                    startup: true,
                    duration: 1000,
                    easing: 'out'
                },
                vAxis: { 
                    title: 'Attendance %',
                    minValue: 0,
                    maxValue: 100,
                    gridlines: { color: '#f0f0f0' }
                },
                hAxis: { 
                    title: 'Session Date',
                    slantedText: true,
                    slantedTextAngle: 45
                },
                pointSize: 5,
                lineWidth: 3
            };

            var lineChart = new google.visualization.LineChart(document.getElementById('line_chart'));
            if (lineChart) lineChart.draw(lineData, lineOptions);
            ` : ''}

            // Pie Chart
            var pieData = google.visualization.arrayToDataTable([
                ['Category', 'Students'],
                ${pieChartData}
            ]);

            var pieOptions = {
                title: 'Student Performance Categories',
                colors: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'],
                pieHole: 0.4,
                animation: {
                    startup: true,
                    duration: 1000,
                    easing: 'out'
                },
                pieSliceText: 'value',
                legend: { position: 'bottom' }
            };

            var pieChart = new google.visualization.PieChart(document.getElementById('pie_chart'));
            pieChart.draw(pieData, pieOptions);

            // Distribution Chart
            var distData = google.visualization.arrayToDataTable([
                ['Range', 'Students'],
                ${distributionChartData}
            ]);

            var distOptions = {
                title: 'Students by Attendance Range',
                colors: ['#10b981', '#3b82f6', '#f59e0b', '#f59e0b', '#ef4444'],
                animation: {
                    startup: true,
                    duration: 1000,
                    easing: 'out'
                },
                vAxis: { 
                    title: 'Number of Students',
                    gridlines: { color: '#f0f0f0' },
                    minValue: 0
                },
                hAxis: { 
                    title: 'Attendance Range'
                },
                legend: { position: 'none' }
            };

            var distChart = new google.visualization.ColumnChart(document.getElementById('distribution_chart'));
            if (distChart) distChart.draw(distData, distOptions);

            // Bar Chart
            var barData = google.visualization.arrayToDataTable([
                ['Student', 'Attendance %'],
                ${studentChartData}
            ]);

            var barOptions = {
                title: 'Top 20 Students by Attendance',
                legend: { position: 'none' },
                colors: ['${theme.primary}'],
                animation: {
                    startup: true,
                    duration: 1000,
                    easing: 'out'
                },
                vAxis: { 
                    title: 'Attendance %',
                    minValue: 0,
                    maxValue: 100,
                    gridlines: { color: '#f0f0f0' }
                },
                hAxis: { 
                    title: 'Student Name',
                    slantedText: true,
                    slantedTextAngle: 45
                }
            };

            var barChart = new google.visualization.ColumnChart(document.getElementById('bar_chart'));
            barChart.draw(barData, barOptions);

            ${!isSummaryFormat ? `
            // Area Chart (only for session-wise data)
            var areaData = google.visualization.arrayToDataTable([
                ['Date', 'Attendance %'],
                ${chartData}
            ]);

            var areaOptions = {
                title: 'Attendance Trend (Area View)',
                legend: { position: 'bottom' },
                colors: ['${theme.secondary}'],
                animation: {
                    startup: true,
                    duration: 1000,
                    easing: 'out'
                },
                vAxis: { 
                    title: 'Attendance %',
                    minValue: 0,
                    maxValue: 100,
                    gridlines: { color: '#f0f0f0' }
                },
                hAxis: { 
                    title: 'Session Date',
                    slantedText: true,
                    slantedTextAngle: 45
                },
                areaOpacity: 0.4
            };

            var areaChart = new google.visualization.AreaChart(document.getElementById('area_chart'));
            if (areaChart) areaChart.draw(areaData, areaOptions);
            ` : ''}
        }

        // Responsive charts
        window.addEventListener('resize', function() {
            drawCharts();
        });
    </script>
</body>
</html>`;
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setMessage({ type: "error", text: "Please select a file to analyze" });
      return;
    }

    if (!formData.academicYear || !formData.division) {
      setMessage({ type: "error", text: "Please select Academic Year and Division" });
      return;
    }

    setIsProcessing(true);
    setMessage({ type: "info", text: "🔄 Processing your file..." });

    try {
      let headers, data;

      // Use backend function for all file types (CSV, Excel, PDF)
      setMessage({ type: "info", text: "📄 Uploading file for robust parsing..." });
      
      const { file_url } = await UploadFile({ file: selectedFile });
      
      // Determine file type
      let fileType = 'csv';
      if (selectedFile.name.match(/\.(xlsx?|xls)$/i)) fileType = 'excel';
      else if (selectedFile.name.endsWith('.pdf')) fileType = 'pdf';
      else if (selectedFile.type === 'text/html' || selectedFile.name.match(/\.html?$/i)) fileType = 'html';
      
      setMessage({ type: "info", text: `🔍 Analyzing ${fileType.toUpperCase()} file with enhanced parser...` });
      
      const parseResult = await parseAttendanceFile({ file_url, file_type: fileType });
      
      if (!parseResult.data.success || !parseResult.data.students || parseResult.data.students.length === 0) {
        throw new Error(parseResult.data.error || "No student data found in file");
      }
      
      const parsedStudents = parseResult.data.students;
      console.log('✅ Backend parsed:', parsedStudents.length, 'students');
      
      // Convert backend result to frontend format
      headers = ['SL NO', 'PRN', 'STUDENT NAME'];
      
      // Get unique dates from attendance records
      const allDates = new Set();
      parsedStudents.forEach(s => {
        if (s.attendance_records) {
          s.attendance_records.forEach(r => allDates.add(r.date));
        }
      });
      const dateColumns = Array.from(allDates);
      headers.push(...dateColumns);
      
      // Build data rows
      data = parsedStudents.map(s => {
        const row = {
          'SL NO': s.roll_no,
          'PRN': s.prn,
          'STUDENT NAME': s.name
        };
        
        // Map attendance records to date columns
        dateColumns.forEach(date => {
          const record = s.attendance_records?.find(r => r.date === date);
          row[date] = record ? (record.status === 'present' ? 'P' : 'A') : '';
        });
        
        return row;
      });
      
      console.log('✅ Converted to analysis format:', { headers: headers.length, students: data.length });
      setMessage({ type: "success", text: `✅ Parsed ${data.length} students with ${dateColumns.length} sessions!` });
      
      // Skip the old parsing logic
      if (false) {
      // Handle PDF files with OCR (OLD LOGIC - SKIPPED)
      if (selectedFile.type === 'application/pdf' || selectedFile.name.endsWith('.pdf')) {
        setMessage({ type: "info", text: "📄 Uploading PDF for OCR analysis..." });

        const { file_url } = await UploadFile({ file: selectedFile });

        setMessage({ type: "info", text: "🔍 Extracting attendance data from PDF..." });

        const ocrSchema = {
          type: "object",
          properties: {
            headers: {
              type: "array",
              description: "Extract ALL column headers from the table in exact order. Include: SL NO, PRN, STUDENT NAME, and ALL date columns (like '08.12.2025', '09.12.2025', '10.12.2025', etc.). List EVERY column you see.",
              items: { type: "string" }
            },
            students: {
              type: "array",
              description: "Extract EVERY student row with ALL data. For each student, extract data for EVERY column in the same order as headers.",
              items: {
                type: "object",
                properties: {
                  sl_no: { 
                    type: "string", 
                    description: "Serial number / Roll No from first column" 
                  },
                  prn: { 
                    type: "string", 
                    description: "PRN number from second column" 
                  },
                  name: { 
                    type: "string", 
                    description: "Full student name from third column" 
                  },
                  attendance_data: {
                    type: "array",
                    description: "Array of attendance values for each date column IN ORDER. Use 'P' for present (checkmark/tick), 'A' for absent (cross/X), or empty string if blank. Include value for EVERY date column.",
                    items: { type: "string" }
                  }
                },
                required: ["name", "attendance_data"]
              }
            }
          },
          required: ["headers", "students"]
        };

        const ocrResult = await ExtractDataFromUploadedFile({
          file_url,
          json_schema: ocrSchema
        });

        if (ocrResult.status !== "success" || !ocrResult.output?.students || !ocrResult.output?.headers) {
          throw new Error("Failed to extract data from PDF. The file structure may be too complex.");
        }

        // Convert OCR result to CSV-like format using the new structure
        const extractedHeaders = ocrResult.output.headers;
        const students = ocrResult.output.students;

        if (!students || students.length === 0) {
          throw new Error("No student records found in PDF. Please verify the file format.");
        }

        console.log('✅ OCR extracted:', { 
          studentCount: students.length,
          headerCount: extractedHeaders.length,
          headers: extractedHeaders,
          sampleStudent: students[0]
        });

        // Filter date columns (skip metadata columns)
        const metadataKeywords = ['SL NO', 'PRN', 'STUDENT NAME', 'ROLL', 'NAME', 'SERIAL'];
        const dateColumns = extractedHeaders.filter(h => {
          const upper = h.toUpperCase();
          return !metadataKeywords.some(keyword => upper.includes(keyword)) && h.trim().length > 0;
        });

        console.log('📅 Detected date columns:', dateColumns.length, dateColumns.slice(0, 10));

        if (dateColumns.length === 0) {
          throw new Error("No attendance date columns found in PDF. Please ensure the file has date columns with attendance marked.");
        }

        // Build CSV-like structure
        headers = ['SL NO', 'PRN', 'STUDENT NAME', ...dateColumns];
        data = students.map(student => {
          const row = {
            'SL NO': student.sl_no || '',
            'PRN': student.prn || '',
            'STUDENT NAME': student.name || ''
          };

          // Map attendance data to date columns
          const attendanceData = student.attendance_data || [];
          dateColumns.forEach((dateCol, idx) => {
            row[dateCol] = attendanceData[idx] || '';
          });

          return row;
        }).filter(row => row['STUDENT NAME'] && row['STUDENT NAME'].trim().length > 2);

        console.log('✅ Final structured data:', { 
          students: data.length, 
          sessions: dateColumns.length,
          headers,
          sample: data[0]
        });

        if (data.length === 0) {
          throw new Error("No valid student records found after processing");
        }

        setMessage({ type: "info", text: `✅ Extracted ${data.length} students with ${dateColumns.length} attendance sessions!` });
        }
      }

      if (data.length === 0) {
        setMessage({ type: "error", text: "No data found in the uploaded file" });
        setIsProcessing(false);
        return;
      }

      console.log('Data ready for cleaning:', { headers, dataCount: data.length });

      setMessage({ type: "info", text: "🧹 Cleaning and validating data..." });

      // Clean and validate the data
      const cleaned = cleanAndValidateData(headers, data);
      headers = cleaned.headers;
      data = cleaned.data;

      console.log('Data after cleaning:', { headers, dataCount: data.length, cleaningLog: cleaned.cleaningLog });

      if (cleaned.cleaningLog.length > 1) {
        setMessage({ 
          type: "info", 
          text: `✅ ${cleaned.cleaningLog[0]} | ${cleaned.cleaningLog.slice(1, 3).join(', ')}` 
        });
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      setMessage({ type: "info", text: "📊 Analyzing attendance trends..." });

      const analysis = analyzeAttendanceTrends(headers, data);

      console.log('Analysis results:', { 
        totalStudents: analysis.studentAttendance.length, 
        totalSessions: analysis.totalSessions,
        attendanceByDate: analysis.attendanceByDate.length
      });

      if (analysis.totalSessions === 0 || analysis.studentAttendance.length === 0) {
        setMessage({ 
          type: "error", 
          text: "Could not detect attendance data in the file. Please ensure your file has student names and attendance columns marked with 'P', 'A', 'Present', or 'Absent'." 
        });
        setIsProcessing(false);
        return;
      }

      // Generate AI insights
      setMessage({ type: "info", text: "🤖 Generating AI insights and recommendations..." });

      const studentAttendance = analysis.studentAttendance;
      const attendanceByDate = analysis.attendanceByDate;
      
      // Calculate accurate overall attendance from student data
      const overallAttendance = studentAttendance.length > 0 
        ? (studentAttendance.reduce((sum, s) => sum + parseFloat(s.percentage), 0) / studentAttendance.length).toFixed(1)
        : 0;
      
      try {
        const insightsPrompt = `Analyze this attendance data and provide detailed insights and recommendations:

      College: KIT's College of Engineering, Kolhapur
      Branch: Artificial Intelligence & Machine Learning (AIML)
      Academic Year: ${formData.academicYear}
      Division: ${formData.division}
      Total Students: ${studentAttendance.length}
      Total Days/Sessions: ${analysis.totalSessions}
      Overall Average Attendance: ${overallAttendance}%

      Performance Distribution:
      - Excellent (≥90%): ${studentAttendance.filter(s => parseFloat(s.percentage) >= 90).length} students
      - Good (75-89%): ${studentAttendance.filter(s => parseFloat(s.percentage) >= 75 && parseFloat(s.percentage) < 90).length} students
      - Average (60-74%): ${studentAttendance.filter(s => parseFloat(s.percentage) >= 60 && parseFloat(s.percentage) < 75).length} students
      - Poor (<60%): ${studentAttendance.filter(s => parseFloat(s.percentage) < 60).length} students

      Top 3 Performers: ${studentAttendance.slice(0, 3).map(s => `${s.name} (${s.percentage}%)`).join(', ')}
      Students Below 75%: ${studentAttendance.filter(s => parseFloat(s.percentage) < 75).length}

      Provide:
      1. Overall batch performance analysis
      2. Key trends and patterns observed
      3. Areas of concern
      4. Specific actionable recommendations for improvement
      5. Recognition suggestions for top performers

      Format your response in a clear, professional manner suitable for an educational report.`;

        const aiResponse = await InvokeLLM({
          prompt: insightsPrompt,
          add_context_from_internet: false
        });

        setReportConfig(prev => ({ ...prev, aiInsights: aiResponse }));
      } catch (error) {
        console.error("Failed to generate AI insights:", error);
      }

      // Store analysis data for export options
      setAnalysisData(analysis);
      setShowReportSettings(true);
      setMessage({ 
        type: "success", 
        text: `✅ Analysis complete! AI insights generated. Configure your report settings.` 
      });
      setIsProcessing(false);
    } catch (error) {
      console.error("Analysis error:", error);
      setMessage({ type: "error", text: `Error analyzing file: ${error.message}` });
      setIsProcessing(false);
    }
    };

    const handleExportHTML = () => {
    if (!analysisData) return;

    const htmlReport = generateHTMLReport(analysisData, formData, reportConfig);
    setLastReportHTML(htmlReport);
    
    const blob = new Blob([htmlReport], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Attendance_Analysis_${formData.academicYear}_AIML_Div${formData.division}_${format(new Date(), 'dd-MM-yyyy')}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setMessage({ type: "success", text: "HTML report downloaded!" });
    };

    const handleAutoDistribute = async () => {
      if (!analysisData || !lastReportHTML) {
        setMessage({ type: "error", text: "Please generate HTML report first" });
        return;
      }

      setIsDistributing(true);
      setMessage({ type: "info", text: "🤖 AI analyzing report and determining distribution strategy..." });

      try {
        const response = await distributeAnalysisReport({
          reportType: "Advanced Attendance Analysis",
          reportHTML: lastReportHTML,
          reportTitle: `Attendance Analysis - ${formData.academicYear} AIML Division ${formData.division}`,
          batchInfo: formData,
          summary: analysisData.studentAttendance ? {
            totalStudents: analysisData.studentAttendance.length,
            avgAttendance: analysisData.studentAttendance.length > 0 
              ? (analysisData.studentAttendance.reduce((sum, s) => sum + parseFloat(s.percentage), 0) / analysisData.studentAttendance.length).toFixed(1)
              : 0,
            below75: analysisData.studentAttendance.filter(s => parseFloat(s.percentage) < 75).length
          } : {}
        });

        if (response.data.success) {
          const { distribution, ai_decision } = response.data;
          setMessage({ 
            type: "success", 
            text: `✅ Report distributed! ${distribution.emails_sent} emails sent. AI Reason: ${ai_decision.reason}` 
          });
        } else {
          setMessage({ type: "error", text: "Distribution failed: " + response.data.error });
        }
      } catch (error) {
        console.error('Distribution error:', error);
        setMessage({ type: "error", text: "Failed to distribute report: " + error.message });
      }

      setIsDistributing(false);
    };

    const handleExportCSV = () => {
    if (!analysisData) return;
    exportToCSV(analysisData, formData);
    setMessage({ type: "success", text: "CSV report downloaded!" });
    };

    const handleNewAnalysis = () => {
    setAnalysisData(null);
    setShowReportSettings(false);
    setSelectedFile(null);
    setMessage(null);
    };

    return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl("Dashboard"))}
            className="bg-white flex-shrink-0"
          >
            <span className="text-xl">←</span>
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2 sm:gap-3">
              <TrendingUp className="w-6 sm:w-8 h-6 sm:h-8 text-purple-600" />
              Advanced Attendance Analysis
            </h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">Upload data and generate analytical reports</p>
          </div>
        </div>

        {message && (
          <Alert className={`mb-6 ${message.type === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
            <AlertDescription className={message.type === 'error' ? 'text-red-800' : 'text-green-800'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <Card className="shadow-xl border-2 border-purple-100">
          <CardHeader className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-6 h-6" />
              Upload & Analyze Attendance Data
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6">
            {/* Batch Details Form */}
            <div className="space-y-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileSpreadsheet className="w-4 sm:w-5 h-4 sm:h-5" />
                Step 1: Enter Batch Details
              </h3>
              {/* Locked Configuration Display */}
              <Alert className="bg-blue-50 border-blue-200 mb-4">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 text-sm">
                  <div className="font-semibold mb-1">🔒 Analysis Scope</div>
                  <div className="text-xs space-y-0.5">
                    <div>🏛️ <strong>College:</strong> KIT's College of Engineering, Kolhapur</div>
                    <div>🔬 <strong>Branch:</strong> AIML Department</div>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="font-semibold text-sm sm:text-base">Academic Year *</Label>
                  <Select value={formData.academicYear} onValueChange={(value) => setFormData({...formData, academicYear: value})}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {["FE", "SE", "TE", "BE"].map(year => (
                        <SelectItem key={year} value={year}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="font-semibold text-sm sm:text-base">Division *</Label>
                  <Select value={formData.division} onValueChange={(value) => setFormData({...formData, division: value})}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select division" />
                    </SelectTrigger>
                    <SelectContent>
                      {["A", "B", "C"].map(div => (
                        <SelectItem key={div} value={div}>{div}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 sm:pt-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <Upload className="w-4 sm:w-5 h-4 sm:h-5" />
                Step 2: Upload Attendance File
              </h3>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-purple-300 rounded-lg p-6 sm:p-8 text-center hover:border-purple-500 transition-colors cursor-pointer bg-gradient-to-br from-purple-50 to-blue-50"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.pdf,.html,.htm"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <FileSpreadsheet className="w-16 h-16 mx-auto text-purple-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {selectedFile ? selectedFile.name : "Drop your attendance file here"}
                </h3>
                <p className="text-gray-600 text-sm">
                  Supports PDF (OCR), CSV, Excel, and HTML files
                </p>
                <Button className="mt-4 bg-purple-600 hover:bg-purple-700">
                  <Upload className="w-4 h-4 mr-2" />
                  Browse Files
                </Button>
              </div>
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={isProcessing || !selectedFile}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-base sm:text-lg py-4 sm:py-6 shadow-lg"
            >
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="animate-spin w-5 h-5" />
                  {message?.text || "Analyzing Data..."}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Generate Stunning Analysis Report
                  <Download className="w-5 h-5" />
                </div>
              )}
            </Button>

            <div className="mt-6 p-5 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-purple-200 shadow-inner">
              <h4 className="font-bold text-purple-900 mb-3 text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                📊 What You'll Get:
              </h4>
              <ul className="text-sm text-purple-800 space-y-2">
                <li className="flex items-center gap-2">✨ <strong>Stunning animated gradient HTML report</strong></li>
                <li className="flex items-center gap-2">📈 <strong>Interactive Google Charts</strong> for attendance trends</li>
                <li className="flex items-center gap-2">👥 <strong>Student-wise performance</strong> analysis with rankings</li>
                <li className="flex items-center gap-2">🏆 <strong>Top performers</strong> showcase with animations</li>
                <li className="flex items-center gap-2">⚠️ <strong>At-risk students</strong> identification (below 75%)</li>
                <li className="flex items-center gap-2">🤖 <strong>AI-powered insights</strong> and recommendations</li>
                <li className="flex items-center gap-2">📊 <strong>Comprehensive statistics</strong> and metrics</li>
                <li className="flex items-center gap-2">🎨 <strong>Professional design</strong> ready to share</li>
              </ul>
              <div className="mt-3 p-3 bg-yellow-100 rounded-md border border-yellow-300">
                <p className="text-xs text-yellow-900 font-semibold">📄 Supports PDF (OCR), CSV, Excel, and HTML files!</p>
              </div>
            </div>
            </CardContent>
            </Card>

            {showReportSettings && analysisData && (
            <Card className="shadow-xl border-2 border-green-100 mt-6">
            <CardHeader className="bg-gradient-to-r from-green-600 to-blue-600 text-white">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-6 h-6" />
                Customize & Export Report
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Report Content</h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reportConfig.includeStats}
                        onChange={(e) => setReportConfig({...reportConfig, includeStats: e.target.checked})}
                        className="w-4 h-4"
                      />
                      <span>Include Statistics Cards</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reportConfig.includeCharts}
                        onChange={(e) => setReportConfig({...reportConfig, includeCharts: e.target.checked})}
                        className="w-4 h-4"
                      />
                      <span>Include Charts & Graphs</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reportConfig.includeTopPerformers}
                        onChange={(e) => setReportConfig({...reportConfig, includeTopPerformers: e.target.checked})}
                        className="w-4 h-4"
                      />
                      <span>Include Top Performers</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reportConfig.includeAtRisk}
                        onChange={(e) => setReportConfig({...reportConfig, includeAtRisk: e.target.checked})}
                        className="w-4 h-4"
                      />
                      <span>Include At-Risk Students</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Theme</h3>
                  <Select value={reportConfig.theme} onValueChange={(value) => setReportConfig({...reportConfig, theme: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gradient">Gradient (Purple-Blue)</SelectItem>
                      <SelectItem value="ocean">Ocean (Blue)</SelectItem>
                      <SelectItem value="sunset">Sunset (Red-Orange)</SelectItem>
                      <SelectItem value="forest">Forest (Green)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-semibold">Custom Notes / Summary (Optional)</Label>
                <textarea
                  placeholder="Add any custom notes, observations, or summary for this report..."
                  value={reportConfig.notes}
                  onChange={(e) => setReportConfig({...reportConfig, notes: e.target.value})}
                  className="w-full h-32 p-3 border rounded-lg resize-none"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button
                  onClick={handleExportHTML}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export as HTML
                </Button>
                <Button
                  onClick={handleExportCSV}
                  variant="outline"
                  className="flex-1"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export as CSV
                </Button>
                <Button
                  onClick={handleNewAnalysis}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  New Analysis
                </Button>
              </div>

              {lastReportHTML && (
                <div className="border-t pt-4 mt-4">
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border-2 border-indigo-200">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="w-5 h-5 text-indigo-600" />
                          <h4 className="font-bold text-indigo-900">🤖 AI-Powered Auto-Distribution</h4>
                        </div>
                        <p className="text-sm text-indigo-800 mb-3">
                          Let AI analyze report sensitivity and automatically distribute to the right people via email or notifications.
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={handleAutoDistribute}
                      disabled={isDistributing}
                      className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                    >
                      {isDistributing ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> AI Distributing Report...</>
                      ) : (
                        <><Send className="w-4 h-4 mr-2" /> Auto-Distribute Report with AI</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
            </Card>
            )}
            </div>
            </div>
            );
            }