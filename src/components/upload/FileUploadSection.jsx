import React, { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, ArrowLeft, FileSpreadsheet, File } from "lucide-react";

export default function FileUploadSection({ batchParameters, onFileUpload, onBack, isProcessing }) {
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      onFileUpload(file);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      const fileType = file.type.toLowerCase();
      const fileName = file.name.toLowerCase();
      
      if (fileType === "text/csv" || fileName.endsWith('.csv') || 
          fileType === "application/pdf" || fileName.endsWith('.pdf') ||
          fileType.includes("text") || fileName.endsWith('.txt')) {
        onFileUpload(file);
      } else {
        alert("Please upload a CSV, PDF, or TXT file containing student data.");
      }
    }
  };

  return (
    <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
      <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-lg">
        <CardTitle className="text-2xl flex items-center gap-3">
          <Upload className="w-7 h-7" />
          Upload Student File
        </CardTitle>
        <div className="text-green-100 mt-2 space-y-1">
          <p><strong>College:</strong> {batchParameters.college_name}</p>
          <p><strong>Year:</strong> {batchParameters.year} | <strong>Branch:</strong> {batchParameters.branch}</p>
        </div>
      </CardHeader>
      
      <CardContent className="p-8">
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-blue-400 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.csv,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="space-y-4">
            <div className="flex justify-center gap-4">
              <FileSpreadsheet className="w-12 h-12 text-green-500" />
              <FileText className="w-12 h-12 text-red-500" />
              <File className="w-12 h-12 text-blue-500" />
            </div>
            
            <div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                {isProcessing ? "Processing file..." : "Drop your file here"}
              </h3>
              <p className="text-slate-600 mb-4">
                Upload a file containing student information
              </p>
              <div className="space-y-2 text-sm text-slate-500 mb-4">
                <p><strong>CSV Format:</strong> Headers: Name, PRN, Roll No (or variations)</p>
                <p><strong>PDF Format:</strong> Student lists, attendance sheets (processed with OCR)</p>
                <p><strong>TXT Format:</strong> Plain text with student names and details</p>
              </div>
              <Button 
                disabled={isProcessing}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                <Upload className="w-4 h-4 mr-2" />
                {isProcessing ? "Processing..." : "Browse Files"}
              </Button>
            </div>
            
            <p className="text-xs text-slate-500">
              Supported formats: CSV (.csv), PDF (.pdf), Text (.txt)
            </p>
          </div>
        </div>

        <div className="flex justify-start pt-6 border-t">
          <Button variant="outline" onClick={onBack} className="px-8">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Parameters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}