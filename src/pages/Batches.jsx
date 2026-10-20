import React, { useState, useEffect } from "react";
import { Batch, Student, Session, AttendanceRecord } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// Removed ShadCN Table components as per new UI outline using native table elements
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Download, Filter, Clock, Eye, Trash2, PlusCircle, Upload, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge"; // New import for Badge component
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
import CreateBatchModal from "../components/batches/CreateBatchModal";
import BulkEmailUploadModal from "../components/batches/BulkEmailUploadModal";
import { refreshBatches } from "../components/utils/useBatches";

const years = ["First Year", "Second Year", "Third Year", "Fourth Year"];
const colleges = [
  "DKTE's Textile & Engineering Institute, Ichalkaranji",
  "KIT's College of Engineering, Kolhapur",
  "Rajarambpapu Institute of Technology, Islampur",
  "SSPM's College of Engineering, Kankavli",
  "SVERI's College of Engineering, Pandharpur",
  "Sinhgad College of Engineering, Pune",
  "Tatyasaheb Kore Institute of Engineering and Technology"
];
const branches = [
    "Computer Science Engineering",
    "Artificial Intelligence & Machine Learning",
    "Data Science",
    "Computer Science & Business Systems",
    "Electronics & Telecommunication",
    "Information Technology",
    "Mechanical Engineering",
    "Civil Engineering"
];

export default function BatchesPage() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({ college: "all", year: "all", branch: "all" });
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingId, setExportingId] = useState(null);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isEmailUploadModalOpen, setEmailUploadModalOpen] = useState(false);

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    setIsLoading(true);
    try {
      const batchesData = await Batch.list("-created_date", 100);
      setBatches(batchesData);
    } catch (error) {
      console.error("Error loading batches:", error);
    }
    setIsLoading(false);
  };

  const filteredBatches = batches.filter(batch => {
    const matchesSearch = searchTerm === "" ||
      (batch.batch_name && batch.batch_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (batch.college_name && batch.college_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (batch.branch && batch.branch.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCollege = filters.college === "all" || batch.college_name === filters.college;
    const matchesYear = filters.year === "all" || batch.year === filters.year;
    // The branch filter UI is removed per the outline, but the filter logic remains for completeness if it were to be added back.
    const matchesBranch = filters.branch === "all" || batch.branch === filters.branch;

    // A private batch won't have college, year, or branch.
    // So, if a specific college/year/branch filter is applied (i.e., not "all"),
    // a private batch will not match those filters (e.g., batch.college_name will be undefined, not matching 'KIT').
    // This correctly hides private batches when filtering by specific academic details.
    return matchesSearch && matchesCollege && matchesYear && matchesBranch;
  });

  const clearFilters = () => {
    setSearchTerm("");
    setFilters({ college: "all", year: "all", branch: "all" });
  };

  const exportBatchData = async (batch) => {
    setExportingId(batch.id);
    setIsExporting(true);
    try {
      const studentsInBatch = await Student.filter({ batch_id: batch.batch_id });
      studentsInBatch.sort((a, b) => (parseInt(a.roll_no) || 0) - (parseInt(b.roll_no) || 0));
      const sessionsForBatch = await Session.filter({ batch_id: batch.batch_id });
      const attendanceRecordsForBatch = await AttendanceRecord.filter({ batch_id: batch.batch_id });

      const sessionDetails = sessionsForBatch
        .sort((a, b) => new Date(parseISO(a.session_date)) - new Date(parseISO(b.session_date)))
        .map(session => ({
          id: session.id,
          date: format(parseISO(session.session_date), 'dd/MM/yy'),
          name: session.session_name,
          topic: session.topic_taught,
          faculty: session.faculty_name,
          time: session.session_time,
          duration: session.duration
        }));

      const sessionIdToDetails = {};
      sessionDetails.forEach(session => { sessionIdToDetails[session.id] = session; });

      const attendanceMap = {};
      attendanceRecordsForBatch.forEach(record => {
        if (!attendanceMap[record.student_id]) attendanceMap[record.student_id] = {};
        const sessionDetail = sessionIdToDetails[record.session_id];
        if (sessionDetail) attendanceMap[record.student_id][sessionDetail.date] = record.is_present;
      });

      const title = `Inacademic Training Attendance Report`;
      // Provide N/A for college/year/branch info if it's a private batch
      const batchInfo = `Batch: ${batch.batch_name} | College: ${batch.college_name || 'N/A'}`;
      const classInfo = `Class Details: ${batch.year || 'N/A'} - ${batch.branch || 'N/A'} - Div ${batch.division || 'N/A'}`;

      const csvRows = [];
      csvRows.push([title]);
      csvRows.push([batchInfo]);
      csvRows.push([classInfo]);
      csvRows.push([]);

      csvRows.push(['Session Details:']);
      csvRows.push(['Date', 'Session Name', 'Topic Taught', 'Faculty', 'Time', 'Duration']);
      sessionDetails.forEach(session => csvRows.push([session.date, session.name, session.topic, session.faculty, session.time, session.duration]));
      csvRows.push([]);

      csvRows.push(['Attendance Record:']);
      const headerRow = ['Roll No.', 'PRN', 'Student Name', ...sessionDetails.map(s => s.date)];
      csvRows.push(headerRow);

      studentsInBatch.forEach((student, index) => {
        const row = [student.roll_no || (index + 1), student.prn || '', student.name || ''];
        sessionDetails.forEach(session => {
          const isPresent = attendanceMap[student.id]?.[session.date];
          row.push(isPresent ? 'P' : 'A');
        });
        csvRows.push(row);
      });

      csvRows.push([]);
      csvRows.push(['Summary:']);
      csvRows.push(['Total Students:', studentsInBatch.length]);
      csvRows.push(['Total Sessions:', sessionDetails.length]);
      csvRows.push(['Report Generated:', format(new Date(), 'dd/MM/yyyy HH:mm')]);

      const csvContent = csvRows.map(e => e.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // Adjust filename for private batches, defaulting to 'PrivateBatch' if college_name is undefined
      const fileName = `${batch.college_name || 'PrivateBatch'}_${batch.batch_name}_Report.csv`.replace(/\s+/g, '_');
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting batch data:", error);
      alert("Error exporting attendance data.");
    }
    setIsExporting(false);
    setExportingId(null);
  };

  const handleDeleteBatch = async (batchId) => {
      try {
          await Batch.delete(batchId);
          loadBatches();
          refreshBatches(); // Trigger global sync
      } catch (error) {
          console.error("Failed to delete batch", error);
          alert("Failed to delete batch. There might be associated records.");
      }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 md:p-8 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -right-20 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      </div>
      
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          {/* Back button removed as per new UI */}
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
              📚 Manage Classes
            </h1>
            <p className="text-gray-700 mt-1">View, export, and manage AIML classes</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setEmailUploadModalOpen(true)} variant="outline" className="border-blue-500 text-blue-600 hover:bg-blue-50">
              <Upload className="w-4 h-4 mr-2" />
              Bulk Email Upload
            </Button>
            <Button onClick={() => navigate(createPageUrl("Upload"))} className="bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 shadow-lg">
              <Upload className="w-4 h-4 mr-2" />
              Bulk Upload Students
            </Button>
          </div>
        </div>

        {/* Enhanced Filter Card */}
        <Card className="mb-6 backdrop-blur-xl bg-white/70 border-white/50 shadow-2xl">
          <CardHeader className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-b border-white/30">
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <Filter className="w-5 h-5" />
              🔍 Filter Classes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select value={filters.year} onValueChange={(value) => setFilters({...filters, year: value})}>
                <SelectTrigger className="h-12 text-base border-2 hover:border-purple-400 focus:border-purple-500">
                  <SelectValue placeholder="📅 All Years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">📅 All Years</SelectItem>
                  <SelectItem value="FY">FY</SelectItem>
                  <SelectItem value="SY">SY</SelectItem>
                  <SelectItem value="TY">TY</SelectItem>
                  <SelectItem value="BTech">BTech</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filters.branch} onValueChange={(value) => setFilters({...filters, branch: value})}>
                <SelectTrigger className="h-12 text-base border-2 hover:border-purple-400 focus:border-purple-500">
                  <SelectValue placeholder="📂 All Divisions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">📂 All Divisions</SelectItem>
                  <SelectItem value="AIML-A">AIML-A</SelectItem>
                  <SelectItem value="AIML-B">AIML-B</SelectItem>
                  <SelectItem value="AIML-C">AIML-C</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <Button variant="outline" onClick={clearFilters} className="h-10 font-semibold">
                🗑️ Clear Filters
              </Button>
              <span className="text-sm text-slate-500 bg-slate-100 px-3 py-2 rounded-full">
                📊 Showing {filteredBatches.length} of {batches.length} classes
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Batches Table */}
        <Card className="backdrop-blur-xl bg-white/70 border-white/50 shadow-2xl">
          <CardHeader className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border-b border-white/30">
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <Users className="w-5 h-5" />
              📋 Batches Overview ({filteredBatches.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left font-bold text-gray-700">🎯 Batch Name</th>
                    <th className="px-6 py-4 text-left font-bold text-gray-700">🏛️ Details</th> {/* Changed from College */}
                    <th className="px-6 py-4 text-left font-bold text-gray-700">Batch Type</th> {/* New Column */}
                    <th className="px-6 py-4 text-center font-bold text-gray-700">👥 Students</th>
                    <th className="px-6 py-4 text-center font-bold text-gray-700">⚙️ Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ?
                    Array(5).fill(0).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={5} className="px-6 py-4">
                          <Skeleton className="h-8 w-full" />
                        </td>
                      </tr>
                    )) :
                    filteredBatches.map((batch) => (
                      <tr 
                        key={batch.id} 
                        className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 border-b border-gray-100 transition-all duration-300 cursor-pointer group"
                        onClick={() => navigate(createPageUrl(`BatchAnalytics?batch_id=${batch.id}`))}
                      >
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-bold text-gray-800">{batch.batch_name}</div>
                            {/* Assuming batch_description exists or defaults to empty string */}
                            <div className="text-sm text-gray-600">{batch.batch_description || ''}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                            {batch.batch_type !== 'private' ? (
                                <>
                                    <div className="font-semibold text-blue-700">{batch.college_name}</div>
                                    <div className="text-sm text-gray-600">
                                      🔬 {batch.branch} {batch.division && `- Div ${batch.division}`}
                                    </div>
                                </>
                            ) : (
                                <div className="text-sm text-gray-500 italic">N/A for Private Batch</div>
                            )}
                        </td>
                        <td className="px-6 py-4">
                           <Badge className={
                            batch.batch_type === 'private' ? 'bg-purple-100 text-purple-800' :
                            batch.batch_type === 'custom' ? 'bg-orange-100 text-orange-800' :
                            'bg-blue-100 text-blue-800'
                           }>
                            {/* Capitalize first letter of batch_type, default to 'Standard' if not set */}
                            {batch.batch_type ? batch.batch_type.charAt(0).toUpperCase() + batch.batch_type.slice(1) : 'Standard'}
                           </Badge>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Badge className="bg-green-100 text-green-800 font-bold text-lg px-3 py-1">
                            👥 {batch.student_count || 0}
                          </Badge>
                        </td>
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                         <div className="flex justify-center gap-2">
                           <Button
                             variant="outline"
                             size="icon"
                             onClick={(e) => {
                               e.stopPropagation();
                               navigate(createPageUrl(`StudentRecordsPage?batch_id=${batch.id}`));
                             }}
                             className="hover:bg-blue-100"
                             title="View Students"
                           >
                             <Eye className="w-4 h-4" />
                           </Button>
                           <Button
                             variant="outline"
                             size="icon"
                             onClick={(e) => {
                               e.stopPropagation();
                               exportBatchData(batch);
                             }}
                             disabled={isExporting && exportingId === batch.id}
                             className="hover:bg-green-100"
                             title="Export Data"
                           >
                             {isExporting && exportingId === batch.id ?
                               <Clock className="w-4 h-4 animate-spin" /> :
                               <Download className="w-4 h-4" />
                             }
                           </Button>
                           <AlertDialog>
                             <AlertDialogTrigger asChild>
                               <Button 
                                 variant="destructive" 
                                 size="icon" 
                                 className="hover:bg-red-100"
                                 onClick={(e) => e.stopPropagation()}
                                 title="Delete Batch"
                               >
                                 <Trash2 className="w-4 h-4" />
                               </Button>
                             </AlertDialogTrigger>
                             <AlertDialogContent>
                               <AlertDialogHeader>
                                 <AlertDialogTitle>Delete Batch?</AlertDialogTitle>
                                 <AlertDialogDescription>
                                   This will permanently delete the batch '<strong>{batch.batch_name}</strong>'. This action cannot be undone.
                                 </AlertDialogDescription>
                               </AlertDialogHeader>
                               <AlertDialogFooter>
                                 <AlertDialogCancel>Cancel</AlertDialogCancel>
                                 <AlertDialogAction onClick={(e) => {
                                   e.stopPropagation();
                                   handleDeleteBatch(batch.id);
                                 }} className="bg-red-600 hover:bg-red-700">
                                   Delete
                                 </AlertDialogAction>
                               </AlertDialogFooter>
                             </AlertDialogContent>
                           </AlertDialog>
                         </div>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4 p-4">
              {isLoading ?
                Array(3).fill(0).map((_, i) => (
                  <Card key={i} className="p-4">
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2 mb-2" />
                    <Skeleton className="h-8 w-full" />
                  </Card>
                )) :
                filteredBatches.map((batch) => (
                  <Card 
                    key={batch.id} 
                    className="border-0 backdrop-blur-xl bg-white/80 hover:bg-white/95 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer rounded-2xl overflow-hidden group"
                    onClick={() => navigate(createPageUrl(`BatchAnalytics?batch_id=${batch.id}`))}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <CardContent className="p-4 relative z-10">
                      <div className="space-y-3">
                        <div>
                          <h3 className="font-bold text-lg text-gray-800">{batch.batch_name}</h3>
                          <p className="text-sm text-gray-600">{batch.batch_description || ''}</p>
                        </div>

                        <div className="space-y-2">
                          {batch.batch_type !== 'private' ? (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-blue-700">🏛️ {batch.college_name}</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Badge className="bg-indigo-100 text-indigo-800">📅 {batch.year}</Badge>
                                <Badge className="bg-purple-100 text-purple-800">🔬 {batch.branch}</Badge>
                                {batch.division && (
                                  <Badge className="bg-pink-100 text-pink-800">📂 Div {batch.division}</Badge>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="text-sm text-gray-500 italic">N/A for Private Batch</div>
                          )}
                          <div className="flex items-center justify-between">
                            <Badge className={
                              batch.batch_type === 'private' ? 'bg-purple-100 text-purple-800' :
                              batch.batch_type === 'custom' ? 'bg-orange-100 text-orange-800' :
                              'bg-blue-100 text-blue-800'
                            }>
                              {batch.batch_type ? batch.batch_type.charAt(0).toUpperCase() + batch.batch_type.slice(1) : 'Standard'} Batch
                            </Badge>
                            <Badge className="bg-green-100 text-green-800 font-bold">
                              👥 {batch.student_count || 0} Students
                            </Badge>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(createPageUrl(`StudentRecordsPage?batch_id=${batch.id}`));
                            }}
                            className="flex-1 border-blue-500 text-blue-600 hover:bg-blue-50"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              exportBatchData(batch);
                            }}
                            disabled={isExporting && exportingId === batch.id}
                            className="flex-1"
                          >
                            {isExporting && exportingId === batch.id ?
                              <Clock className="w-4 h-4 mr-1 animate-spin" /> :
                              <Download className="w-4 h-4 mr-1" />
                            }
                            Export
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              }
            </div>

            {filteredBatches.length === 0 && !isLoading && (
              <div className="text-center py-12 text-slate-500">
                <Users className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-semibold mb-2">📭 No batches found</h3>
                <p>Try adjusting your search filters or create a new batch.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <CreateBatchModal
        isOpen={isCreateModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onBatchCreated={() => {
          loadBatches();
          refreshBatches(); // Trigger global sync
        }}
      />

      <BulkEmailUploadModal
        isOpen={isEmailUploadModalOpen}
        onClose={() => setEmailUploadModalOpen(false)}
        onSuccess={loadBatches}
      />

      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}</style>
    </div>
  );
}