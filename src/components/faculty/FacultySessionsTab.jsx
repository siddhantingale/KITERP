import React, { useState, useEffect } from "react";
import { FacultySession } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Trash2, Calendar, Clock, BookOpen } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function FacultySessionsTab({ faculty }) {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [formData, setFormData] = useState({
    session_title: "",
    subject_module: "",
    batch_class: "",
    session_date: "",
    start_time: "",
    end_time: "",
    total_hours: 0,
    mode: "Offline",
    remarks: ""
  });

  useEffect(() => {
    loadSessions();
  }, [faculty.id]);

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const data = await FacultySession.filter({ faculty_id: faculty.id }, "-session_date");
      setSessions(data);
    } catch (error) {
      console.error("Error loading sessions:", error);
    }
    setIsLoading(false);
  };

  const calculateHours = (start, end) => {
    if (!start || !end) return 0;
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    const hours = (endHour * 60 + endMin - startHour * 60 - startMin) / 60;
    return Math.max(0, hours);
  };

  const handleTimeChange = (field, value) => {
    const newFormData = { ...formData, [field]: value };
    if (newFormData.start_time && newFormData.end_time) {
      newFormData.total_hours = calculateHours(newFormData.start_time, newFormData.end_time);
    }
    setFormData(newFormData);
  };

  const handleSubmit = async () => {
    try {
      const sessionData = {
        ...formData,
        faculty_id: faculty.id,
        faculty_email: faculty.email
      };

      if (editingSession) {
        await FacultySession.update(editingSession.id, sessionData);
      } else {
        await FacultySession.create(sessionData);
      }

      loadSessions();
      handleCloseModal();
    } catch (error) {
      console.error("Error saving session:", error);
      alert("Failed to save session");
    }
  };

  const handleEdit = (session) => {
    setEditingSession(session);
    setFormData({
      session_title: session.session_title,
      subject_module: session.subject_module || "",
      batch_class: session.batch_class || "",
      session_date: session.session_date,
      start_time: session.start_time || "",
      end_time: session.end_time || "",
      total_hours: session.total_hours,
      mode: session.mode || "Offline",
      remarks: session.remarks || ""
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (sessionId) => {
    if (!confirm("Delete this session?")) return;
    try {
      await FacultySession.delete(sessionId);
      loadSessions();
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSession(null);
    setFormData({
      session_title: "",
      subject_module: "",
      batch_class: "",
      session_date: "",
      start_time: "",
      end_time: "",
      total_hours: 0,
      mode: "Offline",
      remarks: ""
    });
  };

  const totalHours = sessions.reduce((sum, s) => sum + (s.total_hours || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold">Teaching Sessions</h3>
          <p className="text-sm text-gray-600">Total Hours: <span className="font-bold text-blue-600">{totalHours.toFixed(2)}</span></p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Session
        </Button>
      </div>

      <div className="grid gap-4">
        {sessions.map((session) => (
          <Card key={session.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    <h4 className="font-semibold text-lg">{session.session_title}</h4>
                    <span className={`px-2 py-1 text-xs rounded-full ${session.mode === 'Online' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                      {session.mode}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    {session.subject_module && <p>📚 {session.subject_module}</p>}
                    {session.batch_class && <p>👥 {session.batch_class}</p>}
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(session.session_date), "dd MMM yyyy")}
                      </span>
                      {session.start_time && session.end_time && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {session.start_time} - {session.end_time}
                        </span>
                      )}
                      <span className="font-bold text-blue-600">{session.total_hours}h</span>
                    </div>
                    {session.remarks && <p className="italic text-gray-500 mt-1">"{session.remarks}"</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => handleEdit(session)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDelete(session.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {sessions.length === 0 && !isLoading && (
          <Card>
            <CardContent className="text-center py-12">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No sessions recorded yet</p>
              <Button onClick={() => setIsModalOpen(true)} className="mt-4">Add First Session</Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={handleCloseModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingSession ? "Edit Session" : "Add New Session"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <Label>Session Title *</Label>
              <Input
                value={formData.session_title}
                onChange={(e) => setFormData({...formData, session_title: e.target.value})}
                placeholder="e.g., Advanced Java Programming"
              />
            </div>
            <div>
              <Label>Subject / Module</Label>
              <Input
                value={formData.subject_module}
                onChange={(e) => setFormData({...formData, subject_module: e.target.value})}
                placeholder="e.g., Core Java"
              />
            </div>
            <div>
              <Label>Batch / Class</Label>
              <Input
                value={formData.batch_class}
                onChange={(e) => setFormData({...formData, batch_class: e.target.value})}
                placeholder="e.g., CSE Third Year"
              />
            </div>
            <div>
              <Label>Session Date *</Label>
              <Input
                type="date"
                value={formData.session_date}
                onChange={(e) => setFormData({...formData, session_date: e.target.value})}
              />
            </div>
            <div>
              <Label>Mode *</Label>
              <Select value={formData.mode} onValueChange={(value) => setFormData({...formData, mode: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Online">Online</SelectItem>
                  <SelectItem value="Offline">Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Start Time</Label>
              <Input
                type="time"
                value={formData.start_time}
                onChange={(e) => handleTimeChange('start_time', e.target.value)}
              />
            </div>
            <div>
              <Label>End Time</Label>
              <Input
                type="time"
                value={formData.end_time}
                onChange={(e) => handleTimeChange('end_time', e.target.value)}
              />
            </div>
            <div>
              <Label>Total Hours *</Label>
              <Input
                type="number"
                step="0.5"
                value={formData.total_hours}
                onChange={(e) => setFormData({...formData, total_hours: parseFloat(e.target.value) || 0})}
              />
            </div>
            <div className="col-span-2">
              <Label>Remarks / Notes</Label>
              <Textarea
                value={formData.remarks}
                onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                placeholder="Any additional notes..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>Cancel</Button>
            <Button onClick={handleSubmit}>
              {editingSession ? "Update Session" : "Add Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}