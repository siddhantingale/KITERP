import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, BookOpen, Mail, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function StudentFacultyAllocation({ student }) {
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFacultyAllocations();
  }, [student]);

  const fetchFacultyAllocations = async () => {
    if (!student?.year || !student?.division) {
      setLoading(false);
      return;
    }

    try {
      const mappings = await api.entities.FacultySubjectMapping.filter({
        year: student.year,
        division: student.division,
        is_active: true
      });

      // Group by subject and deduplicate
      const uniqueSubjects = mappings.reduce((acc, mapping) => {
        if (!acc.find(m => m.subject_name === mapping.subject_name)) {
          acc.push(mapping);
        }
        return acc;
      }, []);

      setAllocations(uniqueSubjects.sort((a, b) => 
        a.subject_name.localeCompare(b.subject_name)
      ));
    } catch (error) {
      console.error("Error fetching faculty allocations:", error);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-purple-600" />
            My Class Faculty & Subjects
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 bg-gray-100 rounded animate-pulse"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
      <CardHeader className="pb-3 bg-gradient-to-r from-purple-50 to-blue-50 border-b">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-purple-600" />
          My Class Faculty & Subjects
        </CardTitle>
        {student?.year && student?.division && (
          <p className="text-xs text-gray-600 mt-1">
            {student.year} • {student.division}
          </p>
        )}
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {allocations.length === 0 ? (
          <div className="text-center py-8">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 text-sm">Faculty allocation not assigned yet</p>
            <p className="text-gray-500 text-xs mt-1">Contact your admin for updates</p>
          </div>
        ) : (
          <div className="space-y-3">
            {allocations.map((allocation, idx) => (
              <div 
                key={idx} 
                className="flex items-start gap-3 p-3 sm:p-4 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 hover:shadow-md transition-all"
              >
                <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg">
                  <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-900 text-sm sm:text-base">
                      {allocation.subject_name}
                    </h3>
                    {allocation.subject_code && (
                      <Badge variant="outline" className="text-xs font-mono">
                        {allocation.subject_code}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs sm:text-sm text-gray-700">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600 flex-shrink-0" />
                      <span className="font-medium truncate">{allocation.faculty_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
                      <span className="truncate text-xs">{allocation.faculty_email}</span>
                    </div>
                  </div>
                  {allocation.weekly_lecture_count && (
                    <div className="mt-2">
                      <Badge className="bg-blue-100 text-blue-700 text-xs">
                        {allocation.weekly_lecture_count} lectures/week
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}