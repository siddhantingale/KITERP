import React, { useState, useEffect } from "react";
import { Student } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, GraduationCap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function BatchSelector({ onBatchSelect, isLoading }) {
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(true);

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    try {
      const students = await Student.list();
      const batchMap = {};
      
      students.forEach(student => {
        if (!batchMap[student.batch_id]) {
          batchMap[student.batch_id] = {
            batch_id: student.batch_id,
            college_name: student.college_name,
            year: student.year,
            branch: student.branch,
            student_count: 0
          };
        }
        batchMap[student.batch_id].student_count++;
      });
      
      setBatches(Object.values(batchMap));
    } catch (error) {
      console.error("Error loading batches:", error);
    }
    setLoadingBatches(false);
  };

  if (loadingBatches) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Select Batch</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array(3).fill(0).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-3 w-24 mb-4" />
                <Skeleton className="h-8 w-full" />
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-3">
          <GraduationCap className="w-7 h-7 text-blue-600" />
          Select Batch for Attendance
        </CardTitle>
        <p className="text-slate-600">Choose the class batch to take attendance for</p>
      </CardHeader>
      <CardContent>
        {batches.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Batches Found</h3>
            <p className="text-slate-600">Please upload student data first to create batches</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {batches.map((batch) => (
              <Card key={batch.batch_id} className="hover:shadow-md transition-shadow cursor-pointer border border-slate-200">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-bold text-slate-900 text-lg">{batch.college_name}</h3>
                      <p className="text-slate-600">{batch.year} - {batch.branch}</p>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Users className="w-4 h-4" />
                      <span>{batch.student_count} students</span>
                    </div>
                    
                    <Button
                      onClick={() => onBatchSelect(batch)}
                      disabled={isLoading}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    >
                      {isLoading ? "Loading..." : "Select Batch"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}