import React, { useState, useEffect } from "react";
import { TimeTable, Batch, Faculty, User } from "@/entities/all";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Plus, Edit, Trash2, Download, Filter } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const timeSlots = [
  "08:00 AM - 09:00 AM",
  "09:00 AM - 10:00 AM",
  "10:00 AM - 11:00 AM",
  "11:00 AM - 12:00 PM",
  "12:00 PM - 01:00 PM",
  "01:00 PM - 02:00 PM",
  "02:00 PM - 03:00 PM",
  "03:00 PM - 04:00 PM",
  "04:00 PM - 05:00 PM"
];
const classTypes = ["Lecture", "Lab", "Tutorial", "Practical"];

export default function TimeTablePage() {
  const [timetableEntries, setTimetableEntries] = useState([]);
  const [batches, setBatches] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [message, setMessage] = useState(null);
  const [filterBatch, setFilterBatch] = useState("");
  const [filterDay, setFilterDay] = useState("");
  const [suggestedSubjects, setSuggestedSubjects] = useState([]);
  const [allowManualSubject, setAllowManualSubject] = useState(false);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [formData, setFormData] = useState({
    batch_id: "",
    day_of_week: "Monday",
    time_slot: "",
    subject: "",
    faculty_email: "",
    room_number: "",
    class_type: "Lecture",
    semester: "",
    academic_year: "2025-26"
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      setIsAdmin(currentUser.role === 'admin');
      
      const [ttData, batchData, facultyData] = await Promise.all([
        TimeTable.list("-created_date", 500),
        Batch.list(),
        Faculty.list()
      ]);
      setTimetableEntries(ttData);
      setBatches(batchData);
      setFaculties(facultyData);
    } catch (error) {
      console.error("Error loading data:", error);
      setMessage({ type: "error", text: "Failed to load data" });
    }
    setIsLoading(false);
  };

  const loadFacultySubjects = async (facultyEmail, batchId) => {
    if (!facultyEmail || !batchId) {
      setSuggestedSubjects([]);
      return;
    }

    try {
      const batch = batches.find(b => b.id === batchId);
      if (!batch) return;

      const mappings = await api.entities.FacultySubjectMapping.filter({
        faculty_email: facultyEmail,
        year: batch.year,
        division: batch.division,
        is_active: true
      });

      if (mappings.length > 0) {
        setSuggestedSubjects(mappings);
        if (mappings.length === 1 && !allowManualSubject) {
          setFormData(prev => ({ ...prev, subject: mappings[0].subject_name }));
        }
      } else {
        setSuggestedSubjects([]);
        setAllowManualSubject(true);
      }
    } catch (error) {
      console.error("Error loading faculty subjects:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const selectedBatch = batches.find(b => b.id === formData.batch_id);
      const selectedFaculty = faculties.find(f => f.email === formData.faculty_email);
      
      if (!selectedBatch || !selectedFaculty) {
        setMessage({ type: "error", text: "Please select valid batch and faculty" });
        return;
      }

      const entryData = {
        ...formData,
        college_name: selectedBatch.college_name,
        year: selectedBatch.year,
        branch: selectedBatch.branch,
        division: selectedBatch.division,
        faculty_name: selectedFaculty.name
      };

      if (editingEntry) {
        await TimeTable.update(editingEntry.id, entryData);
        setMessage({ type: "success", text: "Timetable entry updated successfully" });
      } else {
        await TimeTable.create(entryData);
        setMessage({ type: "success", text: "Timetable entry added successfully" });
      }

      await loadData();
      resetForm();
      setShowAddModal(false);
    } catch (error) {
      console.error("Error saving entry:", error);
      setMessage({ type: "error", text: "Failed to save entry" });
    }
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setFormData({
      batch_id: entry.batch_id,
      day_of_week: entry.day_of_week,
      time_slot: entry.time_slot,
      subject: entry.subject,
      faculty_email: entry.faculty_email,
      room_number: entry.room_number || "",
      class_type: entry.class_type,
      semester: entry.semester || "",
      academic_year: entry.academic_year || "2025-26"
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;
    try {
      await TimeTable.delete(id);
      setMessage({ type: "success", text: "Entry deleted successfully" });
      await loadData();
    } catch (error) {
      console.error("Error deleting entry:", error);
      setMessage({ type: "error", text: "Failed to delete entry" });
    }
  };

  const resetForm = () => {
    setFormData({
      batch_id: "",
      day_of_week: "Monday",
      time_slot: "",
      subject: "",
      faculty_email: "",
      room_number: "",
      class_type: "Lecture",
      semester: "",
      academic_year: "2025-26"
    });
    setEditingEntry(null);
  };

  const exportToCSV = () => {
    const filtered = getFilteredEntries();
    const headers = ["Day", "Time Slot", "Subject", "Faculty", "Batch", "Room", "Type"];
    const rows = filtered.map(entry => [
      entry.day_of_week,
      entry.time_slot,
      entry.subject,
      entry.faculty_name,
      batches.find(b => b.batch_id === entry.batch_id)?.batch_name || entry.batch_id,
      entry.room_number || "N/A",
      entry.class_type
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "timetable.csv";
    a.click();
  };

  const getFilteredEntries = () => {
    return timetableEntries.filter(entry => {
      const batchMatch = !filterBatch || entry.batch_id === filterBatch;
      const dayMatch = !filterDay || entry.day_of_week === filterDay;
      return batchMatch && dayMatch;
    });
  };

  const groupByDay = () => {
    const filtered = getFilteredEntries();
    const grouped = {};
    daysOfWeek.forEach(day => {
      grouped[day] = filtered.filter(e => e.day_of_week === day).sort((a, b) => a.time_slot.localeCompare(b.time_slot));
    });
    return grouped;
  };

  const groupedEntries = groupByDay();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-40 w-96 h-96 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-20 -left-40 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      </div>
      
      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Calendar className="w-8 h-8 text-blue-600" />
              Class Timetable
            </h1>
            <p className="text-gray-600">Manage and view class schedules</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {isAdmin && (
              <Button onClick={() => window.location.href = createPageUrl("AITimetableGenerator")} variant="outline" className="gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600">
                <Calendar className="w-4 h-4" />
                <span className="hidden sm:inline">AI Timetable</span>
              </Button>
            )}
            <Button onClick={exportToCSV} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
            {isAdmin && (
            <Dialog open={showAddModal} onOpenChange={(open) => {
              setShowAddModal(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
                  <Plus className="w-4 h-4" />
                  Add Class
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingEntry ? "Edit" : "Add"} Timetable Entry</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Batch *</Label>
                      <Select value={formData.batch_id} onValueChange={(value) => setFormData({...formData, batch_id: value})}>
                        <SelectTrigger><SelectValue placeholder="Select batch"/></SelectTrigger>
                        <SelectContent>
                          {batches.map(b => (
                            <SelectItem key={b.id} value={b.batch_id}>
                              {b.batch_name} - {b.year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Faculty *</Label>
                      <Select value={formData.faculty_email} onValueChange={(value) => {
                        setFormData({...formData, faculty_email: value, subject: ""});
                        loadFacultySubjects(value, formData.batch_id);
                      }}>
                        <SelectTrigger><SelectValue placeholder="Select faculty"/></SelectTrigger>
                        <SelectContent>
                          {faculties.map(f => (
                            <SelectItem key={f.id} value={f.email}>{f.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Day *</Label>
                      <Select value={formData.day_of_week} onValueChange={(value) => setFormData({...formData, day_of_week: value})}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                          {daysOfWeek.map(day => <SelectItem key={day} value={day}>{day}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Time Slot *</Label>
                      <Select value={formData.time_slot} onValueChange={(value) => setFormData({...formData, time_slot: value})}>
                        <SelectTrigger><SelectValue placeholder="Select time"/></SelectTrigger>
                        <SelectContent>
                          {timeSlots.map(slot => <SelectItem key={slot} value={slot}>{slot}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="flex items-center justify-between">
                        <span>Subject *</span>
                        {suggestedSubjects.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setAllowManualSubject(!allowManualSubject)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            {allowManualSubject ? '🔒 Use Mapped Only' : '✏️ Manual Entry'}
                          </button>
                        )}
                      </Label>
                      {suggestedSubjects.length > 0 && !allowManualSubject ? (
                        <Select value={formData.subject} onValueChange={(value) => setFormData({...formData, subject: value})}>
                          <SelectTrigger className="mt-1 border-green-300 bg-green-50">
                            <SelectValue placeholder="Auto-suggested subjects"/>
                          </SelectTrigger>
                          <SelectContent>
                            {suggestedSubjects.map(m => (
                              <SelectItem key={m.id} value={m.subject_name}>
                                {m.subject_name} {m.subject_code && `(${m.subject_code})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input 
                          value={formData.subject} 
                          onChange={(e) => setFormData({...formData, subject: e.target.value})} 
                          required 
                          placeholder={suggestedSubjects.length > 0 ? "Manual entry mode" : "Enter subject name"}
                          className={suggestedSubjects.length > 0 && allowManualSubject ? 'border-yellow-300 bg-yellow-50' : ''}
                        />
                      )}
                      {suggestedSubjects.length > 0 && (
                        <p className="text-xs text-green-700 mt-1">
                          ✅ {suggestedSubjects.length} subject(s) mapped to this faculty for selected batch
                        </p>
                      )}
                    </div>
                    <div>
                      <Label>Class Type *</Label>
                      <Select value={formData.class_type} onValueChange={(value) => setFormData({...formData, class_type: value})}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                          {classTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Room Number</Label>
                      <Input value={formData.room_number} onChange={(e) => setFormData({...formData, room_number: e.target.value})} placeholder="e.g., Room 301" />
                    </div>
                    <div>
                      <Label>Semester</Label>
                      <Input value={formData.semester} onChange={(e) => setFormData({...formData, semester: e.target.value})} placeholder="e.g., Sem 1" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                      {editingEntry ? "Update" : "Add"} Entry
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            )}
          </div>
        </div>

        {message && (
          <Alert className={message.type === "error" ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}>
            <AlertDescription className={message.type === "error" ? "text-red-800" : "text-green-800"}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="bg-gray-50 border-b">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filters
              </CardTitle>
              <div className="flex gap-3 w-full md:w-auto">
                <Select value={filterBatch} onValueChange={setFilterBatch}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="All Batches"/>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>All Batches</SelectItem>
                    {batches.map(b => (
                      <SelectItem key={b.id} value={b.batch_id}>{b.batch_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterDay} onValueChange={setFilterDay}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="All Days"/>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>All Days</SelectItem>
                    {daysOfWeek.map(day => <SelectItem key={day} value={day}>{day}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading ? (
              <p>Loading timetable...</p>
            ) : getFilteredEntries().length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>No timetable entries found</p>
              </div>
            ) : (
              <div className="overflow-x-auto border-2 border-blue-300 rounded-xl shadow-lg -mx-4 sm:mx-0">
                <table className="w-full border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                      <th className="border-2 border-white px-4 py-3 text-left font-bold sticky left-0 bg-blue-600 z-10 min-w-[140px]">Time / Day</th>
                      {daysOfWeek.filter(day => !filterDay || filterDay === day).map(day => (
                        <th key={day} className="border-2 border-white px-3 py-3 text-center font-bold min-w-[160px]">
                          {day.substring(0, 3)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {/* Get unique time slots */}
                    {Array.from(new Set(getFilteredEntries().map(e => e.time_slot))).sort().map(timeSlot => {
                      const displayDays = daysOfWeek.filter(day => !filterDay || filterDay === day);
                      
                      return (
                        <tr key={timeSlot} className="hover:bg-blue-50 transition-colors">
                          <td className="border-2 border-gray-300 px-4 py-4 font-semibold text-sm bg-gradient-to-r from-blue-100 to-indigo-100 sticky left-0 z-10">
                            {timeSlot}
                          </td>
                          {displayDays.map(day => {
                            const entry = groupedEntries[day]?.find(e => e.time_slot === timeSlot);
                            
                            if (!entry) {
                              return (
                                <td key={day} className="border-2 border-gray-300 px-3 py-4 text-center text-gray-400">
                                  —
                                </td>
                              );
                            }
                            
                            return (
                              <td key={day} className="border-2 border-gray-300 px-3 py-3 bg-gradient-to-br from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 transition-all relative group">
                                <div className="text-center space-y-1">
                                  <div className="font-bold text-purple-900 text-sm">{entry.subject}</div>
                                  <div className="text-xs text-indigo-700 font-semibold">{entry.faculty_name}</div>
                                  <div className="text-xs text-gray-600">{entry.room_number}</div>
                                  <Badge className="mt-1 text-xs bg-blue-500 text-white">{entry.class_type}</Badge>
                                  
                                  {/* Edit/Delete buttons on hover - admin only */}
                                  {isAdmin && (
                                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-6 w-6 p-0 bg-white/80 hover:bg-white"
                                      onClick={() => handleEdit(entry)}
                                    >
                                      <Edit className="w-3 h-3" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-6 w-6 p-0 bg-white/80 hover:bg-white text-red-600"
                                      onClick={() => handleDelete(entry.id)}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}