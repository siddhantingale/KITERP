import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, User, Calendar, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

export default function StudentCoursesAndFaculty({ student }) {
  const [subjects, setSubjects] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSemester, setSelectedSemester] = useState('all');
  const [expandedSubject, setExpandedSubject] = useState(null);

  useEffect(() => {
    fetchData();
  }, [student]);

  const fetchData = async () => {
    try {
      // Fetch subject mappings
      const mappings = await api.entities.FacultySubjectMapping.filter({
        year: student.year,
        division: student.division,
        is_active: true
      });

      // Fetch sessions for this student's batch
      const batchSessions = await api.entities.Session.filter({
        batch_id: student.batch_id
      });

      // Fetch performance records
      const performanceRecords = await api.entities.StudentPerformance.filter({
        student_id: student.id
      });

      setSubjects(mappings);
      setSessions(batchSessions);
      setPerformance(performanceRecords);
    } catch (error) {
      console.error("Error fetching courses data:", error);
    }
    setLoading(false);
  };

  const getSubjectSessions = (subjectName) => {
    return sessions.filter(s => 
      s.topic_taught === subjectName || s.session_name?.includes(subjectName)
    );
  };

  const getSubjectPerformance = (subjectName) => {
    return performance.filter(p => p.subject === subjectName);
  };

  const uniqueSemesters = [...new Set(performance.map(p => p.semester).filter(Boolean))];

  const filteredSubjects = selectedSemester === 'all' 
    ? subjects 
    : subjects.filter(s => {
        const subjectPerf = performance.filter(p => p.subject === s.subject_name);
        return subjectPerf.some(p => p.semester === selectedSemester);
      });

  if (loading) {
    return <div className="h-96 bg-gray-200 rounded animate-pulse"></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📚 Courses & Faculty</h1>
          <p className="text-gray-600 mt-1">Your subjects and assigned faculty</p>
        </div>
      </div>

      {/* Semester Filter */}
      {uniqueSemesters.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-gray-700">Filter by Semester:</span>
              <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Semesters</SelectItem>
                  {uniqueSemesters.map(sem => (
                    <SelectItem key={sem} value={sem}>{sem}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subject Cards */}
      <div className="grid gap-6">
        {filteredSubjects.length > 0 ? (
          filteredSubjects.map((mapping) => {
            const subjectSessions = getSubjectSessions(mapping.subject_name);
            const subjectPerf = getSubjectPerformance(mapping.subject_name);
            const isExpanded = expandedSubject === mapping.id;

            return (
              <Card key={mapping.id} className="border-0 shadow-lg hover:shadow-xl transition-all">
                <CardHeader 
                  className="bg-gradient-to-r from-blue-50 to-indigo-50 cursor-pointer"
                  onClick={() => setExpandedSubject(isExpanded ? null : mapping.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-3 rounded-xl">
                        <BookOpen className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{mapping.subject_name}</CardTitle>
                        <p className="text-sm text-gray-600">
                          {mapping.subject_code && `${mapping.subject_code} • `}
                          {mapping.weekly_lecture_count} lectures/week
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-blue-600 text-white">
                        {mapping.subject_type}
                      </Badge>
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-6">
                  {/* Faculty Info */}
                  <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl mb-4">
                    <div className="bg-gradient-to-br from-purple-600 to-pink-600 p-2 rounded-lg">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 font-semibold">Faculty Assigned</p>
                      <p className="font-bold text-gray-900">{mapping.faculty_name}</p>
                      <p className="text-xs text-gray-500">{mapping.faculty_email}</p>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="space-y-4 mt-4 border-t pt-4">
                      {/* Performance Records */}
                      {subjectPerf.length > 0 && (
                        <div>
                          <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-600" />
                            Performance Records
                          </h4>
                          <div className="space-y-2">
                            {subjectPerf.map((perf) => (
                              <div key={perf.id} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                                <div>
                                  <p className="font-semibold text-sm text-gray-900">{perf.assessment_type}</p>
                                  <p className="text-xs text-gray-500">
                                    {perf.assessment_date && format(new Date(perf.assessment_date), 'PP')} • {perf.semester}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-gray-900">{perf.marks_obtained}/{perf.total_marks}</p>
                                  <Badge className={`text-xs ${
                                    perf.percentage >= 90 ? 'bg-green-100 text-green-800' :
                                    perf.percentage >= 75 ? 'bg-blue-100 text-blue-800' :
                                    perf.percentage >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {perf.grade || `${perf.percentage}%`}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recent Sessions */}
                      {subjectSessions.length > 0 && (
                        <div>
                          <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-blue-600" />
                            Recent Sessions ({subjectSessions.length})
                          </h4>
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {subjectSessions.slice(0, 5).map((session) => (
                              <div key={session.id} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="font-semibold text-sm text-gray-900">{session.session_name}</p>
                                <p className="text-xs text-gray-600 mt-1">
                                  {format(new Date(session.session_date), 'PP')} • {session.session_time}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {subjectPerf.length === 0 && subjectSessions.length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-4">No records available for this subject</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-12 text-center">
              <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No subjects assigned yet</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}