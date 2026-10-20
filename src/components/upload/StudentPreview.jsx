import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Save, Edit, Check, X } from "lucide-react";

export default function StudentPreview({ students, classDetails, onSave, onBack, isProcessing }) {
  const [editableStudents, setEditableStudents] = useState(students);
  const [editingIndex, setEditingIndex] = useState(-1);

  const handleEdit = (index) => {
    setEditingIndex(index);
  };

  const handleSave = (index) => {
    setEditingIndex(-1);
  };

  const handleCancel = () => {
    setEditableStudents(students);
    setEditingIndex(-1);
  };

  const handleFieldChange = (index, field, value) => {
    const updated = [...editableStudents];
    updated[index] = { ...updated[index], [field]: value };
    setEditableStudents(updated);
  };

  return (
    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Review Student Data</CardTitle>
        <div className="text-sm text-slate-600 space-y-1">
          <p><strong>College:</strong> {classDetails.college_name}</p>
          <p><strong>Year:</strong> {classDetails.year} | <strong>Branch:</strong> {classDetails.branch}</p>
          <p><strong>Time Slot:</strong> {classDetails.time_slot}</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="font-semibold">Student Name</TableHead>
                  <TableHead className="font-semibold">PRN</TableHead>
                  <TableHead className="font-semibold">Roll No</TableHead>
                  <TableHead className="font-semibold w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {editableStudents.map((student, index) => (
                  <TableRow key={index} className="hover:bg-slate-50">
                    <TableCell>
                      {editingIndex === index ? (
                        <Input
                          value={student.name || ''}
                          onChange={(e) => handleFieldChange(index, 'name', e.target.value)}
                          className="h-8"
                        />
                      ) : (
                        student.name || 'N/A'
                      )}
                    </TableCell>
                    <TableCell>
                      {editingIndex === index ? (
                        <Input
                          value={student.prn || ''}
                          onChange={(e) => handleFieldChange(index, 'prn', e.target.value)}
                          className="h-8"
                        />
                      ) : (
                        student.prn || 'N/A'
                      )}
                    </TableCell>
                    <TableCell>
                      {editingIndex === index ? (
                        <Input
                          value={student.roll_no || ''}
                          onChange={(e) => handleFieldChange(index, 'roll_no', e.target.value)}
                          className="h-8"
                        />
                      ) : (
                        student.roll_no || 'N/A'
                      )}
                    </TableCell>
                    <TableCell>
                      {editingIndex === index ? (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => handleSave(index)}>
                            <Check className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={handleCancel}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(index)}>
                          <Edit className="w-3 h-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex gap-4 pt-4">
            <Button variant="outline" onClick={onBack} className="flex-1">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button 
              onClick={() => onSave(editableStudents)}
              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              disabled={isProcessing}
            >
              <Save className="w-4 h-4 mr-2" />
              {isProcessing ? 'Saving...' : `Save ${editableStudents.length} Students`}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}