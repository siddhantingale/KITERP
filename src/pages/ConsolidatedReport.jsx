
import React, { useState, useEffect } from "react";
import { Session, Student, AttendanceRecord, Batch } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, FileSpreadsheet, Building2, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

const COLLEGES = [
  "KIT's College of Engineering, Kolhapur",
  "DKTE's Textile & Engineering Institute, Ichalkaranji",
  "Rajarambpapu Institute of Technology, Islampur",
  "SSPM's College of Engineering, Kankavli",
  "SVERI's College of Engineering, Pandharpur",
  "Sinhgad College of Engineering, Pune",
  "Tatyasaheb Kore Institute of Engineering and Technology"
];

const YEARS = ["First Year", "Second Year", "Third Year", "Fourth Year"];

export default function ConsolidatedReport() {
  const navigate = useNavigate();
  const [selectedCollege, setSelectedCollege] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportStats, setReportStats] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  useEffect(() => {
    if (selectedCollege && selectedYear) {
      loadReportStats();
    }
  }, [selectedCollege, selectedYear]);

  const loadReportStats = async () => {
    setIsLoadingStats(true);
    try {
      const [sessions, students, batches] = await Promise.all([
        Session.filter({ college_name: selectedCollege, year: selectedYear }),
        Student.filter({ college_name: selectedCollege, year: selectedYear }),
        Batch.filter({ college_name: selectedCollege, year: selectedYear })
      ]);

      const branchStats = {};
      students.forEach(student => {
        if (student.branch) {
          if (!branchStats[student.branch]) {
            branchStats[student.branch] = { students: 0, batches: 0 };
          }
          branchStats[student.branch].students++;
        }
      });

      batches.forEach(batch => {
        if (batch.branch && branchStats[batch.branch]) {
          branchStats[batch.branch].batches++;
        }
      });

      setReportStats({
        totalSessions: sessions.length,
        totalStudents: students.length,
        totalBatches: batches.length,
        branches: Object.keys(branchStats).length,
        branchStats
      });
    } catch (error) {
      console.error("Error loading report stats:", error);
    }
    setIsLoadingStats(false);
  };

  const generateConsolidatedReport = async () => {
    if (!selectedCollege || !selectedYear) {
      alert("Please select both college and year");
      return;
    }

    setIsGenerating(true);
    try {
      console.log("=== STARTING STABLE, BATCH-BY-BATCH REPORT GENERATION ===");

      // Helper to escape XML
      const escapeXml = (unsafe) => {
        if (typeof unsafe !== 'string') return unsafe;
        return unsafe.replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','\'':'&apos;','"':'&quot;'}[c]));
      };

      // Step 1: Fetch ONLY the list of batches. This is a small, safe query.
      const allBatches = await Batch.filter({ 
        college_name: selectedCollege, 
        year: selectedYear 
      }, null, 500);

      if (allBatches.length === 0) {
        alert("❌ No batches found for the selected college and year.");
        setIsGenerating(false);
        return;
      }

      let worksheetsXml = '';
      const sortedBatches = allBatches.sort((a, b) => a.batch_name.localeCompare(b.batch_name));

      // Step 2: Loop through each batch and process it individually to keep server load low.
      for (const batch of sortedBatches) {
        console.log(`--- Processing Batch: ${batch.batch_name} (ID: ${batch.batch_id}) ---`);
        
        // Fetch data ONLY for this specific batch
        const [studentsForBatch, sessionsForBatch] = await Promise.all([
            Student.filter({ batch_id: batch.batch_id }, '-roll_no', 500),
            Session.filter({ batch_id: batch.batch_id }, '-session_date', 200)
        ]);

        if (studentsForBatch.length === 0) {
          console.log(`Skipping batch ${batch.batch_name} - No students with this batch_id.`);
          continue;
        }

        const sessionIds = sessionsForBatch.map(s => s.id);
        const attendanceRecords = sessionIds.length > 0 ? await AttendanceRecord.filter({ session_id: { $in: sessionIds } }, null, 10000) : [];
        
        const attendanceMap = {};
        attendanceRecords.forEach(record => {
            if (!attendanceMap[record.student_id]) attendanceMap[record.student_id] = {};
            attendanceMap[record.student_id][record.session_id] = record.is_present;
        });

        const sheetName = escapeXml((batch.batch_name || 'Sheet').replace(/[^\w\s]/g, '').substring(0, 31));
        const colCount = 3 + sessionsForBatch.length + 3;

        let sheetXml = `<Worksheet ss:Name="${sheetName}"><Table>`;
        sheetXml += `<Column ss:Width="40"/><Column ss:Width="90"/><Column ss:Width="180"/>`;
        sessionsForBatch.forEach(() => { sheetXml += `<Column ss:Width="65"/>`; });
        sheetXml += `<Column ss:Width="60"/><Column ss:Width="60"/><Column ss:Width="60"/>`;
        
        sheetXml += `<Row ss:Height="25"><Cell ss:MergeAcross="${colCount - 1}" ss:StyleID="Header"><Data ss:Type="String">APT-TECH Professional Training Attendance Report</Data></Cell></Row>`;
        sheetXml += `<Row ss:Height="20"><Cell ss:MergeAcross="${colCount - 1}" ss:StyleID="SubHeader"><Data ss:Type="String">${escapeXml(selectedCollege)}</Data></Cell></Row>`;
        sheetXml += `<Row ss:Height="20"><Cell ss:MergeAcross="${colCount - 1}" ss:StyleID="SubHeader"><Data ss:Type="String">Class: ${escapeXml(batch.batch_name)} (${escapeXml(batch.year)})</Data></Cell></Row>`;
        sheetXml += `<Row/>`;

        if (sessionsForBatch.length > 0) {
          sheetXml += `<Row><Cell ss:MergeAcross="5" ss:StyleID="SectionTitle"><Data ss:Type="String">SESSION DETAILS</Data></Cell></Row>`;
          sheetXml += `<Row ss:StyleID="Bold"><Cell><Data ss:Type="String">Date</Data></Cell><Cell><Data ss:Type="String">Session Name</Data></Cell><Cell><Data ss:Type="String">Topic Taught</Data></Cell><Cell><Data ss:Type="String">Faculty</Data></Cell><Cell><Data ss:Type="String">Time</Data></Cell><Cell><Data ss:Type="String">Duration</Data></Cell></Row>`;
          sessionsForBatch.forEach(s => {
            sheetXml += `<Row><Cell><Data ss:Type="String">${format(new Date(s.session_date), 'dd-MM-yyyy')}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(s.session_name)}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(s.topic_taught)}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(s.faculty_name)}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(s.session_time)}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(s.duration)}</Data></Cell></Row>`;
          });
          sheetXml += `<Row/>`;
        }
        
        sheetXml += `<Row><Cell ss:MergeAcross="${colCount - 1}" ss:StyleID="SectionTitle"><Data ss:Type="String">ATTENDANCE RECORD</Data></Cell></Row>`;
        let headerRow = `<Row ss:StyleID="Bold"><Cell><Data ss:Type="String">Sr.</Data></Cell><Cell><Data ss:Type="String">PRN</Data></Cell><Cell><Data ss:Type="String">Student Name</Data></Cell>`;
        sessionsForBatch.forEach(s => { headerRow += `<Cell><Data ss:Type="String">${format(new Date(s.session_date), 'dd-MM')}</Data></Cell>`; });
        headerRow += `<Cell><Data ss:Type="String">Present</Data></Cell><Cell><Data ss:Type="String">Total</Data></Cell><Cell><Data ss:Type="String">%</Data></Cell></Row>`;
        sheetXml += headerRow;

        studentsForBatch.forEach((student, index) => {
          let presentCount = 0;
          let studentRow = `<Row><Cell><Data ss:Type="Number">${index + 1}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(student.prn)}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(student.name)}</Data></Cell>`;
          sessionsForBatch.forEach(session => {
            const isPresent = attendanceMap[student.id]?.[session.id];
            if (isPresent) presentCount++;
            studentRow += `<Cell ss:StyleID="${isPresent ? 'Present' : 'Absent'}"><Data ss:Type="String">${isPresent ? 'P' : 'A'}</Data></Cell>`;
          });
          const totalSess = sessionsForBatch.length;
          const percentage = totalSess > 0 ? Math.round((presentCount / totalSess) * 100) : 0;
          studentRow += `<Cell ss:StyleID="Bold"><Data ss:Type="Number">${presentCount}</Data></Cell>`;
          studentRow += `<Cell ss:StyleID="Bold"><Data ss:Type="Number">${totalSess}</Data></Cell>`;
          studentRow += `<Cell ss:StyleID="Bold"><Data ss:Type="String">${percentage}%</Data></Cell></Row>`;
          sheetXml += studentRow;
        });

        sheetXml += `</Table></Worksheet>`;
        worksheetsXml += sheetXml;

        // Add a small delay between processing each batch to be safe
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      const fullXml = `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
  <Style ss:ID="Default" ss:Name="Normal"><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/></Style>
  <Style ss:ID="Header"><Font ss:FontName="Calibri" ss:Bold="1" ss:Size="16"/><Alignment ss:Horizontal="Center"/></Style>
  <Style ss:ID="SubHeader"><Font ss:FontName="Calibri" ss:Bold="1" ss:Size="12"/><Alignment ss:Horizontal="Center"/></Style>
  <Style ss:ID="SectionTitle"><Font ss:FontName="Calibri" ss:Bold="1" ss:Size="11" ss:Color="#FFFFFF"/><Interior ss:Color="#444444" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Bold"><Font ss:Bold="1"/></Style>
  <Style ss:ID="Present"><Font ss:Bold="1" ss:Color="#006100"/><Interior ss:Color="#C6EFCE" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>
  <Style ss:ID="Absent"><Font ss:Bold="1" ss:Color="#9C0006"/><Interior ss:Color="#FFC7CE" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>
</Styles>
${worksheetsXml}
</Workbook>`;

      const blob = new Blob([fullXml], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = `${selectedCollege.replace(/[^\w\s]/g, '')}_${selectedYear.replace(/\s+/g, '_')}_Consolidated_Report.xls`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      alert(`✅ Consolidated report generated successfully!`);

    } catch (error) {
      console.error("❌ Final error:", error);
      alert(`❌ Error generating consolidated report: ${error.message}. Please check console for details.`);
    }

    setIsGenerating(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl("Dashboard"))}
            className="bg-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">📊 Consolidated Attendance Report</h1>
            <p className="text-gray-600 mt-1">Generate comprehensive attendance reports organized by divisions</p>
          </div>
        </div>

        {/* Selection Form */}
        <Card className="mb-6 bg-white shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <CardTitle className="flex items-center gap-3">
              <FileSpreadsheet className="w-6 h-6" />
              Report Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Building2 className="w-4 h-4 inline mr-1" />
                  Select College *
                </label>
                <Select value={selectedCollege} onValueChange={setSelectedCollege}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Choose college" />
                  </SelectTrigger>
                  <SelectContent>
                    {COLLEGES.map(college => (
                      <SelectItem key={college} value={college}>{college}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Select Academic Year *
                </label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Choose year" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Report Stats */}
            {reportStats && (
              <div className="grid md:grid-cols-4 gap-4 p-4 bg-blue-50 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{reportStats.totalSessions}</div>
                  <div className="text-sm text-gray-600">Sessions</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{reportStats.totalStudents}</div>
                  <div className="text-sm text-gray-600">Students</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{reportStats.branches}</div>
                  <div className="text-sm text-gray-600">Branches</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{reportStats.totalBatches}</div>
                  <div className="text-sm text-gray-600">Batches</div>
                </div>
              </div>
            )}

            {/* Branch Breakdown */}
            {reportStats && reportStats.branchStats && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Branch-wise Breakdown</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(reportStats.branchStats).map(([branch, stats]) => (
                    <div key={branch} className="p-3 bg-gray-50 rounded-lg">
                      <div className="font-semibold text-sm text-gray-900">{branch}</div>
                      <div className="text-xs text-gray-600">
                        👥 {stats.students} students • 📚 {stats.batches} batches
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={generateConsolidatedReport}
              disabled={!selectedCollege || !selectedYear || isGenerating}
              className="w-full h-12 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-bold"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Generating Multi-Sheet Report...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  📊 Generate Professional Report
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Information Card */}
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-indigo-900 mb-3">📋 Professional Report Features</h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-indigo-800">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800">✓</Badge>
                  Precise formatting for professional appearance
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800">✓</Badge>
                  Complete session details per batch
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800">✓</Badge>
                  Student-wise attendance matrix per batch
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800">✓</Badge>
                  Batch-wise attendance percentages & overall summary
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800">✓</Badge>
                  Native Excel file (.xls) for better compatibility
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800">✓</Badge>
                  Improved data handling for large datasets
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
