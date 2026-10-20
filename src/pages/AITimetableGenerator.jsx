import React, { useState, useEffect } from "react";
import { TimeTable, Batch, Faculty } from "@/entities/all";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Calendar, Wand2, CheckCircle, AlertCircle, ShoppingCart, Download, Trash2, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { jsPDF } from "jspdf";

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function AITimetableGenerator() {
  const [cart, setCart] = useState([]);
  const [currentConfig, setCurrentConfig] = useState(null);
  const [batches, setBatches] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [generatedTimetable, setGeneratedTimetable] = useState(null);
  const [finalTimetable, setFinalTimetable] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState(null);
  const [timetableStructure, setTimetableStructure] = useState({
    working_days: "5",
    start_time: "09:00",
    end_time: "17:00",
    lecture_duration: "60",
    breaks: [
      { name: "Recess", start_time: "11:00", duration: "15" },
      { name: "Lunch", start_time: "13:00", duration: "60" }
    ]
  });
  const [subjectData, setSubjectData] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [batchData, facultyData] = await Promise.all([
        Batch.list(),
        Faculty.filter({ status: 'active' })
      ]);
      setBatches(batchData);
      setFaculties(facultyData);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const loadSubjectsForBatch = async (batchId) => {
    setLoadingSubjects(true);
    try {
      const batch = batches.find(b => b.id === batchId);
      if (!batch) return;

      const mappings = await api.entities.FacultySubjectMapping.filter({
        year: batch.year,
        division: batch.division,
        is_active: true
      });

      const subjects = mappings.map(m => ({
        name: m.subject_name,
        lectures_per_week: m.weekly_lecture_count || 3,
        type: m.subject_type || "Theory",
        faculty_name: m.faculty_name,
        subject_code: m.subject_code || ""
      }));

      setSubjectData(subjects);
      setMessage({ 
        type: "success", 
        text: `Loaded ${subjects.length} subjects from faculty allocation for ${batch.batch_name}` 
      });
    } catch (error) {
      console.error("Error loading subjects:", error);
      setSubjectData([]);
    }
    setLoadingSubjects(false);
  };

  const addSubject = () => {
    setSubjectData([...subjectData, { name: "", subject_code: "", lectures_per_week: "", type: "Theory", faculty_name: "" }]);
  };

  const updateSubject = (index, field, value) => {
    const updated = [...subjectData];
    updated[index][field] = value;
    setSubjectData(updated);
  };

  const removeSubject = (index) => {
    setSubjectData(subjectData.filter((_, i) => i !== index));
  };

  const addBreak = () => {
    setTimetableStructure({
      ...timetableStructure,
      breaks: [...timetableStructure.breaks, { name: "", start_time: "", duration: "" }]
    });
  };

  const updateBreak = (index, field, value) => {
    const updated = [...timetableStructure.breaks];
    updated[index][field] = value;
    setTimetableStructure({ ...timetableStructure, breaks: updated });
  };

  const removeBreak = (index) => {
    setTimetableStructure({
      ...timetableStructure,
      breaks: timetableStructure.breaks.filter((_, i) => i !== index)
    });
  };

  const addToCart = () => {
    if (!selectedBatch || subjectData.length === 0) {
      setMessage({ type: "error", text: "Please select batch and add subjects" });
      return;
    }

    const batch = batches.find(b => b.id === selectedBatch);
    const cartItem = {
      id: Date.now(),
      batch: batch,
      subjects: [...subjectData],
      structure: { ...timetableStructure }
    };

    setCart([...cart, cartItem]);
    setSubjectData([]);
    setSelectedBatch("");
    setMessage({ type: "success", text: `${batch.batch_name} queued successfully!` });
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const generateTimeSlots = (structure) => {
    const slots = [];
    const [startHour, startMin] = structure.start_time.split(':').map(Number);
    const [endHour, endMin] = structure.end_time.split(':').map(Number);
    
    let currentHour = startHour;
    let currentMin = startMin;
    const lectureDuration = parseInt(structure.lecture_duration);
    
    while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
      const slotStart = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
      
      // Check if this is a break time
      let isBreak = false;
      let breakName = '';
      let breakDuration = 0;
      
      for (const brk of structure.breaks) {
        const [brkHour, brkMin] = brk.start_time.split(':').map(Number);
        if (currentHour === brkHour && currentMin === brkMin) {
          isBreak = true;
          breakName = brk.name;
          breakDuration = parseInt(brk.duration);
          break;
        }
      }
      
      if (isBreak) {
        const endMin = currentMin + breakDuration;
        const slotEnd = `${String(currentHour + Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
        slots.push({ 
          time: `${slotStart}-${slotEnd}`, 
          type: 'break', 
          name: breakName 
        });
        currentMin += breakDuration;
      } else {
        const endMin = currentMin + lectureDuration;
        const slotEnd = `${String(currentHour + Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
        slots.push({ 
          time: `${slotStart}-${slotEnd}`, 
          type: 'lecture' 
        });
        currentMin += lectureDuration;
      }
      
      if (currentMin >= 60) {
        currentHour += Math.floor(currentMin / 60);
        currentMin = currentMin % 60;
      }
    }
    
    return slots;
  };

  const generateFinalTimetable = async () => {
    if (cart.length === 0) {
      setMessage({ type: "error", text: "Queue is empty. Add batches first." });
      return;
    }

    setIsGenerating(true);
    setMessage({ type: "info", text: "Generating timetable... This may take a moment." });

    try {
      const allBatchTimetables = [];

      for (const item of cart) {
        const timeSlots = generateTimeSlots(item.structure);
        const lectureSlots = timeSlots.filter(s => s.type === 'lecture');
        const workingDays = item.structure.working_days === "5" ? 
          ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] :
          ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

        // Create all available day-slot combinations
        const availableSlots = [];
        workingDays.forEach(day => {
          lectureSlots.forEach(slot => {
            availableSlots.push({ day, slot: slot.time });
          });
        });

        // Shuffle available slots for random distribution
        const shuffleArray = (array) => {
          const shuffled = [...array];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          return shuffled;
        };

        const shuffledSlots = shuffleArray(availableSlots);
        
        // Create lecture assignments for each subject
        const lectureAssignments = [];
        item.subjects.forEach(subject => {
          const lecturesNeeded = parseInt(subject.lectures_per_week || 0);
          for (let i = 0; i < lecturesNeeded; i++) {
            lectureAssignments.push({
              subject: subject.name,
              faculty_name: subject.faculty_name || 'TBD',
              class_type: subject.type
            });
          }
        });

        // Shuffle lecture assignments to ensure random distribution of subjects
        const shuffledLectures = shuffleArray(lectureAssignments);

        // Assign lectures to random slots
        const entries = [];
        const usedSlots = Math.min(shuffledSlots.length, shuffledLectures.length);
        
        for (let i = 0; i < usedSlots; i++) {
          entries.push({
            day_of_week: shuffledSlots[i].day,
            time_slot: shuffledSlots[i].slot,
            subject: shuffledLectures[i].subject,
            faculty_name: shuffledLectures[i].faculty_name,
            class_type: shuffledLectures[i].class_type,
            batch_id: item.batch.batch_id,
            batch_name: item.batch.batch_name
          });
        }

        allBatchTimetables.push({
          batch: item.batch,
          timeSlots: timeSlots,
          entries: entries,
          workingDays: workingDays
        });
      }

      setFinalTimetable(allBatchTimetables);
      
      // Automatically save to database
      const allEntries = allBatchTimetables.flatMap(bt => bt.entries);
      await saveToDatabaseAuto(allEntries);
      
      setMessage({ type: "success", text: "Timetable generated and saved successfully! View it in Timetable section." });
      setCart([]); // Clear cart after successful generation
    } catch (error) {
      console.error("Error generating timetable:", error);
      setMessage({ type: "error", text: "Failed to generate timetable" });
    }

    setIsGenerating(false);
  };

  const saveToDatabaseAuto = async (entries) => {
    try {
      for (const entry of entries) {
        const batch = batches.find(b => b.batch_id === entry.batch_id);
        const faculty = faculties.find(f => f.name === entry.faculty_name) || faculties[0];

        await TimeTable.create({
          batch_id: entry.batch_id,
          college_name: batch?.college_name || "",
          year: batch?.year || "",
          branch: batch?.branch || "",
          division: batch?.division || "",
          day_of_week: entry.day_of_week,
          time_slot: entry.time_slot,
          subject: entry.subject,
          faculty_name: entry.faculty_name,
          faculty_email: faculty?.email || "",
          room_number: "",
          class_type: entry.class_type,
          academic_year: "2025-26"
        });
      }
    } catch (error) {
      console.error("Error auto-saving to database:", error);
    }
  };

  const downloadPDF = () => {
    if (!finalTimetable || finalTimetable.length === 0) return;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    finalTimetable.forEach((batchData, batchIdx) => {
      if (batchIdx > 0) doc.addPage();

      const { batch, timeSlots, entries, workingDays } = batchData;

      // Modern Header with Gradient Effect
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, 297, 32, 'F');
      
      doc.setFillColor(59, 130, 246);
      doc.rect(0, 0, 297, 28, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text(batch.batch_name, 148, 10, { align: 'center' });
      
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.text(`Academic Timetable | ${batch.year || ''} ${batch.branch || ''}`, 148, 17, { align: 'center' });
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 148, 23, { align: 'center' });

      // Table setup - adjusted for better fit with all slots including breaks
      let y = 36;
      const pageWidth = 297;
      const margin = 8;
      const dayColWidth = 22;
      const availableWidth = pageWidth - (2 * margin) - dayColWidth;
      const slotColWidth = availableWidth / timeSlots.length;
      const rowHeight = 24;
      const startX = margin;

      // Header Row - Time Slots
      doc.setFillColor(99, 102, 241);
      doc.rect(startX, y, dayColWidth, rowHeight, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text('Day', startX + dayColWidth/2, y + 13, { align: 'center' });

      timeSlots.forEach((slot, idx) => {
        const xPos = startX + dayColWidth + idx * slotColWidth;
        
        if (slot.type === 'break') {
          // Break column with amber/yellow color
          doc.setFillColor(251, 191, 36);
          doc.rect(xPos, y, slotColWidth, rowHeight, 'F');
          doc.setTextColor(120, 53, 15);
          doc.setFontSize(6);
          doc.setFont(undefined, 'bold');
          doc.text(slot.name, xPos + slotColWidth/2, y + 9, { align: 'center' });
          doc.setFontSize(5);
          doc.setFont(undefined, 'normal');
          const timeFormatted = slot.time.replace('-', '\n');
          doc.text(slot.time, xPos + slotColWidth/2, y + 16, { align: 'center' });
        } else {
          doc.setFillColor(99, 102, 241);
          doc.rect(xPos, y, slotColWidth, rowHeight, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(5.5);
          doc.text(slot.time, xPos + slotColWidth/2, y + 14, { align: 'center' });
        }
        // Draw border
        doc.setDrawColor(200, 200, 200);
        doc.rect(xPos, y, slotColWidth, rowHeight, 'S');
      });
      
      y += rowHeight;

      // Data Rows
      workingDays.forEach((day, dayIdx) => {
        const dayEntries = entries.filter(e => e.day_of_week === day);
        
        doc.setFillColor(dayIdx % 2 === 0 ? 243 : 249, dayIdx % 2 === 0 ? 244 : 250, dayIdx % 2 === 0 ? 246 : 251);
        doc.rect(startX, y, dayColWidth, rowHeight, 'F');
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text(day.substring(0, 3), startX + dayColWidth/2, y + 13, { align: 'center' });

        timeSlots.forEach((slot, idx) => {
          const xPos = startX + dayColWidth + idx * slotColWidth;
          
          if (slot.type === 'break') {
            // Break cell - amber background
            doc.setFillColor(254, 243, 199);
            doc.rect(xPos, y, slotColWidth, rowHeight, 'F');
            doc.setTextColor(146, 64, 14);
            doc.setFontSize(6);
            doc.text('BREAK', xPos + slotColWidth/2, y + 14, { align: 'center' });
          } else {
            const entry = dayEntries.find(e => e.time_slot === slot.time);
            
            if (entry) {
              doc.setFillColor(224, 231, 255);
              doc.rect(xPos, y, slotColWidth, rowHeight, 'F');
              doc.setTextColor(67, 56, 202);
              doc.setFontSize(5.5);
              doc.setFont(undefined, 'bold');
              const maxChars = Math.floor(slotColWidth / 1.8);
              const subjectText = entry.subject.length > maxChars ? entry.subject.substring(0, maxChars - 2) + '..' : entry.subject;
              doc.text(subjectText, xPos + slotColWidth/2, y + 8, { align: 'center' });
              doc.setFontSize(5);
              doc.setFont(undefined, 'normal');
              const facultyText = entry.faculty_name.length > maxChars ? entry.faculty_name.substring(0, maxChars - 2) + '..' : entry.faculty_name;
              doc.text(facultyText, xPos + slotColWidth/2, y + 14, { align: 'center' });
              doc.setFontSize(4.5);
              doc.text(entry.class_type, xPos + slotColWidth/2, y + 19, { align: 'center' });
            } else {
              doc.setFillColor(dayIdx % 2 === 0 ? 249 : 255, dayIdx % 2 === 0 ? 250 : 255, dayIdx % 2 === 0 ? 251 : 255);
              doc.rect(xPos, y, slotColWidth, rowHeight, 'F');
              doc.setTextColor(180, 180, 180);
              doc.setFontSize(6);
              doc.text('-', xPos + slotColWidth/2, y + 14, { align: 'center' });
            }
          }
          
          doc.setDrawColor(200, 200, 200);
          doc.rect(xPos, y, slotColWidth, rowHeight, 'S');
        });
        
        y += rowHeight;
      });

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text('EDU TRACK Education Management System', 148, 200, { align: 'center' });
    });

    doc.save(`Timetable_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const saveToDatabaseAll = async () => {
    if (!finalTimetable) return;

    try {
      for (const entry of finalTimetable) {
        const batch = batches.find(b => b.batch_id === entry.batch_id);
        const faculty = faculties.find(f => f.name === entry.faculty_name) || faculties[0];

        await TimeTable.create({
          batch_id: entry.batch_id,
          college_name: batch?.college_name || "",
          year: batch?.year || "",
          branch: batch?.branch || "",
          division: batch?.division || "",
          day_of_week: entry.day_of_week,
          time_slot: entry.time_slot,
          subject: entry.subject,
          faculty_name: entry.faculty_name,
          faculty_email: faculty?.email || "",
          room_number: entry.room_number,
          class_type: entry.class_type,
          academic_year: "2025-26"
        });
      }

      setMessage({ type: "success", text: "All timetables saved to database!" });
      setFinalTimetable(null);
      setCart([]);
    } catch (error) {
      console.error("Error saving:", error);
      setMessage({ type: "error", text: "Failed to save timetables" });
    }
  };



  return (
    <div className="p-4 sm:p-6 bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent flex items-center justify-center gap-2 sm:gap-3">
          <Sparkles className="w-8 sm:w-10 h-8 sm:h-10 text-purple-600" />
          AI Timetable Generator
          </h1>
          <p className="text-gray-600 mt-2 text-sm sm:text-base px-4">Configure batches, queue them, and generate a smart class schedule</p>
        </div>

        {message && (
          <Alert className={message.type === "error" ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}>
            {message.type === "error" ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
            <AlertDescription className={message.type === "error" ? "text-red-800" : "text-green-800"}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        {/* Configuration Form */}
        <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
          <div className="md:col-span-2">
            <Card className="backdrop-blur-xl bg-white/90 border-0 shadow-xl">
              <CardHeader className="bg-gradient-to-r from-purple-100 to-blue-100">
                <CardTitle className="text-base sm:text-lg">📚 Configure Batch Timetable</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 sm:pt-6 space-y-4">
                {/* Batch Selection */}
                <div>
                  <Label className="text-base sm:text-lg font-semibold">Select Batch *</Label>
                  <Select value={selectedBatch} onValueChange={(value) => {
                    setSelectedBatch(value);
                    loadSubjectsForBatch(value);
                  }}>
                    <SelectTrigger className="h-10 sm:h-12 text-sm sm:text-base">
                      <SelectValue placeholder="Choose batch (SY, TY, etc.)" />
                    </SelectTrigger>
                    <SelectContent>
                      {batches.map(b => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.batch_name} - {b.year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {loadingSubjects && (
                    <p className="text-xs text-blue-600 mt-2">Loading subjects from faculty allocation...</p>
                  )}
                </div>

                {/* Timetable Structure */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3 text-sm sm:text-base">⏰ Timetable Structure</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Working Days</Label>
                      <Select value={timetableStructure.working_days} onValueChange={(v) => setTimetableStructure({ ...timetableStructure, working_days: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 Days (Mon-Fri)</SelectItem>
                          <SelectItem value="6">6 Days (Mon-Sat)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Lecture Duration (mins)</Label>
                      <Input type="number" value={timetableStructure.lecture_duration} onChange={(e) => setTimetableStructure({ ...timetableStructure, lecture_duration: e.target.value })} />
                    </div>
                    <div>
                      <Label>Start Time</Label>
                      <Input type="time" value={timetableStructure.start_time} onChange={(e) => setTimetableStructure({ ...timetableStructure, start_time: e.target.value })} />
                    </div>
                    <div>
                      <Label>End Time</Label>
                      <Input type="time" value={timetableStructure.end_time} onChange={(e) => setTimetableStructure({ ...timetableStructure, end_time: e.target.value })} />
                    </div>
                  </div>

                  {/* Breaks */}
                  <div className="mt-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                      <Label className="text-sm sm:text-base">Breaks (Recess, Lunch, etc.)</Label>
                      <Button size="sm" variant="outline" onClick={addBreak} className="w-full sm:w-auto">
                        <Plus className="w-3 h-3 mr-1" /> Add Break
                      </Button>
                    </div>
                    {timetableStructure.breaks.map((brk, idx) => (
                      <div key={idx} className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                        <Input placeholder="Name" value={brk.name} onChange={(e) => updateBreak(idx, 'name', e.target.value)} />
                        <Input type="time" value={brk.start_time} onChange={(e) => updateBreak(idx, 'start_time', e.target.value)} />
                        <Input type="number" placeholder="Duration (mins)" value={brk.duration} onChange={(e) => updateBreak(idx, 'duration', e.target.value)} />
                        <Button size="sm" variant="destructive" onClick={() => removeBreak(idx)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Subjects */}
                <div className="border-t pt-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 mb-3">
                    <Label className="text-base sm:text-lg font-semibold">📖 Subjects</Label>
                    <Button size="sm" variant="outline" onClick={addSubject} className="w-full sm:w-auto">
                      <Plus className="w-4 h-4 mr-1" /> Add Subject
                    </Button>
                  </div>
                  {subjectData.length === 0 && !loadingSubjects && selectedBatch && (
                    <Alert className="mb-3 bg-yellow-50 border-yellow-200">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-yellow-800">
                        No subjects found in faculty allocation. Add subjects manually or allocate them in Manage Faculty first.
                      </AlertDescription>
                    </Alert>
                  )}
                  {subjectData.map((subject, index) => (
                    <div key={index} className="border rounded-lg p-3 bg-gray-50 mb-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-2">
                        <Input placeholder="Subject Name" value={subject.name} onChange={(e) => updateSubject(index, 'name', e.target.value)} />
                        <Input placeholder="Subject Code" value={subject.subject_code || ""} onChange={(e) => updateSubject(index, 'subject_code', e.target.value)} />
                        <Input type="number" placeholder="Lectures/Week" value={subject.lectures_per_week} onChange={(e) => updateSubject(index, 'lectures_per_week', e.target.value)} />
                        <Select value={subject.type} onValueChange={(v) => updateSubject(index, 'type', v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Theory">Theory</SelectItem>
                            <SelectItem value="Practical">Practical</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={subject.faculty_name} onValueChange={(v) => updateSubject(index, 'faculty_name', v)}>
                          <SelectTrigger><SelectValue placeholder="Select Faculty" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Guest Faculty">Guest Faculty</SelectItem>
                            <SelectItem value="Department Training">Department Training</SelectItem>
                            {faculties.map(f => (
                              <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button size="sm" variant="destructive" onClick={() => removeSubject(index)}>Remove</Button>
                    </div>
                  ))}
                </div>

                <Button onClick={addToCart} className="w-full h-10 sm:h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg text-sm sm:text-base">
                  <Calendar className="w-4 h-4 mr-2" />
                  Add to Queue
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Cart */}
          <div className="md:sticky md:top-6">
            <Card className="backdrop-blur-xl bg-white/90 border-0 shadow-xl">
              <CardHeader className="bg-gradient-to-r from-blue-100 to-indigo-100">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Calendar className="w-4 sm:w-5 h-4 sm:h-5" />
                  Queued Batches ({cart.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {cart.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No batches queued yet</p>
                    <p className="text-gray-400 text-xs mt-1">Configure and queue batches to start</p>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{item.batch.batch_name}</p>
                          <p className="text-xs text-gray-600">{item.subjects.length} subjects</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => removeFromCart(item.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}

                {cart.length > 0 && (
                  <Button
                    onClick={generateFinalTimetable}
                    disabled={isGenerating}
                    className="w-full h-10 sm:h-12 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-xl text-sm sm:text-lg font-semibold"
                  >
                    {isGenerating ? (
                      <>
                        <Wand2 className="w-5 h-5 mr-2 animate-spin" />
                        Generating AI Timetable...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 mr-2" />
                        Generate Smart Timetable
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Final Timetable Display */}
        {finalTimetable && finalTimetable.length > 0 && (
          <Card className="backdrop-blur-xl bg-white/90 border-0 shadow-2xl">
            <CardHeader className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4">
                <div>
                  <CardTitle className="text-lg sm:text-xl md:text-2xl flex items-center gap-2">
                    <CheckCircle className="w-5 sm:w-6 h-5 sm:h-6" />
                    Generated Timetables
                  </CardTitle>
                  <p className="text-blue-100 text-xs sm:text-sm mt-1">Auto-saved to database • {finalTimetable.length} batch(es) processed</p>
                </div>
                <Button onClick={downloadPDF} className="bg-white text-purple-600 hover:bg-gray-100 shadow-lg w-full md:w-auto">
                  <Download className="w-4 h-4 mr-2" />
                  Download All PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-6 sm:space-y-10">
              {finalTimetable.map((batchData, idx) => {
                const { batch, timeSlots, entries, workingDays } = batchData;
                return (
                  <div key={idx} className="mb-6 sm:mb-10">
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-t-xl">
                      <h3 className="text-lg sm:text-xl md:text-2xl font-bold">{batch.batch_name}</h3>
                      <p className="text-xs sm:text-sm text-indigo-100 mt-1">{batch.year} • {batch.branch}</p>
                    </div>
                    <div className="overflow-x-auto border-2 sm:border-4 border-indigo-300 rounded-b-xl shadow-lg -mx-4 sm:mx-0">
                      <table className="w-full border-collapse min-w-[800px]">
                        <thead>
                          <tr className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                            <th className="border-2 border-white px-2 sm:px-4 py-2 sm:py-3 text-center font-bold sticky left-0 bg-indigo-600 z-10 min-w-[80px] sm:min-w-[100px] text-xs sm:text-sm">Day / Time</th>
                            {timeSlots.map((slot, slotIdx) => (
                              <th key={slotIdx} className={`border-2 border-white px-2 sm:px-3 py-2 sm:py-3 text-center font-semibold text-xs min-w-[100px] sm:min-w-[120px] ${
                                slot.type === 'break' ? 'bg-amber-500' : ''
                              }`}>
                                {slot.type === 'break' ? (
                                  <div>
                                    <div className="font-bold">{slot.name}</div>
                                    <div className="text-xs opacity-90">{slot.time}</div>
                                  </div>
                                ) : (
                                  <div>{slot.time}</div>
                                )}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          {workingDays.map((day, dayIdx) => {
                            const dayEntries = entries.filter(e => e.day_of_week === day);
                            return (
                              <tr key={day} className={`${dayIdx % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-indigo-50 transition-colors`}>
                                <td className="border-2 border-gray-300 px-2 sm:px-4 py-3 sm:py-4 font-bold text-center bg-gradient-to-r from-indigo-100 to-purple-100 sticky left-0 z-10 text-xs sm:text-sm">
                                  <span className="hidden sm:inline">{day}</span>
                                  <span className="sm:hidden">{day.substring(0, 3)}</span>
                                </td>
                                {timeSlots.map((slot, slotIdx) => {
                                  if (slot.type === 'break') {
                                    return (
                                      <td key={slotIdx} className="border-2 border-gray-300 px-3 py-4 text-center bg-amber-50">
                                        <div className="text-amber-700 text-xs font-semibold">—</div>
                                      </td>
                                    );
                                  }
                                  
                                  const entry = dayEntries.find(e => e.time_slot === slot.time);
                                  
                                  if (!entry) {
                                    return (
                                      <td key={slotIdx} className="border-2 border-gray-300 px-3 py-4 text-center text-gray-400">
                                        —
                                      </td>
                                    );
                                  }
                                  
                                  return (
                                    <td key={slotIdx} className="border-2 border-gray-300 px-2 sm:px-3 py-2 sm:py-3 bg-gradient-to-br from-indigo-50 to-purple-50">
                                      <div className="text-center space-y-1">
                                        <div className="font-bold text-indigo-900 text-xs sm:text-sm leading-tight">{entry.subject}</div>
                                        <div className="text-xs text-purple-700 font-medium truncate">{entry.faculty_name}</div>
                                        <Badge className="mt-1 text-xs bg-indigo-500 text-white">{entry.class_type}</Badge>
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
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}