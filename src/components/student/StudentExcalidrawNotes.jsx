import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Eye, Calendar, User, Search, Download, BookOpen } from "lucide-react";
import { format } from "date-fns";

export default function StudentExcalidrawNotes({ student }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');

  useEffect(() => {
    fetchNotes();
  }, [student]);

  const fetchNotes = async () => {
    try {
      const notesList = await api.entities.ExcalidrawNote.filter({
        batch_id: student.batch_id
      }, '-class_date');
      setNotes(notesList);
    } catch (error) {
      console.error("Error fetching notes:", error);
    }
    setLoading(false);
  };

  const subjects = ['all', ...new Set(notes.map(n => n.subject))];

  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          note.topic?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSubject = selectedSubject === 'all' || note.subject === selectedSubject;
    return matchesSearch && matchesSubject;
  });

  const handleDownload = (note, format) => {
    if (format === 'png' && note.thumbnail_url) {
      window.open(note.thumbnail_url, '_blank');
    } else if (format === 'json') {
      const blob = new Blob([note.excalidraw_data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${note.title}.excalidraw`;
      a.click();
    }
  };

  const openViewer = (noteId) => {
    window.open(`/ExcalidrawViewer?note_id=${noteId}`, '_blank');
  };

  if (loading) {
    return <div className="h-64 bg-gray-200 rounded animate-pulse"></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">📝 Daily Teaching Notes</h1>
        <p className="text-gray-600 mt-1">Handwritten notes and diagrams from your teachers</p>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
          className="px-4 py-2 border rounded-lg bg-white"
        >
          {subjects.map(sub => (
            <option key={sub} value={sub}>{sub === 'all' ? 'All Subjects' : sub}</option>
          ))}
        </select>
      </div>

      {/* Notes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredNotes.map(note => (
          <Card key={note.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-0">
              {note.thumbnail_url && (
                <div className="relative">
                  <img 
                    src={note.thumbnail_url} 
                    alt={note.title}
                    className="w-full h-48 object-cover rounded-t-lg bg-gray-100 cursor-pointer"
                    onClick={() => openViewer(note.id)}
                  />
                  <div className="absolute top-2 right-2 bg-blue-600 text-white px-2 py-1 rounded-full text-xs font-semibold">
                    Excalidraw
                  </div>
                </div>
              )}
              <div className="p-4">
                <h3 className="font-bold text-lg text-gray-900 mb-2">{note.title}</h3>
                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    <span className="font-semibold">{note.subject}</span>
                  </div>
                  {note.topic && (
                    <p className="text-xs text-gray-500">📌 {note.topic}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{format(new Date(note.class_date), 'PPP')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>{note.faculty_name}</span>
                  </div>
                  {note.duration_minutes && (
                    <p className="text-xs text-gray-500">⏱️ {note.duration_minutes} minutes</p>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Button
                    onClick={() => openViewer(note.id)}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    size="sm"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View
                  </Button>
                  <Button
                    onClick={() => handleDownload(note, 'png')}
                    variant="outline"
                    size="sm"
                    title="Download PNG"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredNotes.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No teaching notes available yet</p>
        </div>
      )}
    </div>
  );
}