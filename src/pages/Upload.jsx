import React, { useState, useEffect } from "react";
import { Student, Batch, User } from "@/entities/all";
import { UploadFile, ExtractDataFromUploadedFile } from "@/integrations/Core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, AlertCircle, CheckCircle, Upload as UploadIcon, Users, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import FileUploadSection from "../components/upload/FileUploadSection";
import StudentDataPreview from "../components/upload/StudentDataPreview";

// LOCKED CONFIGURATION FOR KIT KOLHAPUR - AIML ONLY
const LOCKED_COLLEGE = "KIT's College of Engineering, Kolhapur";
const LOCKED_BRANCH = "Artificial Intelligence & Machine Learning";
const LOCKED_COLLEGE_SHORT = "KIT_KOLHAPUR";

const years = ["FE", "SE", "TE", "BE"];
const divisions = ["A", "B", "C"];

// Custom batches are now fetched from database

export default function UploadPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [batchType, setBatchType] = useState("standard");
  const [privateBatches, setPrivateBatches] = useState([]);
  const [customBatches, setCustomBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [formData, setFormData] = useState({
    year: "",
    division: "",
    custom_batch_id: "",
    private_batch_id: ""
  });
  const [extractedStudents, setExtractedStudents] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const allBatches = await Batch.list('-created_date', 200);
        setPrivateBatches(allBatches.filter(b => b.batch_type === 'private'));
        setCustomBatches(allBatches.filter(b => b.batch_type === 'custom'));
      } catch (err) {
        console.error("Error fetching batches:", err);
      }
    };
    fetchData();
  }, []);

  // Trigger global batch refresh after successful student upload
  const triggerBatchRefresh = () => {
    if (typeof window !== 'undefined' && window.refreshBatches) {
      window.refreshBatches();
    }
  };

  const handleBatchParametersSubmit = () => {
    let batchData = null;
    
    if (batchType === "standard") {
      if (!formData.year || !formData.division) {
        setError("Please select Academic Year and Division");
        return;
      }
      const batchId = `${LOCKED_COLLEGE_SHORT}_${formData.year}_AIML_${formData.division}`.toLowerCase().replace(/[^\w-]+/g, '-');
      
      batchData = {
        batch_type: "standard",
        batch_id: batchId,
        batch_name: `${formData.year} AIML - Div ${formData.division}`,
        batch_description: `${formData.year} - ${LOCKED_BRANCH} - Division ${formData.division}`,
        college_name: LOCKED_COLLEGE,
        year: formData.year,
        branch: LOCKED_BRANCH,
        division: formData.division
      };
    } else if (batchType === "custom") {
      if (!formData.custom_batch_id) {
        setError("Please select a custom batch");
        return;
      }
      const selectedCustomBatch = customBatches.find(b => b.id === formData.custom_batch_id);
      if (!selectedCustomBatch) {
        setError("Selected custom batch not found");
        return;
      }
      
      batchData = selectedCustomBatch;
    } else { // Private batch
      if (!formData.private_batch_id) {
        setError("Please select a private batch");
        return;
      }
      const selectedPrivateBatch = privateBatches.find(b => b.id === formData.private_batch_id);
      if (!selectedPrivateBatch) {
        setError("Selected private batch not found");
        return;
      }
      
      batchData = selectedPrivateBatch;
    }
    
    setSelectedBatch(batchData);
    setStep(2);
  };

  const handleFileUpload = async (file) => {
    setIsProcessing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      let studentsData = [];
      
      const isPrivate = selectedBatch && selectedBatch.batch_type === 'private';
      
      if (file.type === "text/csv" || file.name.toLowerCase().endsWith('.csv')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const csvText = e.target.result;
            studentsData = await parseStudentsFromCSV(csvText, isPrivate);
            
            if (studentsData.length > 0) {
              setExtractedStudents(studentsData);
              setSuccessMessage(`Successfully extracted ${studentsData.length} student records from CSV file.`);
              setStep(3);
            } else {
              setError("No valid student records found in the CSV file. Please check the format.");
            }
          } catch (parseError) {
            setError(`CSV parsing error: ${parseError.message}`);
          }
          setIsProcessing(false);
        };
        reader.readAsText(file);
        return;
      } 
      else if (file.type === "application/pdf" || file.name.toLowerCase().endsWith('.pdf')) {
        const { file_url } = await UploadFile({ file });
        
        const schema = {
          type: "object",
          properties: {
            divisions: {
              type: "array",
              description: "Extract divisions in order (e.g., CSE-TY - A, CSE-TY - B) with their students listed in exact order",
              items: {
                type: "object",
                properties: {
                  division_name: {
                    type: "string",
                    description: "Division name (e.g., 'CSE-TY - A', 'CSE-TY - B')"
                  },
                  students: {
                    type: "array",
                    description: "Students in this division, in exact order from PDF",
                    items: {
                      type: "object",
                      properties: {
                        roll_no: { 
                          type: "string", 
                          description: "Roll number (e.g., TYA01, TYB02)" 
                        },
                        prn: { 
                          type: "string", 
                          description: "PRN number" 
                        },
                        name: { 
                          type: "string", 
                          description: "Full student name" 
                        }
                      },
                      required: ["roll_no", "prn", "name"]
                    }
                  }
                },
                required: ["division_name", "students"]
              }
            }
          },
          required: ["divisions"]
        };

        const result = await ExtractDataFromUploadedFile({
          file_url,
          json_schema: schema
        });

        if (result.status === "success" && result.output?.divisions && result.output.divisions.length > 0) {
          // Flatten all divisions into a single student list, maintaining order
          const processedStudents = [];
          
          for (const division of result.output.divisions) {
            if (division.students && Array.isArray(division.students)) {
              for (const student of division.students) {
                if (student.name && student.name.trim().length > 0) {
                  processedStudents.push({
                    name: student.name.trim().toUpperCase(),
                    prn: isPrivate ? "" : (student.prn ? student.prn.trim() : ""),
                    roll_no: student.roll_no ? student.roll_no.trim() : ""
                  });
                }
              }
            }
          }

          if (processedStudents.length > 0) {
            setExtractedStudents(processedStudents);
            setSuccessMessage(`Successfully extracted ${processedStudents.length} student records from PDF file across ${result.output.divisions.length} division(s).`);
            setStep(3);
          } else {
            throw new Error("No valid student data found in PDF.");
          }
        } else {
          throw new Error("Could not extract student data from PDF.");
        }
      } 
      else if (file.type.includes("text") || file.name.toLowerCase().endsWith('.txt')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const textContent = e.target.result;
            studentsData = parseStudentsFromText(textContent, isPrivate);
            
            if (studentsData.length > 0) {
              setExtractedStudents(studentsData);
              setSuccessMessage(`Successfully extracted ${studentsData.length} student records from text file.`);
              setStep(3);
            } else {
              setError("No valid student records found in the text file.");
            }
          } catch (parseError) {
            setError(`Text parsing error: ${parseError.message}`);
          }
          setIsProcessing(false);
        };
        reader.readAsText(file);
        return;
      } 
      else {
        throw new Error("Unsupported file format. Please upload CSV, PDF, or TXT files containing student data.");
      }
    } catch (error) {
      const errorMessage = error.message || "Unknown error occurred during file processing";
      setError(errorMessage);
    }
    
    setIsProcessing(false);
  };

  const parseStudentsFromCSV = async (csvText, isPrivate) => {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) {
      throw new Error("CSV must have header and data rows");
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    
    const nameIndex = headers.findIndex(h => /name|student|full.*name/i.test(h));
    const prnIndex = headers.findIndex(h => /prn|registration|reg.*no|reg.*num|enroll/i.test(h));
    const rollIndex = headers.findIndex(h => /roll|number|no\.|serial|sr/i.test(h));

    if (nameIndex === -1) {
      throw new Error("CSV must contain a 'Name' column.");
    }
    if (rollIndex === -1) {
      throw new Error("CSV must contain a 'Roll No' column.");
    }
    if (!isPrivate && prnIndex === -1) {
      throw new Error("Standard batches require a 'PRN' column. Please include a 'PRN' column in your CSV for standard batches.");
    }

    const students = [];
    for (let i = 1; i < lines.length; i++) {
      const fields = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || 
                    lines[i].split(/[,;\t]/).map(f => f.trim());
      
      const cleanFields = fields.map(f => f.replace(/^"|"$/g, '').trim());
      
      if (cleanFields.length > nameIndex && cleanFields[nameIndex]) {
        const studentName = cleanFields[nameIndex] || "";
        const studentPRN = isPrivate ? "" : (prnIndex >= 0 ? (cleanFields[prnIndex] || "") : "");
        const studentRoll = rollIndex >= 0 ? (cleanFields[rollIndex] || "") : "";

        if (studentName && studentName.length > 2) {
          students.push({
            name: studentName,
            prn: studentPRN,
            roll_no: studentRoll || i.toString()
          });
        }
      }
    }
    
    if (students.length === 0) {
      throw new Error("No valid student records found in CSV. Please check the data format.");
    }
    
    return students;
  };

  const parseStudentsFromText = (textContent, isPrivate) => {
    const students = [];
    const lines = textContent.split(/\r?\n/);
    
    const patterns = [
      /^(\d+)\s+(\d+)\s+(.+)$/,  // Roll PRN Name
      /^(.+?)\s*[-–]\s*(\d+)$/,  // Name - PRN
      /PRN:\s*(\d+).*?Name:\s*(.+)/i,  // PRN: xxx Name: yyy
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)$/  // Simple name
    ];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (trimmedLine.length < 3) return;
      
      let student = null;
      
      for (const pattern of patterns) {
        const match = trimmedLine.match(pattern);
        if (match) {
          if (pattern === patterns[0]) { // Roll PRN Name
            student = {
              name: match[3].trim(),
              prn: isPrivate ? "" : match[2].trim(),
              roll_no: match[1].trim()
            };
          } else if (pattern === patterns[1]) { // Name - PRN
            student = {
              name: match[1].trim(),
              prn: isPrivate ? "" : match[2].trim(),
              roll_no: (index + 1).toString()
            };
          } else if (pattern === patterns[2]) { // PRN: xxx Name: yyy
            student = {
              name: match[2].trim(),
              prn: isPrivate ? "" : match[1].trim(),
              roll_no: (index + 1).toString()
            };
          } else if (pattern === patterns[3]) { // Simple name
            student = {
              name: match[1].trim(),
              prn: "",
              roll_no: (index + 1).toString()
            };
          }
          break;
        }
      }
      
      if (student && student.name.length > 2) {
        students.push(student);
      }
    });
    
    return students;
  };

  const handleSaveStudents = async (finalStudents) => {
    setIsProcessing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const prnsToCheck = finalStudents.map(s => s.prn).filter(Boolean);
      let existingStudents = [];
      
      if (selectedBatch.batch_type !== 'private' && prnsToCheck.length > 0) {
        existingStudents = await Student.filter({ 
          college_name: selectedBatch.college_name,
          prn: { $in: prnsToCheck }
        }, null, 500);
      }
      
      const duplicateEntries = [];
      const studentsToCreate = [];
      
      finalStudents.forEach(student => {
        let exists = false;
        if (selectedBatch.batch_type !== 'private' && student.prn) {
          exists = existingStudents.find(existing => 
            existing.prn === student.prn && existing.college_name === selectedBatch.college_name
          );
        }
        
        if (exists) {
          duplicateEntries.push(`${student.name} (PRN: ${student.prn})`);
        } else {
          const studentData = {
            name: student.name,
            prn: student.prn || null,
            roll_no: student.roll_no,
            college_name: selectedBatch.college_name || null,
            year: selectedBatch.year || null,
            branch: selectedBatch.branch || null,
            division: selectedBatch.division || null,
            batch_id: selectedBatch.batch_id
          };
          studentsToCreate.push(studentData);
        }
      });
      
      if (duplicateEntries.length > 0) {
        setError(`Duplicate students found: ${duplicateEntries.join(', ')}. These were not added again.`);
      }

      if (studentsToCreate.length === 0) {
        if (duplicateEntries.length > 0) {
          setSuccessMessage("All other students were identified as duplicates and not added.");
        } else {
          setError("No new students to create.");
        }
        setIsProcessing(false);
        return;
      }
      
      // Create or update batch in database
      let batchRecord = selectedBatch;
      
      if (selectedBatch.batch_type === 'private') {
        // Private batch already exists in database, just get it
        batchRecord = await Batch.get(selectedBatch.id);
      } else {
        // For standard/custom batches, check if batch exists or create it
        const existingBatches = await Batch.filter({ batch_id: selectedBatch.batch_id });
        
        if (existingBatches.length > 0) {
          batchRecord = existingBatches[0];
        } else {
          // Create new batch
          batchRecord = await Batch.create({
            batch_type: selectedBatch.batch_type,
            batch_id: selectedBatch.batch_id,
            batch_name: selectedBatch.batch_name,
            college_name: selectedBatch.college_name,
            year: selectedBatch.year,
            branch: selectedBatch.branch,
            division: selectedBatch.division,
            batch_description: selectedBatch.batch_description,
            student_count: 0
          });
        }
      }
      
      // Update the student count
      await Batch.update(batchRecord.id, {
        student_count: (batchRecord.student_count || 0) + studentsToCreate.length
      });
      
      const chunkSize = 50; 
      for (let i = 0; i < studentsToCreate.length; i += chunkSize) {
        const chunk = studentsToCreate.slice(i, i + chunkSize);
        await Student.bulkCreate(chunk);
        
        if (i + chunkSize < studentsToCreate.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      setSuccessMessage(`Successfully added ${studentsToCreate.length} new students to batch '${selectedBatch.batch_name}'.`);
      
      triggerBatchRefresh(); // Sync batches globally
      
      setTimeout(() => {
        navigate(createPageUrl("Batches"));
      }, 2000);
      
    } catch (error) {
      console.error("Error saving students:", error);
      setError(`Error saving students to database: ${error.message}`);
    }
    
    setIsProcessing(false);
  };

  const resetFlow = () => {
    setStep(1);
    setSelectedBatch(null);
    setExtractedStudents([]);
    setError(null);
    setSuccessMessage(null);
    setFormData({
      year: "",
      division: "",
      custom_batch_id: "",
      private_batch_id: ""
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 p-6 md:p-8 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -right-20 w-96 h-96 bg-green-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      </div>
      
      <div className="max-w-5xl mx-auto relative z-10">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="icon"
            onClick={() => step === 1 ? navigate(createPageUrl("Dashboard")) : resetFlow()}
            className="backdrop-blur-md bg-white/70 border-white/50 hover:bg-white/90"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">Upload Student Data</h1>
            <p className="text-gray-700 mt-1">Import student records to a batch</p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6 backdrop-blur-xl bg-red-50/80 border-red-200/50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert className="mb-6 backdrop-blur-xl bg-green-50/80 border-green-200/50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {step === 1 && (
             <Card className="backdrop-blur-xl bg-white/70 border-white/50 shadow-2xl">
                <CardHeader className="bg-gradient-to-r from-green-500/20 to-blue-500/20 border-b border-white/30">
                    <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5"/>Select Batch Type</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert className="bg-blue-50 border-blue-200 mb-4">
                      <Info className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800">
                        <div className="font-semibold mb-2">🔒 Upload Configuration</div>
                        <div className="text-sm space-y-1">
                          <div>📋 <strong>Batch Type:</strong> Standard Batch (Fixed)</div>
                          <div>🏛️ <strong>College:</strong> KIT Kolhapur (Fixed)</div>
                          <div>🔬 <strong>Branch:</strong> AIML Department (Fixed)</div>
                        </div>
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                        <label className="font-semibold text-slate-700">Batch Type</label>
                        <Select value={batchType} onValueChange={setBatchType}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="standard">Standard Batch (KIT AIML)</SelectItem>
                                <SelectItem value="custom">Custom Batch</SelectItem>
                                <SelectItem value="private">Private Batch</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    
                    {batchType === "private" ? (
                      <div className="space-y-4">
                        <div>
                          <label className="font-semibold text-slate-700">Select Private Batch *</label>
                          <Select value={formData.private_batch_id} onValueChange={(value) => setFormData({...formData, private_batch_id: value})}>
                            <SelectTrigger><SelectValue placeholder="Select private batch"/></SelectTrigger>
                            <SelectContent>
                              {privateBatches.map(batch => (
                                <SelectItem key={batch.id} value={batch.id}>{batch.batch_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ) : batchType === "custom" ? (
                      <div className="space-y-4">
                        <div>
                          <label className="font-semibold text-slate-700">Year Filter</label>
                          <Select value={formData.year} onValueChange={(value) => setFormData({...formData, year: value, custom_batch_id: ""})}>
                            <SelectTrigger><SelectValue placeholder="All years"/></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={null}>All Years</SelectItem>
                              <SelectItem value="Second Year">Second Year</SelectItem>
                              <SelectItem value="Third Year">Third Year</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="font-semibold text-slate-700">Select Custom Batch *</label>
                          <Select value={formData.custom_batch_id} onValueChange={(value) => setFormData({...formData, custom_batch_id: value})}>
                            <SelectTrigger><SelectValue placeholder="Select custom batch"/></SelectTrigger>
                            <SelectContent>
                              {customBatches.filter(b => !formData.year || b.year === formData.year).map(batch => (
                                <SelectItem key={batch.id} value={batch.id}>
                                  {batch.batch_name} - {batch.college_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ) : (
                     <div className="space-y-4">
                       {/* Locked Configuration Display */}
                       <Alert className="bg-blue-50 border-blue-200">
                         <Info className="h-4 w-4 text-blue-600" />
                         <AlertDescription className="text-blue-800">
                           <div className="font-semibold mb-1">🔒 Locked Configuration</div>
                           <div className="text-sm">
                             <div>🏛️ College: <strong>{LOCKED_COLLEGE}</strong></div>
                             <div>🔬 Branch: <strong>{LOCKED_BRANCH}</strong></div>
                           </div>
                         </AlertDescription>
                       </Alert>

                       <div className="grid md:grid-cols-2 gap-4">
                         <div>
                           <label className="font-semibold text-slate-700">Academic Year *</label>
                           <Select value={formData.year} onValueChange={(value) => setFormData({...formData, year: value})}>
                             <SelectTrigger><SelectValue placeholder="Select year"/></SelectTrigger>
                             <SelectContent>
                               {years.map(year => (
                                 <SelectItem key={year} value={year}>{year}</SelectItem>
                               ))}
                             </SelectContent>
                           </Select>
                         </div>
                         <div>
                           <label className="font-semibold text-slate-700">Division *</label>
                           <Select value={formData.division} onValueChange={(value) => setFormData({...formData, division: value})}>
                             <SelectTrigger><SelectValue placeholder="Select division"/></SelectTrigger>
                             <SelectContent>
                               {divisions.map(division => (
                                 <SelectItem key={division} value={division}>{division}</SelectItem>
                               ))}
                             </SelectContent>
                           </Select>
                         </div>
                       </div>
                     </div>
                    )}
                    
                    <Button onClick={handleBatchParametersSubmit} className="w-full">
                        Proceed to Upload <ArrowLeft className="w-4 h-4 ml-2 rotate-180"/>
                    </Button>
                </CardContent>
             </Card>
          )}

          {step === 2 && selectedBatch && (
             <Card className="backdrop-blur-xl bg-white/70 border-white/50 shadow-2xl">
                <CardHeader className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-b border-white/30">
                    <CardTitle className="flex items-center gap-2"><UploadIcon className="w-5 h-5"/>Upload for: {selectedBatch.batch_name}</CardTitle>
                </CardHeader>
                 <CardContent>
                    <FileUploadSection 
                      batchParameters={selectedBatch}
                      onFileUpload={handleFileUpload}
                      onBack={resetFlow}
                      isProcessing={isProcessing}
                    />
                 </CardContent>
             </Card>
          )}

          {step === 3 && (
            <StudentDataPreview 
              students={extractedStudents}
              batchParameters={selectedBatch}
              onSave={handleSaveStudents}
              onBack={() => setStep(2)}
              isProcessing={isProcessing}
            />
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}</style>
    </div>
  );
}