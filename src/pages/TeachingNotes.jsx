import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, BookOpen, Calendar, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";

export default function TeachingNotes() {
  const [notes, setNotes] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    subject: "",
    topic: "",
    batch_id: "",
    session_date: new Date().toISOString().split('T')[0]
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const currentUser = await api.auth.me();
      setUser(currentUser);

      // Fetch all teaching notes created by this faculty
      const notesList = await api.entities.TeachingNote.filter({
        faculty_email: currentUser.email
      }, '-session_date');

      // Fetch batches
      const batchesList = await api.entities.Batch.list();

      setNotes(notesList);
      setBatches(batchesList);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    try {
      const selectedBatch = batches.find(b => b.batch_id === formData.batch_id);
      
      const newNote = await api.entities.TeachingNote.create({
        ...formData,
        faculty_email: user.email,
        faculty_name: user.full_name,
        college_name: selectedBatch?.college_name || "",
        year: selectedBatch?.year || "",
        branch: selectedBatch?.branch || selectedBatch?.batch_name || "",
        excalidraw_data: JSON.stringify({ elements: [], appState: {} }),
        last_modified: new Date().toISOString()
      });

      navigate(createPageUrl(`TeachingNoteEditor?id=${newNote.id}`));
    } catch (error) {
      console.error("Error creating note:", error);
    }
  };

  const handleDelete = async (noteId) => {
    if (!confirm("Delete this teaching note?")) return;
    
    try {
      await api.entities.TeachingNote.delete(noteId);
      await fetchData();
    } catch (error) {
      console.error("Error deleting note:", error);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">📝 Teaching Notes</h1>
            <p className="text-gray-600 mt-1">Create interactive whiteboard notes using Excalidraw</p>
          </div>
          <Button 
            onClick={() => setShowCreateModal(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New Note
          </Button>
        </div>

        {/* Notes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {notes.map(note => {
            const batch = batches.find(b => b.batch_id === note.batch_id);
            
            return (
              <Card key={note.id} className="border-0 shadow-lg hover:shadow-xl transition-all">
                <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50">
                  <CardTitle className="text-lg">{note.title}</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <BookOpen className="w-4 h-4" />
                      <span>{note.subject} - {note.topic}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="w-4 h-4" />
                      <span>{batch?.batch_name || note.batch_id}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>{format(new Date(note.session_date), 'PPP')}</span>
                    </div>
                    {note.last_modified && (
                      <p className="text-xs text-gray-500">
                        Modified: {format(new Date(note.last_modified), 'PPp')}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={() => navigate(createPageUrl(`TeachingNoteEditor?id=${note.id}`))}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button 
                      onClick={() => handleDelete(note.id)}
                      variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {notes.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No teaching notes yet</p>
            <Button onClick={() => setShowCreateModal(true)}>
              Create Your First Note
            </Button>
          </div>
        )}

        {/* Create Note Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Teaching Note</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="e.g., Data Structures - Trees"
                />
              </div>

              <div>
                <Label>Subject</Label>
                <Input
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  placeholder="e.g., Computer Science"
                />
              </div>

              <div>
                <Label>Topic</Label>
                <Input
                  value={formData.topic}
                  onChange={(e) => setFormData({...formData, topic: e.target.value})}
                  placeholder="e.g., Binary Trees"
                />
              </div>

              <div>
                <Label>Batch</Label>
                <select
                  value={formData.batch_id}
                  onChange={(e) => setFormData({...formData, batch_id: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select Batch</option>
                  {batches.map(batch => (
                    <option key={batch.id} value={batch.batch_id}>
                      {batch.batch_name} - {batch.year}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Session Date</Label>
                <Input
                  type="date"
                  value={formData.session_date}
                  onChange={(e) => setFormData({...formData, session_date: e.target.value})}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreate}
                  disabled={!formData.title || !formData.subject || !formData.batch_id}
                  className="bg-blue-600"
                >
                  Create & Open Editor
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}