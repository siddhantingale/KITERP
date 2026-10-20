import React, { useState, useRef } from "react";
import { api } from "@/api/client";
import { InvokeLLM } from "@/integrations/Core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Brain, 
  Users, 
  AlertTriangle, 
  Sparkles, 
  Loader2,
  ChevronRight,
  Target,
  Upload,
  Download,
  FileSpreadsheet,
  TrendingUp,
  CheckCircle,
  Calendar,
  Clock,
  Send,
  Zap
} from "lucide-react";
import { format, addMonths } from "date-fns";
import { distributeAnalysisReport } from "@/functions/distributeAnalysisReport";

const years = ["First Year", "Second Year", "Third Year", "Fourth Year"];

export default function PredictiveAnalysis() {
  const fileInputRef = useRef(null);
  
  // Event-Based Prediction State
  const [customEvent, setCustomEvent] = useState("");
  const [predictionPeriod, setPredictionPeriod] = useState("1month");
  const [isPredicting, setIsPredicting] = useState(false);
  const [eventPredictions, setEventPredictions] = useState(null);
  
  // Student Risk Analysis State
  const [formData, setFormData] = useState({
    year: "",
    division: ""
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isDistributing, setIsDistributing] = useState(false);
  const [lastReportHTML, setLastReportHTML] = useState(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
      setSelectedFile(file);
      setMessage(null);
    } else {
      setMessage({ type: "error", text: "Please select a valid CSV file" });
    }
  };

  const parseCSV = (text) => {
    console.log('📄 Starting CSV parsing...');
    const lines = text.trim().split(/\r?\n/).filter(line => line.trim());
    
    if (lines.length < 2) {
      console.error('❌ CSV has less than 2 lines (header + data required)');
      return { headers: [], data: [] };
    }

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

    // Smart header detection - skip empty lines and title rows
    let headerRowIndex = 0;
    let headers = [];
    
    const headerKeywords = ['ROLL', 'NAME', 'STUDENT', 'ATTENDANCE', 'TOTAL', 'PRESENT', 'ABSENT', '%', 'DAYS'];
    
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const parsed = parseLine(lines[i]);
      const lineUpper = lines[i].toUpperCase();
      
      const keywordCount = headerKeywords.filter(k => lineUpper.includes(k)).length;
      
      if (keywordCount >= 2 && parsed.length >= 3) {
        headerRowIndex = i;
        headers = parsed.map(h => h.trim()).filter(h => h.length > 0);
        console.log(`✅ Found header row at line ${i}:`, headers);
        break;
      }
    }
    
    if (headers.length === 0) {
      console.log('⚠️ No header detected, using first line');
      headers = parseLine(lines[0]).map(h => h.trim()).filter(h => h.length > 0);
    }

    // Parse data rows and validate
    const data = [];
    for (let i = headerRowIndex + 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      
      // Skip completely empty rows
      if (!values.some(v => v && v.trim())) continue;
      
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      // Only include rows with at least 3 non-empty values
      const nonEmptyCount = Object.values(row).filter(v => v && v.trim().length > 0).length;
      if (nonEmptyCount >= 3) {
        data.push(row);
      }
    }

    console.log('✅ CSV Parsing complete:', { 
      totalLines: lines.length, 
      headerIndex: headerRowIndex,
      headers: headers.length, 
      validDataRows: data.length,
      sampleHeaders: headers.slice(0, 5),
      firstDataRow: data[0]
    });

    return { headers, data };
  };

  const analyzeAttendanceData = (data) => {
    console.log('📊 Starting attendance analysis with', data.length, 'rows');
    const students = [];
    
    // Intelligent column detection with multiple keyword variations
    const findColumn = (keywords) => {
      // Check headers first
      if (data.length === 0) return null;
      
      const firstRow = data[0];
      for (const key of Object.keys(firstRow)) {
        const upper = key.toUpperCase().trim();
        if (keywords.some(k => upper.includes(k) || upper === k)) {
          console.log(`✅ Mapped column "${key}" for keywords:`, keywords);
          return key;
        }
      }
      return null;
    };
    
    // Enhanced column mapping with comprehensive keyword variations
    const rollNoCol = findColumn(['ROLL NO', 'ROLL', 'ROLLNUMBER', 'SL NO', 'SR NO', 'SERIAL NO', 'SL.NO', 'SR.NO', 'ROLL NUMBER']);
    const nameCol = findColumn(['STUDENT NAME', 'NAME', 'STUDENT', 'FULL NAME', 'NAME OF STUDENT', 'STUDENTS NAME']);
    const totalDaysCol = findColumn(['TOTAL DAYS', 'TOTAL', 'TOTAL CLASSES', 'NO OF DAYS', 'TOTAL SESSIONS']);
    const presentCol = findColumn(['DAYS PRESENT', 'PRESENT', 'ATTENDED', 'CLASSES ATTENDED', 'PRESENT DAYS']);
    const absentCol = findColumn(['DAYS ABSENT', 'ABSENT', 'ABSENTEES', 'CLASSES MISSED', 'ABSENT DAYS']);
    const percentCol = findColumn(['ATTENDANCE %', 'ATTENDANCE', '%', 'PERCENT', 'ATTENDANCE PERCENTAGE', 'PERCENTAGE']);

    console.log('🔍 Column mapping:', {
      rollNoCol,
      nameCol, 
      totalDaysCol,
      presentCol,
      absentCol,
      percentCol
    });

    // Validate that we found at least name column
    if (!nameCol) {
      console.error('❌ Could not find Student Name column. Detected columns:', Object.keys(data[0] || {}));
      throw new Error('Could not detect Student Name column in CSV. Please ensure the file has a "Student Name" or "Name" column.');
    }

    // Process each row
    let validStudentCount = 0;
    let skippedRows = 0;

    data.forEach((row, rowIndex) => {
      const name = row[nameCol] || '';
      const rollNo = row[rollNoCol] || '';
      
      // Parse numeric values safely
      const parseNumber = (value) => {
        if (!value) return 0;
        const str = value.toString().replace(/[^\d.-]/g, ''); // Remove non-numeric except . and -
        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
      };
      
      const totalDays = parseNumber(row[totalDaysCol]);
      const daysPresent = parseNumber(row[presentCol]);
      const daysAbsent = parseNumber(row[absentCol]);
      
      // Calculate percentage intelligently
      let percentage = 0;
      if (percentCol && row[percentCol]) {
        const percentValue = row[percentCol].toString().replace('%', '').replace(/\s/g, '').trim();
        percentage = parseNumber(percentValue);
      } else if (totalDays > 0 && daysPresent > 0) {
        percentage = (daysPresent / totalDays) * 100;
      } else if (totalDays > 0 && daysAbsent >= 0) {
        const calculatedPresent = totalDays - daysAbsent;
        percentage = (calculatedPresent / totalDays) * 100;
      }

      // Validate student record - must have name and some attendance data
      const hasValidName = name.trim().length >= 2 && /[a-zA-Z]/.test(name);
      const hasAttendanceData = percentage > 0 || totalDays > 0 || daysPresent > 0;
      
      if (!hasValidName || !hasAttendanceData) {
        skippedRows++;
        console.log(`⚠️ Skipping invalid row ${rowIndex + 1}:`, { name, percentage, totalDays, daysPresent });
        return;
      }

      validStudentCount++;
      const absenceRatio = totalDays > 0 ? (daysAbsent / totalDays) : 0;
      
      // Risk Level Classification (STRICT THRESHOLDS)
      let riskLevel = 'low';
      let riskScore = 0;
      if (percentage >= 85) {
        riskLevel = 'low';
        riskScore = 20 + (100 - percentage) * 0.5;
      } else if (percentage >= 70) {
        riskLevel = 'moderate';
        riskScore = 40 + (85 - percentage) * 2;
      } else {
        riskLevel = 'high';
        riskScore = 70 + (70 - percentage) * 0.5;
      }

      // Academic Impact Assessment
      let academicImpact = '';
      let predictedGradeDrop = '';
      if (percentage >= 90) {
        academicImpact = 'Excellent academic continuity - No impact expected';
        predictedGradeDrop = 'No drop';
      } else if (percentage >= 75) {
        academicImpact = 'Moderate risk - May affect performance slightly';
        predictedGradeDrop = '1 grade point';
      } else {
        academicImpact = 'High academic risk - Significant performance impact';
        predictedGradeDrop = '2-3 grade points';
      }

      // Predictive trend calculation
      const trendFactor = absenceRatio > 0.15 ? -2 : absenceRatio > 0.1 ? -1 : 0;
      const predictedFinal = Math.max(0, Math.min(100, percentage + trendFactor));

      students.push({
        name: name.trim(),
        rollNo: rollNo.toString().trim() || `Student-${validStudentCount}`,
        totalDays,
        daysPresent,
        daysAbsent,
        percentage: percentage.toFixed(1),
        absenceRatio: absenceRatio.toFixed(2),
        riskLevel,
        riskScore: riskScore.toFixed(0),
        predictedFinalAttendance: predictedFinal.toFixed(1),
        academicImpact,
        predictedGradeDrop,
        interventionPriority: riskLevel === 'high' ? 'immediate' : riskLevel === 'moderate' ? 'soon' : 'monitor',
        recommendations: generateRecommendations(percentage, absenceRatio, riskLevel)
      });
    });

    console.log('✅ Analysis complete:', {
      totalRowsProcessed: data.length,
      validStudents: validStudentCount,
      skippedRows: skippedRows,
      highRisk: students.filter(s => s.riskLevel === 'high').length,
      moderateRisk: students.filter(s => s.riskLevel === 'moderate').length,
      lowRisk: students.filter(s => s.riskLevel === 'low').length
    });

    return students.sort((a, b) => parseFloat(b.riskScore) - parseFloat(a.riskScore));
  };

  const generateRecommendations = (percentage, absenceRatio, riskLevel) => {
    const recommendations = [];
    
    if (riskLevel === 'high') {
      recommendations.push('Immediate counseling session required');
      recommendations.push('Notify parents/guardians urgently');
      recommendations.push('Create personalized catch-up plan');
      recommendations.push('Weekly attendance monitoring');
    } else if (riskLevel === 'moderate') {
      recommendations.push('Schedule meeting with student');
      recommendations.push('Monitor attendance bi-weekly');
      recommendations.push('Provide study support resources');
      recommendations.push('Identify attendance barriers');
    } else {
      recommendations.push('Continue positive reinforcement');
      recommendations.push('Regular check-ins');
      recommendations.push('Encourage peer mentorship');
    }
    
    return recommendations;
  };

  const generateEventPredictions = async () => {
    setIsPredicting(true);
    try {
      const today = new Date();
      const endDate = predictionPeriod === "1month" ? addMonths(today, 1) : 
                      predictionPeriod === "2months" ? addMonths(today, 2) : addMonths(today, 3);
      
      const prompt = `You are an educational attendance prediction system for Indian colleges. Analyze and predict attendance patterns.

Current Date: ${format(today, 'dd MMMM yyyy')}
Prediction Period: ${format(today, 'dd MMM yyyy')} to ${format(endDate, 'dd MMM yyyy')}
${customEvent ? `Custom Event to Consider: ${customEvent}` : ''}

Based on the Indian academic calendar, festivals, and common events, predict attendance impact for the given period.

Consider these factors:
1. Major Indian festivals (Ganesh Chaturthi, Diwali, Holi, Eid, Christmas, Pongal, Onam, Durga Puja, etc.)
2. National holidays (Independence Day, Republic Day, Gandhi Jayanti)
3. College events (Annual Day, Sports Day, Cultural Fest, Technical Fest)
4. Exam periods (Mid-terms, Finals, Practicals)
5. Weather conditions (Monsoon, Extreme heat)
6. Long weekends and bridge holidays
7. Regional festivals based on college location

Provide a detailed prediction with:
1. List of upcoming events/festivals with dates
2. Expected attendance drop percentage for each event
3. Number of days likely to be affected
4. Recommendations for faculty/administration

Be specific with dates and realistic with predictions.`;

      const response = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string", description: "Overall prediction summary" },
            predicted_events: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  event_name: { type: "string" },
                  event_date: { type: "string" },
                  event_type: { type: "string", enum: ["festival", "holiday", "college_event", "exam", "weather", "other"] },
                  expected_attendance_drop: { type: "number", description: "Percentage drop expected" },
                  affected_days: { type: "number" },
                  severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
                  description: { type: "string" }
                }
              }
            },
            weekly_predictions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  week: { type: "string" },
                  expected_avg_attendance: { type: "number" },
                  risk_level: { type: "string" },
                  key_events: { type: "string" }
                }
              }
            },
            recommendations: {
              type: "array",
              items: { type: "string" }
            },
            overall_risk_score: { type: "number", description: "1-10 scale" }
          }
        }
      });

      setEventPredictions(response);
    } catch (error) {
      console.error("Error generating predictions:", error);
    }
    setIsPredicting(false);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setMessage({ type: "error", text: "Please select a CSV file" });
      return;
    }

    if (!formData.year || !formData.division) {
      setMessage({ type: "error", text: "Please fill in Academic Year and Division" });
      return;
    }

    setIsProcessing(true);
    setMessage({ type: "info", text: "🔄 Processing CSV file..." });

    try {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const text = e.target.result;
          console.log('📄 CSV file loaded, size:', text.length, 'bytes');
          
          const { headers, data } = parseCSV(text);
          
          if (data.length === 0) {
            console.error('❌ No valid data rows found after parsing');
            console.log('Detected headers:', headers);
            setMessage({ 
              type: "error", 
              text: `No valid data found in CSV. Detected ${headers.length} columns but 0 valid rows. Please check file format.` 
            });
            setIsProcessing(false);
            return;
          }

          console.log(`✅ CSV parsed successfully: ${data.length} valid rows`);
          setMessage({ type: "info", text: `📊 Analyzing ${data.length} student records...` });

          const students = analyzeAttendanceData(data);
          
          if (students.length === 0) {
            console.error('❌ No students extracted from data');
            console.log('Sample data row:', data[0]);
            setMessage({ 
              type: "error", 
              text: "Could not extract student data. Please ensure CSV has columns: Roll No, Student Name, and Attendance % (or Total Days + Days Present)" 
            });
            setIsProcessing(false);
            return;
          }
          
          const highRisk = students.filter(s => s.riskLevel === 'high').length;
          const moderateRisk = students.filter(s => s.riskLevel === 'moderate').length;
          const lowRisk = students.filter(s => s.riskLevel === 'low').length;

          const result = {
            students,
            summary: {
              totalStudents: students.length,
              highRisk,
              moderateRisk,
              lowRisk,
              avgAttendance: students.length > 0 ? (students.reduce((sum, s) => sum + parseFloat(s.percentage), 0) / students.length).toFixed(1) : 0
            },
            batchInfo: {
              year: formData.year,
              division: formData.division,
              analysisDate: new Date().toISOString()
            }
          };

          console.log('✅ Final analysis result:', {
            students_analyzed: result.summary.totalStudents,
            high_risk: highRisk,
            moderate_risk: moderateRisk,
            low_risk: lowRisk,
            avg_attendance: result.summary.avgAttendance
          });

          setAnalysisResult(result);
          setMessage({ 
            type: "success", 
            text: `✅ Analysis complete! ${students.length} students analyzed. High Risk: ${highRisk}, Moderate: ${moderateRisk}, Low: ${lowRisk}` 
          });
          setIsProcessing(false);
        } catch (error) {
          console.error('❌ CSV Analysis Error:', error);
          setMessage({ type: "error", text: `Error: ${error.message}` });
          setIsProcessing(false);
        }
      };

      reader.readAsText(selectedFile);
    } catch (error) {
      console.error("Analysis error:", error);
      setMessage({ type: "error", text: `Error: ${error.message}` });
      setIsProcessing(false);
    }
  };

  const generateHTMLReport = () => {
    if (!analysisResult) return;

    const { students, summary, batchInfo } = analysisResult;
    
    console.log('📊 Generating HTML report for distribution...');

    const riskDistributionData = `['High Risk', ${summary.highRisk}], ['Moderate Risk', ${summary.moderateRisk}], ['Low Risk', ${summary.lowRisk}]`;
    const studentChartData = students.slice(0, 20).map(s => 
      `['${s.name.substring(0, 15)}', ${s.riskScore}]`
    ).join(',');
    const attendanceImpactData = students.slice(0, 20).map(s => 
      `['${s.name.substring(0, 15)}', ${s.percentage}]`
    ).join(',');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Predictive Attendance Analysis - ${batchInfo.division}</title>
    <script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px;
            min-height: 100vh;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 25px;
            padding: 40px;
            box-shadow: 0 30px 90px rgba(0,0,0,0.4);
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 30px;
            border-bottom: 3px solid #667eea;
        }
        .header h1 {
            font-size: 42px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }
        .info-item {
            padding: 15px;
            background: #f8f9fa;
            border-radius: 12px;
            border-left: 4px solid #667eea;
        }
        .info-label {
            font-size: 0.85em;
            color: #666;
            font-weight: 600;
            text-transform: uppercase;
        }
        .info-value {
            font-size: 1.1em;
            color: #333;
            font-weight: bold;
            margin-top: 5px;
        }
        .prediction-note {
            background: #fff3cd;
            border: 2px solid #ffc107;
            border-radius: 10px;
            padding: 15px;
            margin: 20px 0;
            color: #856404;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-card {
            padding: 25px;
            border-radius: 15px;
            color: white;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .summary-card.high { background: linear-gradient(135deg, #ef4444, #dc2626); }
        .summary-card.moderate { background: linear-gradient(135deg, #f59e0b, #d97706); }
        .summary-card.low { background: linear-gradient(135deg, #10b981, #059669); }
        .summary-card.total { background: linear-gradient(135deg, #3b82f6, #2563eb); }
        .summary-card .value {
            font-size: 48px;
            font-weight: bold;
            margin: 10px 0;
        }
        .summary-card .label {
            font-size: 16px;
            opacity: 0.9;
        }
        .chart-container {
            background: white;
            border-radius: 15px;
            padding: 30px;
            margin-bottom: 30px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.1);
        }
        .chart-title {
            font-size: 20px;
            color: #333;
            margin-bottom: 20px;
            font-weight: bold;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
            border-radius: 10px;
            overflow: hidden;
        }
        thead {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
        }
        th, td {
            padding: 15px;
            text-align: left;
        }
        tbody tr {
            background: white;
            transition: all 0.3s;
        }
        tbody tr:nth-child(even) {
            background: #f8f9ff;
        }
        tbody tr:hover {
            background: #e8ebff;
            transform: scale(1.01);
        }
        .risk-badge {
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: bold;
            text-transform: uppercase;
        }
        .risk-high { background: #fee2e2; color: #dc2626; }
        .risk-moderate { background: #fef3c7; color: #d97706; }
        .risk-low { background: #d1fae5; color: #059669; }
        .recommendations {
            background: #f0f9ff;
            border-left: 4px solid #3b82f6;
            padding: 20px;
            margin: 30px 0;
            border-radius: 10px;
        }
        .recommendations h3 {
            color: #1e40af;
            margin-bottom: 15px;
        }
        .recommendations ul {
            list-style: none;
            padding-left: 0;
        }
        .recommendations li {
            padding: 8px 0;
            padding-left: 25px;
            position: relative;
        }
        .recommendations li:before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #10b981;
            font-weight: bold;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #e0e0e0;
            text-align: center;
            color: #666;
        }
        @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧠 Predictive Attendance Analysis Report</h1>
            <p style="font-size: 18px; color: #666;">AI-Powered Absenteeism Risk & Academic Impact Prediction</p>
        </div>

        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">Academic Year</div>
                <div class="info-value">${batchInfo.year}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Division</div>
                <div class="info-value">${batchInfo.division}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Analysis Date</div>
                <div class="info-value">${format(new Date(batchInfo.analysisDate), 'dd MMM yyyy')}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Total Students</div>
                <div class="info-value">${summary.totalStudents}</div>
            </div>
        </div>

        <div class="prediction-note">
            <strong>📊 Prediction Methodology:</strong> This analysis uses rule-based inference on actual CSV data. 
            Risk scores are calculated based on attendance percentage and absence patterns. 
            Academic impact predictions are derived from empirical research correlating attendance with performance.
            <strong>No external training data or assumptions are used.</strong>
        </div>

        <div class="summary-grid">
            <div class="summary-card total">
                <div class="label">Total Students</div>
                <div class="value">${summary.totalStudents}</div>
                <div style="opacity: 0.8;">Analyzed</div>
            </div>
            <div class="summary-card high">
                <div class="label">High Risk</div>
                <div class="value">${summary.highRisk}</div>
                <div style="opacity: 0.8;">< 70% Attendance</div>
            </div>
            <div class="summary-card moderate">
                <div class="label">Moderate Risk</div>
                <div class="value">${summary.moderateRisk}</div>
                <div style="opacity: 0.8;">70-84% Attendance</div>
            </div>
            <div class="summary-card low">
                <div class="label">Low Risk</div>
                <div class="value">${summary.lowRisk}</div>
                <div style="opacity: 0.8;">≥ 85% Attendance</div>
            </div>
        </div>

        <div class="chart-container">
            <h2 class="chart-title">📊 Absenteeism Risk Distribution</h2>
            <div id="risk_pie_chart" style="width: 100%; height: 400px;"></div>
        </div>

        <div class="chart-container">
            <h2 class="chart-title">📊 Student-wise Risk Score (Top 20)</h2>
            <div id="risk_bar_chart" style="width: 100%; height: 500px;"></div>
        </div>

        <div class="chart-container">
            <h2 class="chart-title">📊 Attendance vs Academic Impact</h2>
            <div id="attendance_impact_chart" style="width: 100%; height: 500px;"></div>
        </div>

        <div class="chart-container">
            <h2 class="chart-title">📋 Student-wise Risk Analysis</h2>
            <table>
                <thead>
                    <tr>
                        <th>Roll No</th>
                        <th>Student Name</th>
                        <th>Attendance %</th>
                        <th>Risk Level</th>
                        <th>Risk Score</th>
                        <th>Academic Impact</th>
                        <th>Predicted Final %</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${students.map(s => `
                    <tr>
                        <td>${s.rollNo}</td>
                        <td>${s.name}</td>
                        <td><strong>${s.percentage}%</strong></td>
                        <td><span class="risk-badge risk-${s.riskLevel}">${s.riskLevel}</span></td>
                        <td>${s.riskScore}/100</td>
                        <td>${s.academicImpact}</td>
                        <td>${s.predictedFinalAttendance}%</td>
                        <td>${s.interventionPriority === 'immediate' ? '🚨 Immediate' : s.interventionPriority === 'soon' ? '⚠️ Soon' : '✅ Monitor'}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="recommendations">
            <h3>💡 Actionable Recommendations</h3>
            <ul>
                <li><strong>High-Risk Students (${summary.highRisk}):</strong> Require immediate intervention - counseling, parent meetings, personalized catch-up plans</li>
                <li><strong>Moderate-Risk Students (${summary.moderateRisk}):</strong> Regular monitoring, study support, identify barriers to attendance</li>
                <li><strong>Low-Risk Students (${summary.lowRisk}):</strong> Positive reinforcement, peer mentorship opportunities</li>
                <li>Implement early warning system for students showing declining attendance trends</li>
                <li>Establish attendance improvement programs targeting students below 75%</li>
                <li>Regular parent-teacher communication for at-risk students</li>
            </ul>
        </div>

        <div class="footer">
            <p><strong>Report Generated:</strong> ${format(new Date(), 'PPP p')}</p>
            <p><strong>Powered by EDU TRACK</strong> | Predictive Attendance Analytics System</p>
            <p style="margin-top: 10px; font-size: 0.9em;">This is an AI-assisted predictive analysis based on rule-based inference from actual data</p>
        </div>
    </div>

    <script type="text/javascript">
        google.charts.load('current', {'packages':['corechart']});
        google.charts.setOnLoadCallback(drawCharts);

        function drawCharts() {
            var pieData = google.visualization.arrayToDataTable([
                ['Risk Level', 'Count'],
                ${riskDistributionData}
            ]);

            var pieOptions = {
                title: 'Absenteeism Risk Distribution',
                colors: ['#ef4444', '#f59e0b', '#10b981'],
                pieHole: 0.4,
                animation: {
                    startup: true,
                    duration: 1000,
                    easing: 'out'
                },
                legend: { position: 'bottom' },
                pieSliceText: 'value'
            };

            var pieChart = new google.visualization.PieChart(document.getElementById('risk_pie_chart'));
            pieChart.draw(pieData, pieOptions);

            var barData = google.visualization.arrayToDataTable([
                ['Student', 'Risk Score'],
                ${studentChartData}
            ]);

            var barOptions = {
                title: 'Top 20 Students by Risk Score',
                colors: ['#ef4444'],
                animation: {
                    startup: true,
                    duration: 1000,
                    easing: 'out'
                },
                vAxis: { 
                    title: 'Risk Score (0-100)',
                    minValue: 0,
                    maxValue: 100
                },
                hAxis: { 
                    title: 'Student Name',
                    slantedText: true,
                    slantedTextAngle: 45
                },
                legend: { position: 'none' }
            };

            var barChart = new google.visualization.ColumnChart(document.getElementById('risk_bar_chart'));
            barChart.draw(barData, barOptions);

            var impactData = google.visualization.arrayToDataTable([
                ['Student', 'Attendance %'],
                ${attendanceImpactData}
            ]);

            var impactOptions = {
                title: 'Attendance % vs Academic Impact (Top 20)',
                colors: ['#3b82f6'],
                animation: {
                    startup: true,
                    duration: 1000,
                    easing: 'out'
                },
                vAxis: { 
                    title: 'Attendance %',
                    minValue: 0,
                    maxValue: 100
                },
                hAxis: { 
                    title: 'Student Name',
                    slantedText: true,
                    slantedTextAngle: 45
                },
                legend: { position: 'none' }
            };

            var impactChart = new google.visualization.ColumnChart(document.getElementById('attendance_impact_chart'));
            impactChart.draw(impactData, impactOptions);
        }

        window.addEventListener('resize', function() {
            drawCharts();
        });
    </script>
</body>
</html>`;

    setLastReportHTML(html);
    
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Predictive_Analysis_${batchInfo.division}_${format(new Date(), 'dd-MM-yyyy')}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setMessage({ type: "success", text: "✅ HTML Report downloaded!" });
  };

  const handleAutoDistribute = async () => {
    if (!analysisResult || !lastReportHTML) {
      setMessage({ type: "error", text: "Please generate HTML report first" });
      return;
    }

    setIsDistributing(true);
    setMessage({ type: "info", text: "🤖 AI analyzing report sensitivity and determining distribution..." });

    try {
      const response = await distributeAnalysisReport({
        reportType: "Predictive Attendance Analysis",
        reportHTML: lastReportHTML,
        reportTitle: `Predictive Analysis - ${formData.division}`,
        batchInfo: formData,
        summary: analysisResult.summary
      });

      if (response.data.success) {
        const { distribution, ai_decision } = response.data;
        setMessage({ 
          type: "success", 
          text: `✅ Report distributed! ${distribution.emails_sent} emails sent via ${ai_decision.distribution_method}. AI: ${ai_decision.reason}` 
        });
      } else {
        setMessage({ type: "error", text: "Distribution failed: " + response.data.error });
      }
    } catch (error) {
      console.error('Distribution error:', error);
      setMessage({ type: "error", text: "Failed to distribute: " + error.message });
    }

    setIsDistributing(false);
  };

  const getRiskColor = (risk) => {
    switch (risk?.toLowerCase()) {
      case 'high': return 'bg-red-500 text-white';
      case 'moderate': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'border-red-500 bg-red-50';
      case 'high': return 'border-orange-500 bg-orange-50';
      case 'medium': return 'border-yellow-500 bg-yellow-50';
      case 'low': return 'border-green-500 bg-green-50';
      default: return 'border-gray-300 bg-gray-50';
    }
  };

  const getEventIcon = (type) => {
    switch (type) {
      case 'festival': return '🎉';
      case 'holiday': return '🏛️';
      case 'college_event': return '🎓';
      case 'exam': return '📝';
      case 'weather': return '🌧️';
      default: return '📅';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2 sm:gap-3">
            <Brain className="w-6 sm:w-8 h-6 sm:h-8 text-purple-600" />
            Predictive Attendance Insights
          </h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">AI-powered predictions for attendance patterns and student risk assessment</p>
        </div>

        <Tabs defaultValue="events" className="space-y-4 sm:space-y-6">
          <TabsList className="bg-white shadow-md p-1 rounded-xl w-full grid grid-cols-2">
            <TabsTrigger value="events" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded-lg px-3 sm:px-6 text-xs sm:text-sm">
              <Calendar className="w-3 sm:w-4 h-3 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Event-Based Predictions</span>
              <span className="sm:hidden">Events</span>
            </TabsTrigger>
            <TabsTrigger value="students" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded-lg px-3 sm:px-6 text-xs sm:text-sm">
              <Users className="w-3 sm:w-4 h-3 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Student Risk Analysis</span>
              <span className="sm:hidden">Students</span>
            </TabsTrigger>
          </TabsList>

          {/* Event-Based Predictions Tab */}
          <TabsContent value="events" className="space-y-4 sm:space-y-6">
            <Card className="shadow-xl border-2 border-purple-100">
              <CardHeader className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Sparkles className="w-4 sm:w-5 h-4 sm:h-5" />
                  Predict Attendance Based on Events & Festivals
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Prediction Period</Label>
                    <Select value={predictionPeriod} onValueChange={setPredictionPeriod}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1month">Next 1 Month</SelectItem>
                        <SelectItem value="2months">Next 2 Months</SelectItem>
                        <SelectItem value="3months">Next 3 Months</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Custom Event (Optional)</Label>
                    <Input 
                      placeholder="e.g., College Annual Day on 15th Feb, Technical Fest..."
                      value={customEvent}
                      onChange={(e) => setCustomEvent(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
                <Button 
                  onClick={generateEventPredictions}
                  disabled={isPredicting}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 py-2 sm:py-3"
                >
                  {isPredicting ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing Events...</>
                  ) : (
                    <><Brain className="w-4 h-4 mr-2" /> Generate Predictions</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {eventPredictions && (
              <>
                {/* Summary Card */}
                <Card className="shadow-lg border-l-4 border-purple-500">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">📊 Prediction Summary</h3>
                        <p className="text-gray-700">{eventPredictions.summary}</p>
                      </div>
                      <div className="text-center bg-gradient-to-br from-purple-500 to-indigo-600 text-white px-6 py-4 rounded-xl">
                        <div className="text-3xl font-bold">{eventPredictions.overall_risk_score}/10</div>
                        <div className="text-sm opacity-90">Risk Score</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Predicted Events */}
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-purple-600" />
                      Upcoming Events & Expected Impact
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {eventPredictions.predicted_events?.map((event, idx) => (
                        <div 
                          key={idx} 
                          className={`border-l-4 rounded-lg p-4 ${getSeverityColor(event.severity)}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xl">{getEventIcon(event.event_type)}</span>
                                <h4 className="font-bold text-gray-900">{event.event_name}</h4>
                                <Badge className={getRiskColor(event.severity)}>{event.severity}</Badge>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                              <div className="flex flex-wrap gap-4 text-sm">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" /> {event.event_date}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" /> {event.affected_days} days affected
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-red-600">-{event.expected_attendance_drop}%</div>
                              <div className="text-xs text-gray-500">Expected Drop</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Weekly Predictions */}
                {eventPredictions.weekly_predictions && (
                  <Card className="shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <TrendingUp className="w-4 sm:w-5 h-4 sm:h-5 text-purple-600" />
                        Weekly Attendance Forecast
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6">
                      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        {eventPredictions.weekly_predictions.map((week, idx) => (
                          <div key={idx} className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border">
                            <div className="text-sm font-medium text-gray-600 mb-2">{week.week}</div>
                            <div className="text-3xl font-bold text-gray-900 mb-1">{week.expected_avg_attendance}%</div>
                            <Badge className={getRiskColor(week.risk_level)}>{week.risk_level} risk</Badge>
                            {week.key_events && (
                              <div className="text-xs text-gray-500 mt-2">{week.key_events}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recommendations */}
                {eventPredictions.recommendations && (
                  <Card className="shadow-lg border-2 border-green-200 bg-green-50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-800">
                        <Target className="w-5 h-5" />
                        Recommendations for Administration
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <ul className="space-y-3">
                        {eventPredictions.recommendations.map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-3">
                            <ChevronRight className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <span className="text-gray-700">{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* Student Risk Analysis Tab */}
          <TabsContent value="students" className="space-y-4 sm:space-y-6">
            {message && (
              <Alert className={`${message.type === 'error' ? 'border-red-200 bg-red-50' : message.type === 'success' ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'}`}>
                <AlertDescription className={message.type === 'error' ? 'text-red-800' : message.type === 'success' ? 'text-green-800' : 'text-blue-800'}>
                  {message.text}
                </AlertDescription>
              </Alert>
            )}

            <Card className="shadow-xl border-2 border-purple-100">
              <CardHeader className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Upload className="w-4 sm:w-5 h-4 sm:h-5" />
                  Student Risk Analysis - Upload & Configure
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-semibold">Academic Year *</Label>
                    <Select value={formData.year} onValueChange={(value) => setFormData({...formData, year: value})}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((year) => (
                          <SelectItem key={year} value={year}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="font-semibold">Division *</Label>
                    <Input
                      placeholder="e.g., A, B, C"
                      value={formData.division}
                      onChange={(e) => setFormData({...formData, division: e.target.value})}
                      className="mt-2"
                    />
                  </div>
                </div>

                <div>
                  <Label className="font-semibold">Upload Attendance CSV *</Label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-purple-300 rounded-lg p-8 text-center hover:border-purple-500 transition-colors cursor-pointer bg-gradient-to-br from-purple-50 to-blue-50 mt-2"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <FileSpreadsheet className="w-16 h-16 mx-auto text-purple-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {selectedFile ? selectedFile.name : "Drop your attendance CSV here"}
                    </h3>
                    <p className="text-gray-600 text-sm">
                      Required columns: Roll No, Student Name, Total Days, Days Present, Days Absent, Attendance %
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
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 py-4 sm:py-6 text-base sm:text-lg"
                >
                  {isProcessing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing Data...</>
                  ) : (
                    <><Brain className="w-4 h-4 mr-2" /> Analyze Attendance & Predict Risks</>
                  )}
                </Button>

                <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-purple-200">
                  <h4 className="font-bold text-purple-900 mb-2 text-sm">🎯 What This Analysis Provides:</h4>
                  <ul className="text-xs text-purple-800 space-y-1">
                    <li className="flex items-center gap-2">✓ <strong>Rule-based absenteeism risk prediction</strong> (Low/Medium/High)</li>
                    <li className="flex items-center gap-2">✓ <strong>Academic impact assessment</strong> based on attendance patterns</li>
                    <li className="flex items-center gap-2">✓ <strong>Student-wise risk scores</strong> and intervention priorities</li>
                    <li className="flex items-center gap-2">✓ <strong>Interactive charts</strong> - pie, bar, distribution graphs</li>
                    <li className="flex items-center gap-2">✓ <strong>Downloadable HTML report</strong> with actionable recommendations</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {analysisResult && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  <Card className="shadow-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                    <CardContent className="p-4 sm:p-6 text-center">
                      <Users className="w-6 sm:w-8 h-6 sm:h-8 mx-auto mb-2 opacity-80" />
                      <div className="text-2xl sm:text-3xl font-bold">{analysisResult.summary.totalStudents}</div>
                      <div className="text-xs sm:text-sm opacity-90">Total Students</div>
                    </CardContent>
                  </Card>
                  <Card className="shadow-lg bg-gradient-to-br from-red-500 to-orange-500 text-white">
                    <CardContent className="p-4 sm:p-6 text-center">
                      <AlertTriangle className="w-6 sm:w-8 h-6 sm:h-8 mx-auto mb-2 opacity-80" />
                      <div className="text-2xl sm:text-3xl font-bold">{analysisResult.summary.highRisk}</div>
                      <div className="text-xs sm:text-sm opacity-90">High Risk (&lt;70%)</div>
                    </CardContent>
                  </Card>
                  <Card className="shadow-lg bg-gradient-to-br from-yellow-500 to-amber-500 text-white">
                    <CardContent className="p-4 sm:p-6 text-center">
                      <TrendingUp className="w-6 sm:w-8 h-6 sm:h-8 mx-auto mb-2 opacity-80" />
                      <div className="text-2xl sm:text-3xl font-bold">{analysisResult.summary.moderateRisk}</div>
                      <div className="text-xs sm:text-sm opacity-90">Moderate Risk (70-84%)</div>
                    </CardContent>
                  </Card>
                  <Card className="shadow-lg bg-gradient-to-br from-green-500 to-emerald-600 text-white">
                    <CardContent className="p-4 sm:p-6 text-center">
                      <CheckCircle className="w-6 sm:w-8 h-6 sm:h-8 mx-auto mb-2 opacity-80" />
                      <div className="text-2xl sm:text-3xl font-bold">{analysisResult.summary.lowRisk}</div>
                      <div className="text-xs sm:text-sm opacity-90">Low Risk (≥85%)</div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-purple-100 to-blue-100">
                    <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-base sm:text-lg">
                        <Users className="w-4 sm:w-5 h-4 sm:h-5 text-purple-600" />
                        Student-wise Risk Analysis
                      </span>
                      <Button 
                        onClick={generateHTMLReport}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 w-full sm:w-auto"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Full Report
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6">
                   {lastReportHTML && (
                     <div className="mb-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border-2 border-indigo-200">
                       <div className="flex items-center gap-2 mb-2">
                         <Zap className="w-5 h-5 text-indigo-600" />
                         <h4 className="font-bold text-indigo-900">🤖 AI-Powered Distribution</h4>
                       </div>
                       <p className="text-sm text-indigo-800 mb-3">
                         AI will analyze sensitivity, determine recipients (admin/faculty), and choose the best distribution channel.
                       </p>
                       <Button
                         onClick={handleAutoDistribute}
                         disabled={isDistributing}
                         className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                       >
                         {isDistributing ? (
                           <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> AI Distributing...</>
                         ) : (
                           <><Send className="w-4 h-4 mr-2" /> Auto-Distribute Report with AI</>
                         )}
                       </Button>
                     </div>
                   )}

                   <div className="space-y-3 sm:space-y-4">
                     {analysisResult.students.map((student, idx) => (
                        <div 
                          key={idx} 
                          className={`border rounded-xl p-3 sm:p-4 ${
                            student.riskLevel === 'high' ? 'border-red-300 bg-red-50' :
                            student.riskLevel === 'moderate' ? 'border-yellow-300 bg-yellow-50' :
                            'border-green-300 bg-green-50'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row items-start justify-between gap-3 mb-3">
                            <div className="w-full sm:flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-bold text-base sm:text-lg text-gray-900">{student.name}</h4>
                                <Badge variant="outline" className="text-xs">{student.rollNo}</Badge>
                                <Badge className={`${getRiskColor(student.riskLevel)} text-xs`}>{student.riskLevel.toUpperCase()}</Badge>
                                {student.interventionPriority === 'immediate' && (
                                  <Badge className="bg-red-600 text-white animate-pulse text-xs">⚠️ IMMEDIATE ACTION</Badge>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-2xl font-bold" style={{
                                color: student.riskScore > 70 ? '#ef4444' : 
                                       student.riskScore > 40 ? '#f59e0b' : '#22c55e'
                              }}>
                                {student.riskScore}
                              </div>
                              <div className="text-xs text-gray-500">Risk Score</div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-3">
                            <div className="bg-white/60 rounded-lg p-2 sm:p-3">
                              <div className="text-xs sm:text-sm text-gray-600">Current Attendance</div>
                              <div className="text-lg sm:text-xl font-bold text-gray-900">{student.percentage}%</div>
                            </div>
                            <div className="bg-white/60 rounded-lg p-2 sm:p-3">
                              <div className="text-xs sm:text-sm text-gray-600">Predicted Final</div>
                              <div className="text-base sm:text-lg font-semibold text-gray-900">{student.predictedFinalAttendance}%</div>
                            </div>
                            <div className="bg-white/60 rounded-lg p-2 sm:p-3 col-span-2 md:col-span-1">
                              <div className="text-xs sm:text-sm text-gray-600">Academic Impact</div>
                              <div className="text-xs sm:text-sm font-semibold text-gray-900 truncate">{student.academicImpact.substring(0, 30)}...</div>
                            </div>
                            <div className="bg-white/60 rounded-lg p-2 sm:p-3 col-span-2 md:col-span-1">
                              <div className="text-xs sm:text-sm text-gray-600">Grade Drop Risk</div>
                              <div className="text-base sm:text-lg font-bold text-red-600">{student.predictedGradeDrop}</div>
                            </div>
                          </div>

                          {student.recommendations?.length > 0 && (
                            <div className="bg-white/80 rounded-lg p-3">
                              <div className="text-sm font-semibold text-green-700 mb-1">💡 Recommendations:</div>
                              <ul className="text-sm text-gray-700 space-y-1">
                                {student.recommendations.map((rec, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <ChevronRight className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                    {rec}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-lg border-2 border-yellow-200 bg-yellow-50">
                  <CardContent className="p-6">
                    <h3 className="font-bold text-yellow-900 mb-3 flex items-center gap-2">
                      <Brain className="w-5 h-5" />
                      📊 Prediction Methodology
                    </h3>
                    <div className="text-sm text-yellow-800 space-y-2">
                      <p><strong>Rule-Based Inference:</strong> All predictions are derived from actual CSV data using empirical rules.</p>
                      <p><strong>Risk Classification:</strong> Based on attendance percentage - Low (≥85%), Moderate (70-84%), High (&lt;70%)</p>
                      <p><strong>Academic Impact:</strong> Correlation between attendance and performance based on educational research</p>
                      <p><strong>No External Data:</strong> Zero assumptions or external training datasets used</p>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}