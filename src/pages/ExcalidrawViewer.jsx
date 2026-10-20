import React, { useState, useEffect } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Calendar, User, BookOpen } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";

export default function ExcalidrawViewer() {
  const location = useLocation();
  const navigate = useNavigate();
  const [note, setNote] = useState(null);
  const [excalidrawData, setExcalidrawData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNote();
  }, []);

  const fetchNote = async () => {
    const urlParams = new URLSearchParams(location.search);
    const note_id = urlParams.get('note_id');
    
    if (!note_id) {
      alert("Note ID is missing");
      navigate(createPageUrl("ExcalidrawNotesList"));
      return;
    }

    try {
      const noteData = await api.entities.ExcalidrawNote.get(note_id);
      setNote(noteData);
      
      const parsedData = JSON.parse(noteData.excalidraw_data);
      setExcalidrawData(parsedData);
    } catch (error) {
      console.error("Error fetching note:", error);
      alert("Error loading note");
    }
    setLoading(false);
  };

  const handleDownload = (format) => {
    if (format === 'json') {
      const blob = new Blob([note.excalidraw_data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${note.title}.excalidraw`;
      a.click();
    } else if (format === 'png' && note.thumbnail_url) {
      window.open(note.thumbnail_url, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl("ExcalidrawNotesList"))}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{note?.title}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                <div className="flex items-center gap-1">
                  <BookOpen className="w-4 h-4" />
                  <span>{note?.subject}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>{format(new Date(note?.class_date), 'PPP')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  <span>{note?.faculty_name}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleDownload('png')}
            >
              <Download className="w-4 h-4 mr-2" />
              PNG
            </Button>
            <Button
              variant="outline"
              onClick={() => handleDownload('json')}
            >
              <Download className="w-4 h-4 mr-2" />
              JSON
            </Button>
          </div>
        </div>
      </div>

      {/* Excalidraw Viewer (Read-only) */}
      <div className="flex-1">
        {excalidrawData && (
          <Excalidraw
            initialData={{
              elements: excalidrawData.elements,
              appState: excalidrawData.appState,
              scrollToContent: true
            }}
            viewModeEnabled={true}
            theme="light"
          />
        )}
      </div>
    </div>
  );
}