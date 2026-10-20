import React, { useState, useEffect, useCallback } from "react";
import { Excalidraw, exportToBlob } from "@excalidraw/excalidraw";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Save, Eye, Download, ArrowLeft, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function ExcalidrawTeacher() {
  const navigate = useNavigate();
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [user, setUser] = useState(null);
  const [batches, setBatches] = useState([]);
  const [saving, setSaving] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [lastSaved, setLastSaved] = useState(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  
  const [noteMetadata, setNoteMetadata] = useState({
    title: "",
    subject: "",
    topic: "",
    batch_id: "",
    class_date: new Date().toISOString().split('T')[0],
    duration_minutes: 60
  });

  useEffect(() => {
    const fetchUserAndBatches = async () => {
      try {
        const currentUser = await api.auth.me();
        setUser(currentUser);

        const allBatches = await api.entities.Batch.list();
        setBatches(allBatches);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchUserAndBatches();
  }, []);

  // Auto-save every 2 minutes
  useEffect(() => {
    if (!autoSaveEnabled || !excalidrawAPI) return;

    const interval = setInterval(() => {
      handleAutoSave();
    }, 120000); // 2 minutes

    return () => clearInterval(interval);
  }, [autoSaveEnabled, excalidrawAPI, noteMetadata]);

  const handleAutoSave = async () => {
    if (!noteMetadata.title || !noteMetadata.batch_id) return;
    await handleSave(true);
  };

  const handleSave = async (isAutoSave = false) => {
    if (!excalidrawAPI || !user) return;

    const { title, subject, topic, batch_id, class_date, duration_minutes } = noteMetadata;
    
    if (!title || !subject || !batch_id) {
      if (!isAutoSave) {
        alert("Please fill in Title, Subject, and Batch");
      }
      return;
    }

    setSaving(true);
    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      
      const excalidrawData = {
        type: "excalidraw",
        version: 2,
        source: "https://edutrack.app",
        elements: elements,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          gridSize: appState.gridSize
        }
      };

      // Generate thumbnail
      const blob = await exportToBlob({
        elements: elements,
        appState: appState,
        files: excalidrawAPI.getFiles(),
        mimeType: "image/png",
        quality: 0.8
      });

      const formData = new FormData();
      formData.append('file', blob, 'thumbnail.png');
      
      const { file_url } = await api.integrations.Core.UploadFile({ file: blob });

      await api.entities.ExcalidrawNote.create({
        title,
        subject,
        topic,
        batch_id,
        college_name: batches.find(b => b.batch_id === batch_id)?.college_name || "",
        year: batches.find(b => b.batch_id === batch_id)?.year || "",
        branch: batches.find(b => b.batch_id === batch_id)?.branch || "",
        excalidraw_data: JSON.stringify(excalidrawData),
        thumbnail_url: file_url,
        faculty_email: user.email,
        faculty_name: user.full_name,
        class_date,
        duration_minutes
      });

      setLastSaved(new Date());
      if (!isAutoSave) {
        alert("✅ Daily Teaching Note saved successfully!");
      }
    } catch (error) {
      console.error("Error saving note:", error);
      if (!isAutoSave) {
        alert("Error saving note: " + error.message);
      }
    }
    setSaving(false);
  };

  const handleExport = async (format) => {
    if (!excalidrawAPI) return;

    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();

      if (format === 'json') {
        const data = {
          type: "excalidraw",
          version: 2,
          source: "https://edutrack.app",
          elements: elements,
          appState: appState
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${noteMetadata.title || 'note'}.excalidraw`;
        a.click();
      } else if (format === 'png') {
        const blob = await exportToBlob({
          elements,
          appState,
          files,
          mimeType: "image/png"
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${noteMetadata.title || 'note'}.png`;
        a.click();
      }
    } catch (error) {
      console.error("Export error:", error);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl("Dashboard"))}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">📝 Daily Teaching Notes - Excalidraw</h1>
            <p className="text-xs text-gray-600">Draw diagrams, formulas, and explanations</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {lastSaved && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4" />
              <span>Saved: {lastSaved.toLocaleTimeString()}</span>
            </div>
          )}
          
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoSaveEnabled}
              onChange={(e) => setAutoSaveEnabled(e.target.checked)}
              className="rounded"
            />
            Auto-save (2 min)
          </label>

          <Button
            onClick={() => setShowSaveDialog(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Note
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate(createPageUrl("ExcalidrawNotesList"))}
          >
            <Eye className="w-4 h-4 mr-2" />
            View Saved
          </Button>
        </div>
      </div>

      {/* Excalidraw Canvas */}
      <div className="flex-1 relative">
        <Excalidraw
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          theme="light"
          UIOptions={{
            canvasActions: {
              changeViewBackgroundColor: true,
              clearCanvas: true,
              export: { saveFileToDisk: true },
              loadScene: true,
              saveToActiveFile: true,
              saveAsImage: true
            }
          }}
        />
      </div>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Save Daily Teaching Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Title *</label>
                <Input
                  value={noteMetadata.title}
                  onChange={(e) => setNoteMetadata({...noteMetadata, title: e.target.value})}
                  placeholder="e.g., Data Structures - Day 1"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Subject *</label>
                <Input
                  value={noteMetadata.subject}
                  onChange={(e) => setNoteMetadata({...noteMetadata, subject: e.target.value})}
                  placeholder="e.g., Computer Science"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Topic</label>
              <Input
                value={noteMetadata.topic}
                onChange={(e) => setNoteMetadata({...noteMetadata, topic: e.target.value})}
                placeholder="e.g., Binary Trees and Traversal"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Batch *</label>
              <select
                value={noteMetadata.batch_id}
                onChange={(e) => setNoteMetadata({...noteMetadata, batch_id: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Select Batch</option>
                {batches.map(batch => (
                  <option key={batch.id} value={batch.batch_id}>
                    {batch.batch_name} - {batch.college_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Class Date</label>
                <Input
                  type="date"
                  value={noteMetadata.class_date}
                  onChange={(e) => setNoteMetadata({...noteMetadata, class_date: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Duration (minutes)</label>
                <Input
                  type="number"
                  value={noteMetadata.duration_minutes}
                  onChange={(e) => setNoteMetadata({...noteMetadata, duration_minutes: parseInt(e.target.value)})}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={async () => {
                  await handleSave(false);
                  setShowSaveDialog(false);
                }}
                disabled={saving}
                className="bg-blue-600"
              >
                {saving ? 'Saving...' : 'Save Note'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}