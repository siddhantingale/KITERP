
import React, { useState, useEffect } from "react";
import { Faculty } from "@/entities/all";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle } from "lucide-react";
import { format } from "date-fns";

export default function AddPastSessionModal({ isOpen, onClose, onSave, batch }) {
  const [topic, setTopic] = useState("");
  const [facultyEmail, setFacultyEmail] = useState("");
  const [sessionDate, setSessionDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [sessionTime, setSessionTime] = useState("");
  const [faculties, setFaculties] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Reset form on open
      setTopic("");
      setFacultyEmail("");
      setSessionDate(format(new Date(), "yyyy-MM-dd"));
      setSessionTime("");
      
      const fetchFaculties = async () => {
        try {
          const facultyData = await Faculty.list();
          setFaculties(facultyData);
        } catch (error) {
          console.error("Failed to fetch faculties", error);
        }
      };
      fetchFaculties();
    }
  }, [isOpen]);

  const handleSave = async () => {
    // Only require Date and Time - Topic and Faculty are optional
    if (!sessionDate || !sessionTime) {
      alert("Please fill required fields: Date and Time.");
      return;
    }
    
    setIsSaving(true);
    
    // Provide default values if topic or faculty are not selected
    const sessionData = {
      topic: topic || "Topic to be updated",
      facultyEmail: facultyEmail || "",
      sessionDate,
      sessionTime
    };
    
    await onSave(sessionData);
    setIsSaving(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusCircle className="w-6 h-6" /> Add Past Session to Batch
          </DialogTitle>
          <DialogDescription>
            Quickly create a session for <strong>{batch?.batch_name}</strong>. Only Date and Time are required.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <Label htmlFor="topic">Topic Taught (Optional)</Label>
            <Input
              id="topic"
              placeholder="Can be updated later if needed"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="faculty">Faculty (Optional)</Label>
             <Select value={facultyEmail} onValueChange={setFacultyEmail}>
                <SelectTrigger><SelectValue placeholder="Can be selected later" /></SelectTrigger>
                <SelectContent>
                    {faculties.map((f) => (
                        <SelectItem key={f.id} value={f.email}>
                            {f.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
                <Label htmlFor="date">Session Date *</Label>
                <Input
                    id="date"
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                />
            </div>
            <div>
                <Label htmlFor="time">Session Time *</Label>
                <Input
                    id="time"
                    type="time"
                    value={sessionTime}
                    onChange={(e) => setSessionTime(e.target.value)}
                />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving || !sessionDate || !sessionTime}>
            {isSaving ? "Creating..." : "Create Session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
