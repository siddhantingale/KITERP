import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/api/client";
import { Plus, Trash2, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useYearDivisions } from "../utils/useBatches";

export default function FacultyFormModal({ isOpen, onClose, onSave, facultyMember }) {
  const { years, divisions, getDivisionsForYear } = useYearDivisions();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    department: "",
    status: "active",
    rate_per_hour: 0,
  });
  const [teachingMappings, setTeachingMappings] = useState([]);
  const [newMapping, setNewMapping] = useState({
    year: "",
    division: "",
    subject_name: "",
    subject_code: "",
    weekly_lecture_count: 3
  });
  const [availableDivisions, setAvailableDivisions] = useState([]);
  const [showMappingSection, setShowMappingSection] = useState(false);

  useEffect(() => {
    if (facultyMember) {
      setFormData({
        name: facultyMember.name || "",
        email: facultyMember.email || "",
        department: facultyMember.department || "",
        status: facultyMember.status || "active",
        rate_per_hour: facultyMember.rate_per_hour || 0,
      });
      loadTeachingMappings(facultyMember.id);
      setShowMappingSection(true);
    } else {
      setFormData({ 
        name: "", 
        email: "", 
        department: "", 
        status: "active",
        rate_per_hour: 0
      });
      setTeachingMappings([]);
      setShowMappingSection(false);
    }
  }, [facultyMember]);

  const loadTeachingMappings = async (facultyId) => {
    try {
      const mappings = await api.entities.FacultySubjectMapping.filter({ 
        faculty_id: facultyId 
      });
      setTeachingMappings(mappings);
    } catch (error) {
      console.error("Error loading teaching mappings:", error);
    }
  };

  const handleAddMapping = async () => {
    if (!newMapping.year || !newMapping.division || !newMapping.subject_name) {
      toast.error("Please fill Year, Division, and Subject Name");
      return;
    }

    if (!facultyMember) {
      toast.error("Please save faculty details first");
      return;
    }

    try {
      await api.entities.FacultySubjectMapping.create({
        faculty_id: facultyMember.id,
        faculty_email: facultyMember.email,
        faculty_name: facultyMember.name,
        ...newMapping,
        is_active: true
      });

      toast.success("Teaching assignment added");
      loadTeachingMappings(facultyMember.id);
      setNewMapping({
        year: "",
        division: "",
        subject_name: "",
        subject_code: "",
        weekly_lecture_count: 3
      });
    } catch (error) {
      console.error("Error adding mapping:", error);
      toast.error("Failed to add assignment");
    }
  };

  const handleDeleteMapping = async (mappingId) => {
    try {
      await api.entities.FacultySubjectMapping.delete(mappingId);
      toast.success("Teaching assignment removed");
      loadTeachingMappings(facultyMember.id);
    } catch (error) {
      console.error("Error deleting mapping:", error);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{facultyMember ? "Edit Faculty" : "Add New Faculty"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <h3 className="font-semibold text-blue-900 text-sm">👤 Basic Information</h3>
          </div>
          <div>
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Teaching Allocation Section - Only for existing faculty */}
          {showMappingSection && facultyMember && (
            <>
              <div className="border-t pt-4 mt-6">
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-3 mb-4">
                  <h3 className="font-semibold text-purple-900 flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    📚 Teaching Allocation (Subject & Class Assignment)
                  </h3>
                  <p className="text-xs text-purple-700 mt-1">
                    Assign subjects and classes - used for auto-sync in Timetable creation
                  </p>
                </div>

                {/* Add New Allocation */}
                <div className="bg-white border-2 border-dashed border-blue-300 rounded-lg p-4 mb-4">
                  <h4 className="font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Add Subject Assignment
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Year *</Label>
                      <Select 
                        value={newMapping.year} 
                        onValueChange={(value) => {
                          setNewMapping({...newMapping, year: value, division: ""});
                          setAvailableDivisions(getDivisionsForYear(value));
                        }}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {years.length > 0 ? years.map(y => (
                            <SelectItem key={y} value={y}>{y}</SelectItem>
                          )) : (
                            <SelectItem value="no-data" disabled>No years in system</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Division *</Label>
                      <Select value={newMapping.division} onValueChange={(value) => setNewMapping({...newMapping, division: value})}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {(newMapping.year ? availableDivisions : divisions).length > 0 ? 
                            (newMapping.year ? availableDivisions : divisions).map(d => (
                              <SelectItem key={d} value={d}>{d}</SelectItem>
                            )) : (
                            <SelectItem value="no-data" disabled>Select year first</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Subject Name *</Label>
                      <Input
                        placeholder="e.g., Machine Learning"
                        value={newMapping.subject_name}
                        onChange={(e) => setNewMapping({...newMapping, subject_name: e.target.value})}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Subject Code</Label>
                      <Input
                        placeholder="e.g., CS401"
                        value={newMapping.subject_code}
                        onChange={(e) => setNewMapping({...newMapping, subject_code: e.target.value})}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Weekly Lectures</Label>
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        value={newMapping.weekly_lecture_count}
                        onChange={(e) => setNewMapping({...newMapping, weekly_lecture_count: parseInt(e.target.value) || 3})}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button 
                        type="button"
                        onClick={handleAddMapping}
                        size="sm"
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        <Plus className="w-4 h-4 mr-1" /> Add
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Current Allocations */}
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {teachingMappings.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 text-sm">
                      <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p>No subject assignments yet</p>
                    </div>
                  ) : (
                    teachingMappings.map(mapping => (
                      <div 
                        key={mapping.id} 
                        className="flex items-start justify-between p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-gray-900">{mapping.subject_name}</span>
                            {mapping.subject_code && (
                              <Badge variant="outline" className="text-xs font-mono">{mapping.subject_code}</Badge>
                            )}
                            <Badge className={mapping.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200'}>
                              {mapping.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <div className="flex gap-3 text-xs text-gray-600">
                            <span>📅 {mapping.year}</span>
                            <span>📂 {mapping.division}</span>
                            {mapping.weekly_lecture_count && (
                              <span>🕐 {mapping.weekly_lecture_count}/week</span>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteMapping(mapping.id)}
                          className="text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save Faculty Details</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}