import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Eye, Trash2, ArrowLeft, Calendar, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";

export default function ExcalidrawNotesList() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const currentUser = await api.auth.me();
      setUser(currentUser);

      let notesList;
      if (currentUser.role === 'admin') {
        notesList = await api.entities.ExcalidrawNote.list('-created_date');
      } else {
        notesList = await api.entities.ExcalidrawNote.filter({
          faculty_email: currentUser.email
        }, '-created_date');
      }
      
      setNotes(notesList);
    } catch (error) {
      console.error("Error fetching notes:", error);
    }
    setLoading(false);
  };

  const handleDelete = async (noteId) => {
    if (!confirm("Delete this note? This cannot be undone.")) return;
    
    try {
      await api.entities.ExcalidrawNote.delete(noteId);
      await fetchNotes();
    } catch (error) {
      console.error("Error deleting note:", error);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl("Dashboard"))}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">📚 My Teaching Notes</h1>
              <p className="text-gray-600 mt-1">Manage your Excalidraw notes</p>
            </div>
          </div>
          <Button
            onClick={() => navigate(createPageUrl("ExcalidrawTeacher"))}
            className="bg-blue-600 hover:bg-blue-700"
          >
            ➕ Create New Note
          </Button>
        </div>

        {notes.length === 0 ? (
          <Card className="text-center p-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No notes created yet. Start by creating your first teaching note!</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {notes.map(note => (
              <Card key={note.id} className="hover:shadow-xl transition-shadow">
                <CardContent className="p-0">
                  {note.thumbnail_url && (
                    <img 
                      src={note.thumbnail_url} 
                      alt={note.title}
                      className="w-full h-48 object-cover rounded-t-lg bg-gray-100"
                    />
                  )}
                  <div className="p-4">
                    <h3 className="font-bold text-lg text-gray-900 mb-2">{note.title}</h3>
                    <div className="space-y-2 text-sm text-gray-600 mb-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span>{note.subject}</span>
                      </div>
                      {note.topic && (
                        <p className="text-xs text-gray-500 line-clamp-1">Topic: {note.topic}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{format(new Date(note.class_date), 'PPP')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{note.faculty_name}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => navigate(createPageUrl(`ExcalidrawViewer?note_id=${note.id}`))}
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                        size="sm"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <Button
                        onClick={() => handleDelete(note.id)}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}