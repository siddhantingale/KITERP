import React, { useState, useEffect } from "react";
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
import { Edit } from "lucide-react";

export default function EditStudentModal({ isOpen, onClose, student, onSave }) {
  const [formData, setFormData] = useState({ name: "", prn: "", roll_no: "", email: "" });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (student) {
      setFormData({
        name: student.name || "",
        prn: student.prn || "",
        roll_no: student.roll_no || "",
        email: student.email || "",
      });
    }
  }, [student]);

  const handleSave = async () => {
    if (!formData.name || !formData.roll_no) {
        alert("Student Name and Roll Number are required.");
        return;
    }
    setIsSaving(true);
    try {
      await onSave(student.id, formData);
      onClose();
    } catch (error) {
      console.error("Failed to save student data", error);
      alert("An error occurred while saving. Please try again.");
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
            <Edit className="w-5 h-5" /> Edit Student Details
          </DialogTitle>
          <DialogDescription>
            Update the information for {student?.name}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <Label htmlFor="name">Student Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Full Name"
            />
          </div>
          <div>
            <Label htmlFor="prn">PRN (Permanent Registration Number)</Label>
            <Input
              id="prn"
              value={formData.prn}
              onChange={(e) => setFormData({ ...formData, prn: e.target.value })}
              placeholder="PRN (if applicable)"
            />
          </div>
          <div>
            <Label htmlFor="roll_no">Roll Number</Label>
            <Input
              id="roll_no"
              value={formData.roll_no}
              onChange={(e) => setFormData({ ...formData, roll_no: e.target.value })}
              placeholder="Roll Number"
            />
          </div>
          <div>
            <Label htmlFor="email">Student Email (Gmail for Login)</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="student@gmail.com"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}