import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, Loader2, CheckCircle, Mail } from "lucide-react";
import { api } from "@/api/client";
import { Student } from "@/entities/all";

export default function BulkEmailUploadModal({ isOpen, onClose, onSuccess }) {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState(null);
  const [uploadStats, setUploadStats] = useState(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv') || 
                 file.type === 'application/pdf' || file.name.endsWith('.pdf'))) {
      setSelectedFile(file);
      setMessage(null);
    } else {
      setMessage({ type: "error", text: "Please select a valid CSV or PDF file" });
    }
  };

  const parseCSV = (text) => {
    const lines = text.trim().split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().toUpperCase());
    const prnIdx = headers.findIndex(h => h.includes('PRN'));
    const nameIdx = headers.findIndex(h => h.includes('NAME'));
    const emailIdx = headers.findIndex(h => h.includes('EMAIL') || h.includes('GMAIL'));
    
    if (prnIdx === -1 || emailIdx === -1) {
      throw new Error("CSV must contain PRN and Email columns");
    }

    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length > Math.max(prnIdx, emailIdx)) {
        data.push({
          prn: values[prnIdx],
          name: nameIdx !== -1 ? values[nameIdx] : '',
          email: values[emailIdx]
        });
      }
    }
    
    return data;
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage({ type: "error", text: "Please select a file" });
      return;
    }

    setIsProcessing(true);
    setMessage({ type: "info", text: "Processing file..." });

    try {
      let emailMappings = [];

      // Handle PDF
      if (selectedFile.type === 'application/pdf' || selectedFile.name.endsWith('.pdf')) {
        setMessage({ type: "info", text: "Uploading PDF..." });
        const { file_url } = await api.integrations.Core.UploadFile({ file: selectedFile });
        
        setMessage({ type: "info", text: "Extracting email mappings..." });
        
        const result = await api.integrations.Core.ExtractDataFromUploadedFile({ 
          file_url, 
          json_schema: {
            type: "object",
            properties: {
              students: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    prn: { type: "string" },
                    name: { type: "string" },
                    email: { type: "string" }
                  },
                  required: ["prn", "email"]
                }
              }
            },
            required: ["students"]
          }
        });
        
        if (result.status !== "success" || !result.output?.students) {
          throw new Error("Failed to extract data from PDF");
        }
        
        emailMappings = result.output.students;
      }
      // Handle CSV
      else {
        const reader = new FileReader();
        await new Promise((resolve) => {
          reader.onload = (e) => {
            emailMappings = parseCSV(e.target.result);
            resolve();
          };
          reader.readAsText(selectedFile);
        });
      }

      if (emailMappings.length === 0) {
        throw new Error("No valid email mappings found in file");
      }

      setMessage({ type: "info", text: `Processing ${emailMappings.length} email mappings...` });

      let updated = 0;
      let inserted = 0;
      let failed = 0;

      // UPSERT logic: Update if PRN exists, skip if not
      for (const mapping of emailMappings) {
        try {
          if (!mapping.prn || !mapping.email) continue;
          
          // Validate email format
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mapping.email)) {
            console.warn(`Invalid email format: ${mapping.email}`);
            failed++;
            continue;
          }
          
          // Find student by PRN
          const existingStudents = await Student.filter({ prn: mapping.prn.trim() });
          
          if (existingStudents.length > 0) {
            // UPDATE existing student
            await Student.update(existingStudents[0].id, { email: mapping.email.trim() });
            updated++;
          } else {
            console.warn(`PRN not found: ${mapping.prn}`);
            failed++;
          }
          
        } catch (error) {
          console.error(`Failed to process ${mapping.prn}:`, error);
          failed++;
        }
      }

      setUploadStats({ updated, inserted, failed, total: emailMappings.length });
      setMessage({ 
        type: "success", 
        text: `Successfully updated ${updated} student emails!` 
      });

      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 2000);

    } catch (error) {
      console.error("Upload error:", error);
      setMessage({ type: "error", text: `Error: ${error.message}` });
    }

    setIsProcessing(false);
  };

  const handleClose = () => {
    setSelectedFile(null);
    setMessage(null);
    setUploadStats(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Mail className="w-6 h-6 text-blue-600" />
            Bulk Student Email Upload
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {!uploadStats ? (
            <>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <FileSpreadsheet className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {selectedFile ? selectedFile.name : "Select email mapping file"}
                </h3>
                <p className="text-gray-600 text-sm">
                  CSV or PDF with PRN, Name, and Email columns
                </p>
                <Button className="mt-4">
                  <Upload className="w-4 h-4 mr-2" />
                  Browse Files
                </Button>
              </div>

              {message && (
                <div className={`p-4 rounded-lg ${message.type === 'error' ? 'bg-red-50 text-red-800' : message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-blue-50 text-blue-800'}`}>
                  {message.text}
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">File Format Requirements:</h4>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Must contain columns: <strong>PRN, Name, Email</strong></li>
                  <li>Email must be valid Gmail or institutional address</li>
                  <li>PRN must match existing student records</li>
                  <li>System will UPDATE emails for existing PRNs only</li>
                </ul>
                <div className="mt-3 bg-white rounded p-3 text-xs font-mono">
                  <div className="font-bold mb-1">Example CSV:</div>
                  PRN, Name, Email<br/>
                  AIML2023001, Om Patil, ompatil@gmail.com<br/>
                  AIML2023002, Rahul More, rahulmore@gmail.com
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button onClick={handleUpload} disabled={!selectedFile || isProcessing}>
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload & Update Emails
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-green-900 mb-4">Upload Complete!</h3>
              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-3xl font-bold text-green-600">{uploadStats.updated}</div>
                  <div className="text-sm text-green-800">Emails Updated</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-3xl font-bold text-red-600">{uploadStats.failed}</div>
                  <div className="text-sm text-red-800">Failed/Not Found</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}