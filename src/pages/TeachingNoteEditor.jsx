import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ExcalidrawEditor from "../components/excalidraw/ExcalidrawEditor";

export default function TeachingNoteEditor() {
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialData, setInitialData] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetchNote();
  }, []);

  const fetchNote = async () => {
    try {
      const urlParams = new URLSearchParams(location.search);
      const noteId = urlParams.get('id');

      if (!noteId) {
        navigate(createPageUrl('TeachingNotes'));
        return;
      }

      const noteData = await api.entities.TeachingNote.get(noteId);
      setNote(noteData);

      // Parse Excalidraw data
      if (noteData.excalidraw_data) {
        try {
          const parsed = JSON.parse(noteData.excalidraw_data);
          setInitialData(parsed);
        } catch (e) {
          console.error("Failed to parse Excalidraw data:", e);
          setInitialData({ elements: [], appState: {} });
        }
      } else {
        setInitialData({ elements: [], appState: {} });
      }
    } catch (error) {
      console.error("Error fetching note:", error);
      navigate(createPageUrl('TeachingNotes'));
    }
    setLoading(false);
  };

  const handleSave = async (sceneData) => {
    if (!note) return;

    try {
      await api.entities.TeachingNote.update(note.id, {
        excalidraw_data: JSON.stringify(sceneData),
        last_modified: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error saving note:", error);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!note) return null;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate(createPageUrl('TeachingNotes'))}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{note.title}</h1>
            <p className="text-sm text-gray-600">
              {note.subject} - {note.topic} • {note.branch}
            </p>
          </div>
        </div>
      </div>

      {/* Excalidraw Editor */}
      <div className="flex-1">
        {initialData && (
          <ExcalidrawEditor
            noteId={note.id}
            initialData={initialData}
            onSave={handleSave}
            readOnly={false}
          />
        )}
      </div>
    </div>
  );
}