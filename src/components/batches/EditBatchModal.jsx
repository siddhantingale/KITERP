import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
// Assuming Batch entity for schema access

const years = ["First Year", "Second Year", "Third Year", "Fourth Year"];
const branches = [
  "Computer Science", 
  "Information Technology", 
  "Electronics Engineering", 
  "Mechanical Engineering", 
  "Civil Engineering", 
  "Electrical Engineering"
];
const colleges = [
  "KIT KOLHAPUR", "TKIT WARNA", "WCE SANGLI", "WIT SOLAPUR", 
  "SVERI PANDHARPUR", "SINHAGAD", "SSPM", "RIT ISLAMPUR"
];


export default function EditBatchModal({ isOpen, onClose, batch, onSave }) {
  const [formData, setFormData] = useState({
    batch_name: "",
    college_name: "",
    year: "",
    branch: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (batch) {
      setFormData({
        batch_name: batch.batch_name || "",
        college_name: batch.college_name || "",
        year: batch.year || "",
        branch: batch.branch || "",
      });
    }
  }, [batch]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    // Exclude batch_id and student_count from being sent for update as they are either fixed or derived
    const { batch_id, student_count, created_by, ...updateData } = formData;
    updateData.batch_id = batch.batch_id; // ensure batch_id is part of the update payload if it's not meant to change but needed by backend
                                     // Actually, batch_id should likely NOT be updatable.
                                     // Let's assume only descriptive fields are updatable.
    const dataToSave = {
        batch_name: formData.batch_name,
        college_name: formData.college_name,
        year: formData.year,
        branch: formData.branch,
    }

    await onSave(dataToSave);
    setIsLoading(false);
  };

  if (!batch) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] md:sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Edit Batch Details</DialogTitle>
          <DialogDescription>
            Make changes to the batch information. Click save when you're done.
            Student count and Batch ID are not directly editable here.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="batch_name" className="text-right">
              Batch Name
            </Label>
            <Input
              id="batch_name"
              value={formData.batch_name}
              onChange={(e) => handleChange('batch_name', e.target.value)}
              className="col-span-3"
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="college_name" className="text-right">
              College
            </Label>
            <Select
                value={formData.college_name}
                onValueChange={(value) => handleChange('college_name', value)}
            >
                <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select college" />
                </SelectTrigger>
                <SelectContent>
                    {colleges.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="year" className="text-right">
              Year
            </Label>
            <Select
                value={formData.year}
                onValueChange={(value) => handleChange('year', value)}
            >
                <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                    {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="branch" className="text-right">
              Branch
            </Label>
            <Select
                value={formData.branch}
                onValueChange={(value) => handleChange('branch', value)}
            >
                <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                    {branches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
            </Select>
          </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}