import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Eye, FileText, Upload, Download, Clock, CheckCircle, AlertCircle, BookOpen, File } from "lucide-react";
import QuizBuilder from "../components/assignment/QuizBuilder";
import { format, isPast } from "date-fns";
import { toast } from "sonner";

export default function AssignmentManagement() {
  const [user, setUser] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEvaluateModalOpen, setIsEvaluateModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [contentType, setContentType] = useState("FILE");
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    subject: "",
    batch_id: "",
    deadline: "",
    max_marks: 100,
    assignment_category: "Individual",
    attachment_url: "",
    quiz_time_limit: null,
    quiz_shuffle_questions: false,
    quiz_attempt_limit: 1
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const currentUser = await api.auth.me();
      setUser(currentUser);

      const [assignmentsList, batchesList] = await Promise.all([
        api.entities.Assignment.filter({ faculty_email: currentUser.email }, '-created_date'),
        api.entities.Batch.list()
      ]);

      setAssignments(assignmentsList);
      setBatches(batchesList);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  const handleCreateAssignment = async () => {
    try {
      const selectedBatch = batches.find(b => b.batch_id === formData.batch_id);
      
      const assignmentData = {
        ...formData,
        content_type: contentType,
        faculty_email: user.email,
        faculty_name: user.full_name,
        college_name: selectedBatch?.college_name || "KIT's College of Engineering, Kolhapur",
        year: selectedBatch?.year || "",
        branch: selectedBatch?.branch || "Artificial Intelligence & Machine Learning",
        status: 'active'
      };

      // Calculate max_marks for QUIZ type
      if (contentType === "QUIZ") {
        assignmentData.max_marks = quizQuestions.reduce((sum, q) => sum + q.marks, 0);
      }

      const newAssignment = await api.entities.Assignment.create(assignmentData);

      // Create quiz questions if QUIZ type
      if (contentType === "QUIZ" && quizQuestions.length > 0) {
        await Promise.all(
          quizQuestions.map((q, index) =>
            api.entities.QuizQuestion.create({
              assignment_id: newAssignment.id,
              question_text: q.question_text,
              question_type: q.question_type,
              marks: q.marks,
              options: q.options || [],
              correct_answer: q.correct_answer,
              order: index + 1
            })
          )
        );
      }

      await fetchData();
      setIsCreateModalOpen(false);
      resetForm();
      toast.success("Assignment created successfully!");
    } catch (error) {
      console.error("Error creating assignment:", error);
      toast.error("Failed to create assignment");
    }
  };

  const handleDeleteAssignment = async (id) => {
    if (!confirm("Delete this assignment? All submissions will be lost.")) return;
    
    try {
      await api.entities.Assignment.delete(id);
      await fetchData();
      toast.success("Assignment deleted successfully!");
    } catch (error) {
      console.error("Error deleting assignment:", error);
      toast.error("Failed to delete assignment");
    }
  };

  const handleViewSubmissions = async (assignment) => {
    try {
      const submissionsList = await api.entities.AssignmentSubmission.filter({
        assignment_id: assignment.id
      });
      setSubmissions(submissionsList);
      setSelectedAssignment(assignment);
      setIsEvaluateModalOpen(true);
    } catch (error) {
      console.error("Error fetching submissions:", error);
    }
  };

  const handleEvaluateSubmission = async (submissionId, marks, remarks) => {
    try {
      await api.entities.AssignmentSubmission.update(submissionId, {
        marks_obtained: marks,
        faculty_remarks: remarks,
        status: 'Evaluated',
        evaluated_at: new Date().toISOString()
      });

      // Refresh submissions
      const updatedSubmissions = await api.entities.AssignmentSubmission.filter({
        assignment_id: selectedAssignment.id
      });
      setSubmissions(updatedSubmissions);
      toast.success("Submission evaluated successfully!");
    } catch (error) {
      console.error("Error evaluating submission:", error);
      toast.error("Failed to evaluate submission");
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a PDF or DOC file");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setUploadingFile(true);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      setFormData({...formData, attachment_url: file_url});
      toast.success("File uploaded successfully!");
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Failed to upload file");
    }
    setUploadingFile(false);
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      subject: "",
      batch_id: "",
      deadline: "",
      max_marks: 100,
      assignment_category: "Individual",
      attachment_url: "",
      quiz_time_limit: null,
      quiz_shuffle_questions: false,
      quiz_attempt_limit: 1
    });
    setContentType("FILE");
    setQuizQuestions([]);
  };

  const getSubmissionStats = (assignmentId) => {
    const assignmentSubmissions = submissions.filter(s => s.assignment_id === assignmentId);
    return {
      total: assignmentSubmissions.length,
      submitted: assignmentSubmissions.filter(s => s.status === 'Submitted').length,
      late: assignmentSubmissions.filter(s => s.is_late).length,
      evaluated: assignmentSubmissions.filter(s => s.status === 'Evaluated').length
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">📝 Assignment Management</h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">Create, manage, and evaluate student assignments</p>
          </div>
          <Button 
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Assignment
          </Button>
        </div>

        {/* Assignments List */}
        <div className="space-y-4">
          {assignments.map(assignment => {
            const isOverdue = isPast(new Date(assignment.deadline));
            
            return (
              <Card key={assignment.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="flex-1 w-full">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">{assignment.title}</h3>
                        <Badge className={assignment.content_type === 'QUIZ' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}>
                          {assignment.content_type === 'QUIZ' ? '📝 QUIZ' : '📄 FILE'}
                        </Badge>
                        <Badge className={assignment.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                          {assignment.status}
                        </Badge>
                        {isOverdue && <Badge className="bg-red-100 text-red-700">Overdue</Badge>}
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-3">{assignment.description}</p>
                      
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          <span>{assignment.subject}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>Due: {format(new Date(assignment.deadline), 'PPP')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>Max Marks: {assignment.max_marks}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>Category: {assignment.assignment_category}</span>
                        </div>
                        {assignment.content_type === 'QUIZ' && assignment.quiz_time_limit && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>Time: {assignment.quiz_time_limit} min</span>
                          </div>
                        )}
                        {assignment.content_type === 'FILE' && assignment.attachment_url && (
                          <a 
                            href={assignment.attachment_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold"
                          >
                            <Download className="w-4 h-4" />
                            <span>Download Questions</span>
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleViewSubmissions(assignment)}
                        className="flex-1 sm:flex-none"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        <span className="hidden sm:inline">View Submissions</span>
                        <span className="sm:hidden">View</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeleteAssignment(assignment.id)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {assignments.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No assignments created yet</p>
              <Button onClick={() => setIsCreateModalOpen(true)}>
                Create Your First Assignment
              </Button>
            </div>
          )}
        </div>

        {/* Create Assignment Modal */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Assignment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Assignment Type Selector */}
              <div>
                <Label>Assignment Type *</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <Card 
                    className={`cursor-pointer border-2 transition-all ${contentType === 'FILE' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                    onClick={() => setContentType('FILE')}
                  >
                    <CardContent className="p-6 text-center">
                      <FileText className={`w-12 h-12 mx-auto mb-3 ${contentType === 'FILE' ? 'text-blue-600' : 'text-gray-400'}`} />
                      <h4 className="font-bold mb-1">File-Based Assignment</h4>
                      <p className="text-xs text-gray-600">Students upload files (PDF, DOC, etc.)</p>
                    </CardContent>
                  </Card>
                  
                  <Card 
                    className={`cursor-pointer border-2 transition-all ${contentType === 'QUIZ' ? 'border-purple-600 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}
                    onClick={() => setContentType('QUIZ')}
                  >
                    <CardContent className="p-6 text-center">
                      <BookOpen className={`w-12 h-12 mx-auto mb-3 ${contentType === 'QUIZ' ? 'text-purple-600' : 'text-gray-400'}`} />
                      <h4 className="font-bold mb-1">Quiz-Based Assignment</h4>
                      <p className="text-xs text-gray-600">MCQ & Short Answer questions</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
              <div>
                <Label>Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="e.g., Machine Learning Assignment 1"
                />
              </div>

              <div>
                <Label>Description *</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Detailed description of the assignment..."
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Subject *</Label>
                  <Input
                    value={formData.subject}
                    onChange={(e) => setFormData({...formData, subject: e.target.value})}
                    placeholder="e.g., Machine Learning"
                  />
                </div>

                <div>
                  <Label>Batch/Class *</Label>
                  <Select value={formData.batch_id} onValueChange={(value) => setFormData({...formData, batch_id: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select batch" />
                    </SelectTrigger>
                    <SelectContent>
                      {batches.map(batch => (
                        <SelectItem key={batch.id} value={batch.batch_id}>
                          {batch.batch_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Deadline *</Label>
                  <Input
                    type="datetime-local"
                    value={formData.deadline}
                    onChange={(e) => setFormData({...formData, deadline: e.target.value})}
                  />
                </div>

                <div>
                  <Label>Maximum Marks</Label>
                  <Input
                    type="number"
                    value={formData.max_marks}
                    onChange={(e) => setFormData({...formData, max_marks: parseInt(e.target.value)})}
                  />
                </div>
              </div>

              <div>
                <Label>Assignment Category</Label>
                <Select value={formData.assignment_category} onValueChange={(value) => setFormData({...formData, assignment_category: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Individual">Individual</SelectItem>
                    <SelectItem value="Group">Group</SelectItem>
                    <SelectItem value="Lab">Lab</SelectItem>
                    <SelectItem value="Project">Project</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* File Upload - Only for FILE type */}
              {contentType === 'FILE' && (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <Label className="mb-2 block">Upload Assignment Questions (PDF/DOC)</Label>
                  <div className="flex items-center justify-center">
                    {formData.attachment_url ? (
                      <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg w-full">
                        <FileText className="w-8 h-8 text-blue-600" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900">File uploaded successfully</p>
                          <p className="text-xs text-gray-600">Assignment questions attached</p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setFormData({...formData, attachment_url: ''})}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <label className="cursor-pointer flex flex-col items-center gap-2 w-full">
                        <Upload className="w-12 h-12 text-gray-400" />
                        <div className="text-center">
                          <p className="text-sm font-semibold text-gray-700">
                            {uploadingFile ? 'Uploading...' : 'Click to upload'}
                          </p>
                          <p className="text-xs text-gray-500">PDF or DOC (Max 10MB)</p>
                        </div>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={handleFileUpload}
                          disabled={uploadingFile}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}

              {/* Quiz Settings */}
              {contentType === 'QUIZ' && (
                <>
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-3">Quiz Settings</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Time Limit (minutes)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={formData.quiz_time_limit || ''}
                          onChange={(e) => setFormData({...formData, quiz_time_limit: e.target.value ? parseInt(e.target.value) : null})}
                          placeholder="Leave empty for no limit"
                        />
                      </div>
                      <div>
                        <Label>Attempt Limit</Label>
                        <Input
                          type="number"
                          min="1"
                          value={formData.quiz_attempt_limit}
                          onChange={(e) => setFormData({...formData, quiz_attempt_limit: parseInt(e.target.value)})}
                        />
                      </div>
                    </div>
                  </div>

                  <QuizBuilder 
                    questions={quizQuestions} 
                    onQuestionsChange={setQuizQuestions}
                  />
                </>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateAssignment}
                  disabled={
                    !formData.title || !formData.subject || !formData.batch_id || !formData.deadline ||
                    (contentType === 'QUIZ' && quizQuestions.length === 0)
                  }
                >
                  Create Assignment
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Submissions & Evaluation Modal */}
        <Dialog open={isEvaluateModalOpen} onOpenChange={setIsEvaluateModalOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedAssignment?.title} - Submissions
              </DialogTitle>
            </DialogHeader>

            {selectedAssignment && (
              <Tabs defaultValue="submissions">
                <TabsList>
                  <TabsTrigger value="submissions">Submissions ({submissions.length})</TabsTrigger>
                  <TabsTrigger value="stats">Statistics</TabsTrigger>
                </TabsList>

                <TabsContent value="submissions" className="space-y-4 mt-4">
                  {submissions.map(submission => (
                    <SubmissionCard 
                      key={submission.id} 
                      submission={submission} 
                      assignment={selectedAssignment}
                      onEvaluate={handleEvaluateSubmission}
                    />
                  ))}

                  {submissions.length === 0 && (
                    <div className="text-center py-12">
                      <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600">No submissions yet</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="stats" className="mt-4">
                  <SubmissionStats submissions={submissions} assignment={selectedAssignment} />
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// Submission Card Component
function SubmissionCard({ submission, assignment, onEvaluate }) {
  const [marks, setMarks] = useState(submission.marks_obtained || '');
  const [remarks, setRemarks] = useState(submission.faculty_remarks || '');
  const [isEvaluating, setIsEvaluating] = useState(false);

  const handleEvaluate = async () => {
    setIsEvaluating(true);
    await onEvaluate(submission.id, marks, remarks);
    setIsEvaluating(false);
  };

  return (
    <Card className={`border-2 ${submission.is_late ? 'border-orange-200 bg-orange-50' : 'border-gray-200'}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h4 className="font-bold text-lg">{submission.student_name}</h4>
            <p className="text-sm text-gray-600">Roll No: {submission.roll_no} | PRN: {submission.prn}</p>
            <p className="text-sm text-gray-600">
              Submitted: {format(new Date(submission.submitted_at), 'PPP p')}
            </p>
          </div>
          <div className="flex gap-2">
            <Badge className={
              submission.status === 'Evaluated' ? 'bg-green-100 text-green-700' :
              submission.is_late ? 'bg-orange-100 text-orange-700' :
              'bg-blue-100 text-blue-700'
            }>
              {submission.status}
            </Badge>
            {submission.is_late && (
              <Badge className="bg-red-100 text-red-700">
                <AlertCircle className="w-3 h-3 mr-1" />
                Late Submission
              </Badge>
            )}
          </div>
        </div>

        {/* Display submission - Text or File */}
        <div className="mb-4">
          {submission.submission_file_url ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                <File className="w-4 h-4" />
                <span className="font-semibold">PDF Submission:</span>
              </div>
              
              {/* PDF Viewer using Google Docs Viewer for better compatibility */}
              <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-100">
                <iframe 
                  src={`https://docs.google.com/viewer?url=${encodeURIComponent(submission.submission_file_url)}&embedded=true`}
                  className="w-full h-[500px]"
                  title="Student Submission PDF"
                  frameBorder="0"
                />
              </div>
              
              {/* Action Buttons */}
              <div className="flex justify-end gap-2">
                <a 
                  href={submission.submission_file_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-semibold"
                >
                  <Eye className="w-4 h-4" />
                  Open in New Tab
                </a>
                <a 
                  href={submission.submission_file_url} 
                  download
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </a>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-white rounded-lg border">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{submission.submission_text}</p>
            </div>
          )}
        </div>

        {submission.status !== 'Evaluated' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Marks (out of {assignment.max_marks})</Label>
              <Input
                type="number"
                max={assignment.max_marks}
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
                placeholder="Enter marks"
              />
            </div>
            <div>
              <Label>Remarks/Feedback</Label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter your feedback..."
                rows={3}
              />
            </div>
          </div>
        )}

        {submission.status !== 'Evaluated' && (
          <div className="mt-4">
            <Button 
              onClick={handleEvaluate}
              disabled={!marks || isEvaluating}
              className="w-full"
            >
              {isEvaluating ? 'Evaluating...' : 'Evaluate Submission'}
            </Button>
          </div>
        )}

        {submission.status === 'Evaluated' && (
          <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm font-semibold text-green-900">
              Marks: {submission.marks_obtained} / {assignment.max_marks}
            </p>
            {submission.faculty_remarks && (
              <p className="text-sm text-green-700 mt-2">
                <strong>Feedback:</strong> {submission.faculty_remarks}
              </p>
            )}
            <p className="text-xs text-green-600 mt-2">
              Evaluated on: {format(new Date(submission.evaluated_at), 'PPP')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Submission Statistics Component
function SubmissionStats({ submissions, assignment }) {
  const totalSubmissions = submissions.length;
  const lateSubmissions = submissions.filter(s => s.is_late).length;
  const evaluatedSubmissions = submissions.filter(s => s.status === 'Evaluated').length;
  const avgMarks = evaluatedSubmissions > 0 
    ? (submissions.filter(s => s.marks_obtained).reduce((sum, s) => sum + s.marks_obtained, 0) / evaluatedSubmissions).toFixed(2)
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Total Submissions</p>
            <p className="text-3xl font-bold text-blue-600">{totalSubmissions}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Late Submissions</p>
            <p className="text-3xl font-bold text-orange-600">{lateSubmissions}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Evaluated</p>
            <p className="text-3xl font-bold text-green-600">{evaluatedSubmissions}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Average Marks</p>
            <p className="text-3xl font-bold text-purple-600">{avgMarks}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submission Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {submissions.map(s => (
              <div key={s.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-semibold">{s.student_name}</p>
                  <p className="text-sm text-gray-600">Roll: {s.roll_no}</p>
                </div>
                <div className="text-right">
                  {s.status === 'Evaluated' ? (
                    <p className="font-semibold text-green-600">
                      {s.marks_obtained}/{assignment.max_marks}
                    </p>
                  ) : (
                    <Badge>Pending</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}