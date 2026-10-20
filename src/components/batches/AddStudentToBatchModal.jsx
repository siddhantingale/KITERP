import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle } from "lucide-react";
import { Student, Batch } from "@/entities/all"; // Make sure Batch is imported

export default function AddStudentToBatchModal({ isOpen, onClose, onStudentAdded, batch }) {
  const [formData, setFormData] = useState({ name: "", prn: "", roll_no: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    if (!formData.name || !formData.roll_no) {
        setError("Student Name and Roll Number are required.");
        return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const studentData = {
          ...formData,
          batch_id: batch.batch_id,
          // Inherit details from the batch itself
          college_name: batch.college_name,
          year: batch.year,
          branch: batch.branch,
          division: batch.division,
      };

      await Student.create(studentData);
      
      // Update batch student count
      await Batch.update(batch.id, { student_count: (batch.student_count || 0) + 1 });

      onStudentAdded(); // This will close modal and reload data on parent
      
      // Clear form for next entry if modal were to stay open
      setFormData({ name: "", prn: "", roll_no: "" }); 
    } catch (err) {
      console.error("Failed to save student", err);
      setError("An error occurred while saving. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5" /> Add Student to {batch?.batch_name}
          </DialogTitle>
          <DialogDescription>
            Manually add a new student to this batch. Name and Roll No. are required.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <Label htmlFor="add-name">Student Name *</Label>
            <Input
              id="add-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter full name"
            />
          </div>
           <div>
            <Label htmlFor="add-prn">PRN (Optional)</Label>
            <Input
              id="add-prn"
              value={formData.prn}
              onChange={(e) => setFormData({ ...formData, prn: e.target.value })}
              placeholder="Enter PRN if available"
            />
          </div>
          <div>
            <Label htmlFor="add-roll_no">Roll Number *</Label>
            <Input
              id="add-roll_no"
              value={formData.roll_no}
              onChange={(e) => setFormData({ ...formData, roll_no: e.target.value })}
              placeholder="Enter roll number"
            />
          </div>
        </div>
        <DialogFooter className="justify-between">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Student"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}