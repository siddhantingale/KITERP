import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, BookOpen, Save } from "lucide-react";
import { toast } from "sonner";
import { useYearDivisions } from "../utils/useBatches";

export default function SubjectAllotmentTab({ faculty, onUpdate }) {
  const { years, divisions, getDivisionsForYear } = useYearDivisions();
  const [mappings, setMappings] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [availableDivisions, setAvailableDivisions] = useState([]);
  const [newMapping, setNewMapping] = useState({
    year: "",
    division: "",
    batch_id: "",
    subject_name: "",
    subject_code: "",
    subject_type: "Theory",
    weekly_lecture_count: 3
  });
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    loadData();
  }, [faculty]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [mappingData, batchData] = await Promise.all([
        api.entities.FacultySubjectMapping.filter({ faculty_id: faculty.id }),
        api.entities.Batch.list()
      ]);
      setMappings(mappingData);
      setBatches(batchData);
    } catch (error) {
      console.error("Error loading subject mappings:", error);
    }
    setLoading(false);
  };

  const handleAddMapping = async () => {
    if (!newMapping.year || !newMapping.division || !newMapping.subject_name) {
      toast.error("Please fill required fields: Year, Division, Subject");
      return;
    }

    setIsAdding(true);
    try {
      await api.entities.FacultySubjectMapping.create({
        faculty_id: faculty.id,
        faculty_email: faculty.email,
        faculty_name: faculty.name,
        year: newMapping.year,
        division: newMapping.division,
        batch_id: newMapping.batch_id || null,
        subject_name: newMapping.subject_name,
        subject_code: newMapping.subject_code || null,
        subject_type: newMapping.subject_type || "Theory",
        weekly_lecture_count: newMapping.weekly_lecture_count || 3,
        is_active: true
      });

      toast.success("Subject mapping added successfully!");
      loadData();
      setNewMapping({
        year: "",
        division: "",
        batch_id: "",
        subject_name: "",
        subject_code: "",
        subject_type: "Theory",
        weekly_lecture_count: 3
      });
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error adding mapping:", error);
      toast.error("Failed to add subject mapping");
    }
    setIsAdding(false);
  };

  const handleDeleteMapping = async (mappingId) => {
    if (!confirm("Remove this subject assignment?")) return;
    
    try {
      await api.entities.FacultySubjectMapping.delete(mappingId);
      toast.success("Subject mapping removed");
      loadData();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error deleting mapping:", error);
      toast.error("Failed to remove mapping");
    }
  };

  const handleToggleActive = async (mapping) => {
    try {
      await api.entities.FacultySubjectMapping.update(mapping.id, {
        is_active: !mapping.is_active
      });
      loadData();
      toast.success(mapping.is_active ? "Mapping deactivated" : "Mapping activated");
    } catch (error) {
      console.error("Error toggling mapping:", error);
    }
  };

  if (loading) {
    return <div className="h-64 bg-gray-100 rounded animate-pulse"></div>;
  }

  return (
    <div className="space-y-6">
      {/* Add New Mapping */}
      <Card className="border-2 border-dashed border-blue-300 bg-blue-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Plus className="w-5 h-5" />
            Add Subject Assignment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="font-semibold">Year *</Label>
              <Select value={newMapping.year} onValueChange={(value) => setNewMapping({...newMapping, year: value})}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-semibold">Division *</Label>
              <Select value={newMapping.division} onValueChange={(value) => setNewMapping({...newMapping, division: value})}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select division" />
                </SelectTrigger>
                <SelectContent>
                  {divisions.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="font-semibold">Subject Name *</Label>
              <Input
                placeholder="e.g., Machine Learning"
                value={newMapping.subject_name}
                onChange={(e) => setNewMapping({...newMapping, subject_name: e.target.value})}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="font-semibold">Subject Code</Label>
              <Input
                placeholder="e.g., CS401"
                value={newMapping.subject_code}
                onChange={(e) => setNewMapping({...newMapping, subject_code: e.target.value})}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="font-semibold">Subject Type *</Label>
              <Select value={newMapping.subject_type} onValueChange={(value) => setNewMapping({...newMapping, subject_type: value})}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Theory">Theory</SelectItem>
                  <SelectItem value="Practical">Practical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-semibold">Weekly Lectures</Label>
              <Input
                type="number"
                min="1"
                max="10"
                value={newMapping.weekly_lecture_count}
                onChange={(e) => setNewMapping({...newMapping, weekly_lecture_count: parseInt(e.target.value) || 3})}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="font-semibold">Linked Batch (Optional)</Label>
            <Select value={newMapping.batch_id} onValueChange={(value) => setNewMapping({...newMapping, batch_id: value})}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Link to specific batch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>None</SelectItem>
                {batches.filter(b => 
                  b.year === newMapping.year && 
                  b.division === newMapping.division
                ).map(b => (
                  <SelectItem key={b.id} value={b.batch_id}>{b.batch_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={handleAddMapping} 
            disabled={isAdding}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {isAdding ? (
              <><Save className="w-4 h-4 mr-2 animate-spin" /> Adding...</>
            ) : (
              <><Plus className="w-4 h-4 mr-2" /> Add Subject Assignment</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Current Mappings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-600" />
            Assigned Subjects ({mappings.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mappings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p>No subject assignments yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {mappings.map(mapping => (
                <div 
                  key={mapping.id} 
                  className={`p-4 rounded-lg border-2 transition-all ${
                    mapping.is_active 
                      ? 'border-blue-200 bg-blue-50 hover:shadow-md' 
                      : 'border-gray-200 bg-gray-50 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h4 className="font-bold text-gray-900 text-lg">{mapping.subject_name}</h4>
                        {mapping.subject_code && (
                          <Badge variant="outline" className="font-mono">{mapping.subject_code}</Badge>
                        )}
                        <Badge className={mapping.subject_type === 'Practical' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}>
                          {mapping.subject_type || 'Theory'}
                        </Badge>
                        <Badge className={mapping.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}>
                          {mapping.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-700">
                        <div>
                          <span className="font-semibold">Year:</span> {mapping.year}
                        </div>
                        <div>
                          <span className="font-semibold">Division:</span> {mapping.division}
                        </div>
                        <div>
                          <span className="font-semibold">Lectures/Week:</span> {mapping.weekly_lecture_count || 'N/A'}
                        </div>
                        {mapping.batch_id && (
                          <div className="col-span-2 md:col-span-1">
                            <span className="font-semibold">Batch:</span> {batches.find(b => b.batch_id === mapping.batch_id)?.batch_name || mapping.batch_id}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleActive(mapping)}
                        className={mapping.is_active ? 'border-orange-300 text-orange-600' : 'border-green-300 text-green-600'}
                      >
                        {mapping.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteMapping(mapping.id)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}