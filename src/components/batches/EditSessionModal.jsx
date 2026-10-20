import React, { useState, useEffect } from "react";
import { Session, Faculty } from "@/entities/all";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Edit, AlertCircle } from "lucide-react";
import { format } from "date-fns";

const durations = ["1 Hour", "1.5 Hours", "2 Hours", "2.5 Hours", "3 Hours"];

export default function EditSessionModal({ isOpen, onClose, session, onSessionUpdated, batch }) {
  const [formData, setFormData] = useState({
    session_name: "",
    topic_taught: "",
    faculty_name: "",
    faculty_email: "",
    session_date: "",
    session_time: "",
    duration: "1 Hour",
    status: "completed"
  });
  const [faculties, setFaculties] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (session) {
      setFormData({
        session_name: session.session_name || "",
        topic_taught: session.topic_taught || "",
        faculty_name: session.faculty_name || "",
        faculty_email: session.faculty_email || "",
        session_date: session.session_date ? format(new Date(session.session_date), 'yyyy-MM-dd') : "",
        session_time: session.session_time || "",
        duration: session.duration || "1 Hour",
        status: session.status || "completed"
      });
    }
  }, [session]);

  useEffect(() => {
    const loadFaculties = async () => {
      try {
        const facultyData = await Faculty.list();
        setFaculties(facultyData);
      } catch (error) {
        console.error("Error loading faculties:", error);
      }
    };
    if (isOpen) {
      loadFaculties();
    }
  }, [isOpen]);

  const handleFacultyChange = (email) => {
    const selectedFaculty = faculties.find(f => f.email === email);
    if (selectedFaculty) {
      setFormData(prev => ({
        ...prev,
        faculty_name: selectedFaculty.name,
        faculty_email: selectedFaculty.email,
      }));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      if (!formData.topic_taught || !formData.faculty_email || !formData.session_date || !formData.session_time) {
        setError("Please fill in all required fields.");
        setIsSaving(false);
        return;
      }

      const updateData = {
        session_name: formData.session_name || `Session: ${formData.topic_taught}`,
        topic_taught: formData.topic_taught,
        faculty_name: formData.faculty_name,
        faculty_email: formData.faculty_email,
        session_date: formData.session_date,
        session_time: formData.session_time,
        duration: formData.duration,
        status: formData.status
      };

      await Session.update(session.id, updateData);
      onSessionUpdated();
      onClose();
    } catch (error) {
      console.error("Failed to update session:", error);
      setError(`Failed to update session: ${error.message}`);
    }
    setIsSaving(false);
  };

  if (!session) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-6 h-6" />
            Edit Session
          </DialogTitle>
          <DialogDescription>
            Update session details for: <strong>{batch?.batch_name}</strong>
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="session_name">Session Name</Label>
              <Input
                id="session_name"
                value={formData.session_name}
                onChange={(e) => setFormData({...formData, session_name: e.target.value})}
                placeholder="e.g., Morning Session"
              />
            </div>
            <div>
              <Label htmlFor="topic_taught">Topic Taught *</Label>
              <Input
                id="topic_taught"
                value={formData.topic_taught}
                onChange={(e) => setFormData({...formData, topic_taught: e.target.value})}
                placeholder="e.g., Database Management"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="faculty_email">Faculty *</Label>
            <Select 
              value={formData.faculty_email} 
              onValueChange={handleFacultyChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select faculty member" />
              </SelectTrigger>
              <SelectContent>
                {faculties.map((faculty) => (
                  <SelectItem key={faculty.id} value={faculty.email}>
                    {faculty.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="session_date">Session Date *</Label>
              <Input
                id="session_date"
                type="date"
                value={formData.session_date}
                onChange={(e) => setFormData({...formData, session_date: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="session_time">Session Time *</Label>
              <Input
                id="session_time"
                type="time"
                value={formData.session_time}
                onChange={(e) => setFormData({...formData, session_time: e.target.value})}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="duration">Duration</Label>
              <Select 
                value={formData.duration} 
                onValueChange={(value) => setFormData({...formData, duration: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {durations.map((duration) => (
                    <SelectItem key={duration} value={duration}>
                      {duration}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => setFormData({...formData, status: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}