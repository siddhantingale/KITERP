import React, { useState, useEffect } from "react";
import { TimeTable, Batch, Faculty, FacultySubjectMapping } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Plus, Edit, Trash2, Clock, BookOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const classTypes = ["Theory", "Practical"];

export default function ManageTimeTable() {
  const [timetable, setTimetable] = useState([]);
  const [batches, setBatches] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [subjectMappings, setSubjectMappings] = useState([]);
  const [formData, setFormData] = useState({
    batch_id: "",
    batch_name: "",
    day_of_week: "Monday",
    start_time: "",
    end_time: "",
    subject_name: "",
    faculty_email: "",
    faculty_name: "",
    room_number: "",
    class_type: "Theory",
    semester: "",
    academic_year: "2025-26"
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedBatch) {
      loadTimetableForBatch(selectedBatch);
    }
  }, [selectedBatch]);

  const loadData = async () => {
    const [batchData, facultyData, mappings] = await Promise.all([
      Batch.list(),
      Faculty.list(),
      FacultySubjectMapping.list()
    ]);
    setBatches(batchData);
    setFaculties(facultyData);
    setSubjectMappings(mappings);
  };

  const loadTimetableForBatch = async (batchId) => {
    const data = await TimeTable.filter({ batch_id: batchId });
    setTimetable(data.sort((a, b) => {
      const dayOrder = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
      if (dayOrder[a.day_of_week] !== dayOrder[b.day_of_week]) {
        return dayOrder[a.day_of_week] - dayOrder[b.day_of_week];
      }
      return a.start_time.localeCompare(b.start_time);
    }));
  };

  const handleFacultyChange = (email) => {
    const faculty = faculties.find(f => f.email === email);
    if (faculty) {
      setFormData({...formData, faculty_email: email, faculty_name: faculty.name});
    }
  };

  const handleBatchChange = (batchId) => {
    const batch = batches.find(b => b.id === batchId);
    if (batch) {
      // Get available subjects for this batch
      const batchSubjects = subjectMappings.filter(m => 
        m.year === batch.year && m.division === batch.division && m.is_active
      );
      setAvailableSubjects(batchSubjects);
      setFormData({...formData, batch_id: batchId, batch_name: batch.batch_name, subject_name: "", faculty_email: "", faculty_name: ""});
    }
  };

  const handleSubjectChange = (subjectName) => {
    // Find the mapping for this subject
    const mapping = availableSubjects.find(m => m.subject_name === subjectName);
    if (mapping) {
      setFormData({
        ...formData, 
        subject_name: subjectName,
        faculty_email: mapping.faculty_email,
        faculty_name: mapping.faculty_name,
        class_type: mapping.subject_type || "Theory"
      });
    } else {
      // Manual entry
      setFormData({...formData, subject_name: subjectName});
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check for slot conflicts
    const conflictingEntry = timetable.find(entry => 
      entry.id !== editingEntry?.id &&
      entry.batch_id === formData.batch_id &&
      entry.day_of_week === formData.day_of_week &&
      entry.start_time === formData.start_time &&
      entry.end_time === formData.end_time
    );
    
    if (conflictingEntry) {
      alert(`This time slot is already occupied by ${conflictingEntry.subject_name}. Please choose a different time.`);
      return;
    }
    
    if (editingEntry) {
      await TimeTable.update(editingEntry.id, formData);
    } else {
      await TimeTable.create(formData);
    }
    setIsDialogOpen(false);
    resetForm();
    if (selectedBatch) loadTimetableForBatch(selectedBatch);
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    const batch = batches.find(b => b.id === entry.batch_id);
    if (batch) {
      const batchSubjects = subjectMappings.filter(m => 
        m.year === batch.year && m.division === batch.division && m.is_active
      );
      setAvailableSubjects(batchSubjects);
    }
    setFormData(entry);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this entry?")) {
      await TimeTable.delete(id);
      if (selectedBatch) loadTimetableForBatch(selectedBatch);
    }
  };

  const resetForm = () => {
    setEditingEntry(null);
    setFormData({
      batch_id: "",
      batch_name: "",
      day_of_week: "Monday",
      start_time: "",
      end_time: "",
      subject_name: "",
      faculty_email: "",
      faculty_name: "",
      room_number: "",
      class_type: "Theory",
      semester: "",
      academic_year: "2025-26"
    });
  };

  const groupedTimetable = timetable.reduce((acc, entry) => {
    if (!acc[entry.day_of_week]) acc[entry.day_of_week] = [];
    acc[entry.day_of_week].push(entry);
    return acc;
  }, {});

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Calendar className="w-8 h-8 text-blue-600" />
              Time Table Management
            </h1>
            <p className="text-gray-600 mt-1">Manage class schedules and timetables</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Class
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingEntry ? "Edit Class" : "Add New Class"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className={editingEntry ? "grid gap-4" : "grid grid-cols-2 gap-4"}>
                  <div>
                    <Label>Batch *</Label>
                    <Select value={formData.batch_id} onValueChange={handleBatchChange} required>
                      <SelectTrigger><SelectValue placeholder="Select batch"/></SelectTrigger>
                      <SelectContent>
                        {batches.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.batch_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {!editingEntry && (
                    <div>
                      <Label>Day of Week *</Label>
                      <Select value={formData.day_of_week} onValueChange={(v) => setFormData({...formData, day_of_week: v})} required>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                          {daysOfWeek.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Start Time *</Label>
                    <Input type="time" value={formData.start_time} onChange={(e) => setFormData({...formData, start_time: e.target.value})} required />
                  </div>
                  <div>
                    <Label>End Time *</Label>
                    <Input type="time" value={formData.end_time} onChange={(e) => setFormData({...formData, end_time: e.target.value})} required />
                  </div>
                </div>
                <div>
                  <Label>Subject *</Label>
                  {availableSubjects.length > 0 ? (
                    <Select value={formData.subject_name} onValueChange={handleSubjectChange} required>
                      <SelectTrigger><SelectValue placeholder="Select subject"/></SelectTrigger>
                      <SelectContent>
                        <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">Available Subjects</div>
                        {availableSubjects.map(m => (
                          <SelectItem key={m.id} value={m.subject_name}>
                            {m.subject_name} - {m.faculty_name} ({m.subject_type})
                          </SelectItem>
                        ))}
                        <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 border-t mt-1">Other</div>
                        <SelectItem value="__custom__">Enter Other Subject...</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input 
                      value={formData.subject_name} 
                      onChange={(e) => setFormData({...formData, subject_name: e.target.value})} 
                      placeholder="Enter subject name"
                      required 
                    />
                  )}
                  {formData.subject_name === "__custom__" && (
                    <Input 
                      value={formData.subject_name !== "__custom__" ? formData.subject_name : ""} 
                      onChange={(e) => setFormData({...formData, subject_name: e.target.value})} 
                      placeholder="Enter custom subject name"
                      className="mt-2"
                      required 
                    />
                  )}
                </div>
                <div>
                  <Label>Faculty *</Label>
                  <Select value={formData.faculty_email} onValueChange={handleFacultyChange} required>
                    <SelectTrigger><SelectValue placeholder="Select faculty"/></SelectTrigger>
                    <SelectContent>
                      {faculties.filter(f => f.status === 'active').map(f => (
                        <SelectItem key={f.id} value={f.email}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Class Type *</Label>
                  <Select value={formData.class_type} onValueChange={(v) => setFormData({...formData, class_type: v})} required>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      {classTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Semester</Label>
                    <Input value={formData.semester} onChange={(e) => setFormData({...formData, semester: e.target.value})} />
                  </div>
                  <div>
                    <Label>Academic Year</Label>
                    <Input value={formData.academic_year} onChange={(e) => setFormData({...formData, academic_year: e.target.value})} />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" className="bg-blue-600">{editingEntry ? "Update" : "Add"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader className="bg-gray-50">
            <CardTitle>Filter by Batch</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Select value={selectedBatch} onValueChange={setSelectedBatch}>
              <SelectTrigger><SelectValue placeholder="Select a batch to view timetable"/></SelectTrigger>
              <SelectContent>
                {batches.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.batch_name} - {b.college_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedBatch && (
          <div className="space-y-4">
            {daysOfWeek.map(day => (
              groupedTimetable[day] && groupedTimetable[day].length > 0 && (
                <Card key={day}>
                  <CardHeader className="bg-blue-50">
                    <CardTitle className="text-lg text-blue-900">{day}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      {groupedTimetable[day].map(entry => (
                        <div key={entry.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                          <div className="flex-1 grid grid-cols-5 gap-4">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-gray-400" />
                              <span className="font-semibold">{entry.start_time} - {entry.end_time}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <BookOpen className="w-4 h-4 text-gray-400" />
                              <span>{entry.subject_name}</span>
                            </div>
                            <div><span className="text-gray-600">{entry.faculty_name}</span></div>
                            <div><Badge variant="outline">{entry.room_number || "TBA"}</Badge></div>
                            <div><Badge className="bg-green-100 text-green-800">{entry.class_type}</Badge></div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(entry)}><Edit className="w-4 h-4" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDelete(entry.id)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            ))}
          </div>
        )}

        {selectedBatch && timetable.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No classes scheduled for this batch yet.</p>
              <p className="text-sm text-gray-400 mt-2">Click "Add Class" to create a schedule.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}