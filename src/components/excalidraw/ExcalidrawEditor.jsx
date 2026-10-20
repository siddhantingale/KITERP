import React, { useState, useEffect, useCallback } from "react";
import { Excalidraw, exportToBlob } from "@excalidraw/excalidraw";
import { Button } from "@/components/ui/button";
import { Save, Download } from "lucide-react";
import { api } from "@/api/client";

export default function ExcalidrawEditor({ noteId, initialData, onSave, readOnly = false }) {
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!excalidrawAPI || readOnly) return;

    const interval = setInterval(() => {
      handleAutoSave();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [excalidrawAPI, readOnly]);

  const handleAutoSave = async () => {
    if (!excalidrawAPI || readOnly) return;

    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      
      const sceneData = {
        elements,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          currentItemFontFamily: appState.currentItemFontFamily,
          currentItemFontSize: appState.currentItemFontSize,
          currentItemStrokeColor: appState.currentItemStrokeColor,
          currentItemBackgroundColor: appState.currentItemBackgroundColor,
        },
        scrollToContent: true
      };

      if (onSave) {
        await onSave(sceneData);
        setLastSaved(new Date());
      }
    } catch (error) {
      console.error("Auto-save failed:", error);
    }
  };

  const handleManualSave = async () => {
    setSaving(true);
    await handleAutoSave();
    setSaving(false);
  };

  const handleExportPNG = async () => {
    if (!excalidrawAPI) return;

    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      
      const blob = await exportToBlob({
        elements,
        appState,
        files: excalidrawAPI.getFiles(),
        mimeType: "image/png",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `teaching-note-${Date.now()}.png`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  const handleExportJSON = () => {
    if (!excalidrawAPI) return;

    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      
      const data = JSON.stringify({ elements, appState }, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `teaching-note-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("JSON export failed:", error);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      {!readOnly && (
        <div className="bg-white border-b p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              onClick={handleManualSave} 
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : "Save Now"}
            </Button>
            {lastSaved && (
              <span className="text-sm text-gray-600">
                Last saved: {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportPNG}>
              <Download className="w-4 h-4 mr-2" />
              Export PNG
            </Button>
            <Button variant="outline" onClick={handleExportJSON}>
              <Download className="w-4 h-4 mr-2" />
              Export JSON
            </Button>
          </div>
        </div>
      )}

      {/* Excalidraw Canvas */}
      <div className="flex-1 bg-white">
        <Excalidraw
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          initialData={initialData}
          viewModeEnabled={readOnly}
          zenModeEnabled={false}
          gridModeEnabled={false}
          theme="light"
        />
      </div>
    </div>
  );
}