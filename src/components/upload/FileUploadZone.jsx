
import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet } from "lucide-react";

export default function FileUploadZone({ onFileSelect, isProcessing }) {
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type === "text/csv") { // More specific check
      onFileSelect(file);
    } else if (file) {
      alert("Please upload a CSV file."); // Basic validation feedback
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-blue-400 transition-colors cursor-pointer"
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv" // Primarily accept CSV files
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <div className="space-y-4">
        <div className="flex justify-center gap-2">
          {/* Changed icon to be more CSV focused */}
          <FileSpreadsheet className="w-10 h-10 text-slate-400" />
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            {isProcessing ? "Processing CSV..." : "Upload Student CSV File"}
          </h3>
          <p className="text-slate-600 mb-4">
            Drag and drop your CSV file here, or click to browse
          </p>
          <Button 
            disabled={isProcessing}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            <Upload className="w-4 h-4 mr-2" />
            {isProcessing ? "Processing..." : "Choose CSV File"}
          </Button>
        </div>
        
        <p className="text-xs text-slate-500">
          Supported format: CSV (.csv)
        </p>
      </div>
    </div>
  );
}
