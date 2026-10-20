import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Upload, Clock, CheckCircle, AlertCircle, Calendar, BookOpen, File, Eye, Download } from "lucide-react";
import QuizTaker from "../assignment/QuizTaker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, differenceInDays, isPast } from "date-fns";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

export default function StudentAssignments({ student }) {
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissionText, setSubmissionText] = useState('');
  const [submissionFile, setSubmissionFile] = useState(null);
  const [submissionFileUrl, setSubmissionFileUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [isQuizMode, setIsQuizMode] = useState(false);
  const [submissionType, setSubmissionType] = useState('text'); // 'text' or 'file'

  useEffect(() => {
    fetchAssignments();
  }, [student]);

  const fetchAssignments = async () => {
    try {
      const assignmentsList = await api.entities.Assignment.filter({
        batch_id: student.batch_id
      }, '-deadline');

      const submissionsList = await api.entities.AssignmentSubmission.filter({
        student_id: student.id
      });

      // Use static assignments if no data
      if (assignmentsList.length === 0) {
        const staticAssignments = [
          {
            id: '1',
            title: 'Machine Learning - Neural Network Implementation',
            description: 'Implement a multi-layer neural network from scratch using NumPy. Include forward propagation, backpropagation, and gradient descent.',
            subject: 'Machine Learning',
            batch_id: student.batch_id,
            deadline: '2026-01-28T23:59:00',
            max_marks: 100,
            content_type: 'FILE',
            status: 'active',
            faculty_name: 'Dr. Anil Kumar'
          },
          {
            id: '2',
            title: 'Data Structures - Binary Search Tree Operations',
            description: 'Create a balanced BST implementation with insert, delete, search, and traversal operations.',
            subject: 'Data Structures',
            batch_id: student.batch_id,
            deadline: '2026-01-30T23:59:00',
            max_marks: 100,
            content_type: 'FILE',
            status: 'active',
            faculty_name: 'Prof. Priya Sharma'
          },
          {
            id: '3',
            title: 'DBMS Quiz - SQL and Normalization',
            description: 'Online quiz covering advanced SQL queries, joins, and database normalization concepts.',
            subject: 'Database Management',
            batch_id: student.batch_id,
            deadline: '2026-01-25T23:59:00',
            max_marks: 50,
            content_type: 'QUIZ',
            status: 'active',
            faculty_name: 'Dr. Rajesh Patil'
          }
        ];
        
        const staticSubmissions = [
          {
            assignment_id: '3',
            student_id: student.id,
            status: 'Evaluated',
            marks_obtained: 45,
            submitted_at: '2026-01-24T18:30:00',
            is_late: false
          }
        ];
        
        setAssignments(staticAssignments);
        setSubmissions(staticSubmissions);
      } else {
        setAssignments(assignmentsList);
        setSubmissions(submissionsList);
      }
    } catch (error) {
      console.error("Error fetching assignments:", error);
    }
    setLoading(false);
  };

  const handleStartQuiz = async (assignment) => {
    try {
      const questions = await api.entities.QuizQuestion.filter({
        assignment_id: assignment.id
      }, 'order');
      
      setQuizQuestions(questions);
      setSelectedAssignment(assignment);
      setIsQuizMode(true);
    } catch (error) {
      console.error("Error loading quiz:", error);
    }
  };

  const handleQuizSubmit = async (answers) => {
    try {
      const deadline = new Date(selectedAssignment.deadline);
      const isLate = isPast(deadline);

      // Calculate auto-graded marks
      let autoMarks = 0;
      const responses = [];

      for (const question of quizQuestions) {
        const studentAnswer = answers[question.id];
        const isCorrect = question.question_type === 'MCQ' && 
                          studentAnswer === question.correct_answer;
        
        if (isCorrect) {
          autoMarks += question.marks;
        }

        responses.push({
          assignment_id: selectedAssignment.id,
          student_id: student.id,
          student_name: student.name,
          student_email: student.email,
          prn: student.prn,
          roll_no: student.roll_no,
          question_id: question.id,
          student_answer: studentAnswer || '',
          is_correct: isCorrect,
          marks_awarded: isCorrect ? question.marks : 0,
          submitted_at: new Date().toISOString()
        });
      }

      // Create responses
      await Promise.all(responses.map(r => api.entities.QuizResponse.create(r)));

      // Create submission
      await api.entities.AssignmentSubmission.create({
        assignment_id: selectedAssignment.id,
        student_id: student.id,
        student_name: student.name,
        student_email: student.email,
        prn: student.prn,
        roll_no: student.roll_no,
        submitted_at: new Date().toISOString(),
        is_late: isLate,
        status: 'Evaluated',
        auto_graded_marks: autoMarks,
        marks_obtained: autoMarks,
        quiz_completed: true,
        attempt_number: 1
      });

      await fetchAssignments();
      setSelectedAssignment(null);
      setIsQuizMode(false);
      setQuizQuestions([]);
    } catch (error) {
      console.error("Error submitting quiz:", error);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type - only PDF
    if (file.type !== 'application/pdf') {
      toast.error("Please upload a PDF file only");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setSubmissionFile(file);
    
    // Upload file
    setUploadingFile(true);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      setSubmissionFileUrl(file_url);
      toast.success("PDF uploaded successfully!");
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Failed to upload file");
      setSubmissionFile(null);
    }
    setUploadingFile(false);
  };

  const handleSubmit = async () => {
    if (submissionType === 'text' && !submissionText.trim()) {
      toast.error("Please enter your submission text");
      return;
    }
    if (submissionType === 'file' && !submissionFileUrl) {
      toast.error("Please upload a PDF file");
      return;
    }
    
    setUploading(true);
    try {
      const deadline = new Date(selectedAssignment.deadline);
      const isLate = isPast(deadline);

      await api.entities.AssignmentSubmission.create({
        assignment_id: selectedAssignment.id,
        student_id: student.id,
        student_name: student.name,
        student_email: student.email,
        prn: student.prn,
        roll_no: student.roll_no,
        submission_text: submissionType === 'text' ? submissionText : '',
        submission_file_url: submissionType === 'file' ? submissionFileUrl : '',
        submitted_at: new Date().toISOString(),
        is_late: isLate,
        status: 'Submitted'
      });

      await fetchAssignments();
      setSelectedAssignment(null);
      setSubmissionText('');
      setSubmissionFile(null);
      setSubmissionFileUrl('');
      setSubmissionType('text');
      
      // Success notification
      toast.success("Assignment submitted successfully! 🎉", {
        description: "Your submission has been recorded and sent to the faculty."
      });
    } catch (error) {
      console.error("Error submitting assignment:", error);
      toast.error("Failed to submit assignment. Please try again.");
    }
    setUploading(false);
  };

  const getStatus = (assignment) => {
    const submission = submissions.find(s => s.assignment_id === assignment.id);
    if (submission) {
      if (submission.status === 'Evaluated') return { label: 'Evaluated', color: 'bg-green-100 text-green-700', icon: CheckCircle };
      if (submission.is_late) return { label: 'Late', color: 'bg-orange-100 text-orange-700', icon: AlertCircle };
      return { label: 'Submitted', color: 'bg-blue-100 text-blue-700', icon: CheckCircle };
    }
    const deadline = new Date(assignment.deadline);
    if (isPast(deadline)) return { label: 'Overdue', color: 'bg-red-100 text-red-700', icon: AlertCircle };
    return { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock };
  };

  const getDaysLeft = (deadline) => {
    const days = differenceInDays(new Date(deadline), new Date());
    if (days < 0) return 'Overdue';
    if (days === 0) return 'Due today';
    if (days === 1) return '1 day left';
    return `${days} days left`;
  };

  if (loading) {
    return <div className="h-64 bg-gray-200 rounded animate-pulse"></div>;
  }

  const pendingCount = assignments.filter(a => !submissions.find(s => s.assignment_id === a.id)).length;
  const submittedCount = submissions.filter(s => s.status === 'Submitted').length;
  const evaluatedCount = submissions.filter(s => s.status === 'Evaluated').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">📝 Assignments</h1>
        <p className="text-gray-600 mt-1">Manage your assignments</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-red-600">
                <Clock className="w-6 h-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-gray-600">Pending</p>
            <h3 className="text-4xl font-bold text-gray-900">{pendingCount}</h3>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-gray-600">Submitted</p>
            <h3 className="text-4xl font-bold text-gray-900">{submittedCount}</h3>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-gray-600">Evaluated</p>
            <h3 className="text-4xl font-bold text-gray-900">{evaluatedCount}</h3>
          </CardContent>
        </Card>
      </div>

      {/* Assignments List */}
      <div className="space-y-4">
        {assignments.map(assignment => {
          const submission = submissions.find(s => s.assignment_id === assignment.id);
          const status = getStatus(assignment);
          const StatusIcon = status.icon;
          
          return (
            <Card key={assignment.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-900">{assignment.title}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${assignment.content_type === 'QUIZ' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {assignment.content_type === 'QUIZ' ? '📝 QUIZ' : '📄 FILE'}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status.color} flex items-center gap-1`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{assignment.description}</p>
                    
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        <span>{assignment.subject}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>Due: {format(new Date(assignment.deadline), 'PPP')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span className={isPast(new Date(assignment.deadline)) ? 'text-red-600 font-semibold' : ''}>
                          {getDaysLeft(assignment.deadline)}
                        </span>
                      </div>
                      {/* View Assignment PDF Button */}
                      {assignment.content_type === 'FILE' && assignment.attachment_url && (
                        <a 
                          href={assignment.attachment_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View Assignment</span>
                        </a>
                      )}
                    </div>

                    {submission && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm text-gray-700">
                          <strong>✅ Submitted on:</strong> {format(new Date(submission.submitted_at), 'PPP')}
                        </p>
                        {submission.submission_file_url && (
                          <p className="text-sm text-gray-700 mt-1">
                            <strong>📄 Type:</strong> PDF Submission
                          </p>
                        )}
                        {submission.marks_obtained !== undefined && submission.marks_obtained !== null && (
                          <p className="text-sm text-gray-700 mt-1">
                            <strong>📊 Marks:</strong> {submission.marks_obtained} / {assignment.max_marks}
                          </p>
                        )}
                        {submission.faculty_remarks && (
                          <p className="text-sm text-gray-700 mt-1">
                            <strong>💬 Remarks:</strong> {submission.faculty_remarks}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex-shrink-0">
                    {!submission && (
                      <Button 
                        onClick={() => assignment.content_type === 'QUIZ' ? handleStartQuiz(assignment) : setSelectedAssignment(assignment)}
                        className={assignment.content_type === 'QUIZ' ? 
                          'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700' :
                          'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                        }
                      >
                        {assignment.content_type === 'QUIZ' ? (
                          <>
                            <BookOpen className="w-4 h-4 mr-2" />
                            Start Quiz
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Submit
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {assignments.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No assignments yet</p>
          </div>
        )}
      </div>

      {/* Submission Dialog - Text or File Based */}
      <Dialog open={selectedAssignment !== null && !isQuizMode} onOpenChange={() => {
        setSelectedAssignment(null);
        setSubmissionText('');
        setSubmissionFile(null);
        setSubmissionFileUrl('');
        setSubmissionType('text');
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Submit Assignment</DialogTitle>
          </DialogHeader>
          {selectedAssignment && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-lg">{selectedAssignment.title}</h3>
                <p className="text-sm text-gray-600">{selectedAssignment.description}</p>
              </div>
              
              {/* Submission Type Selector */}
              <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
                <Label className="text-sm font-semibold mb-3 block">Choose Submission Method</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSubmissionType('text')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      submissionType === 'text' 
                        ? 'border-blue-600 bg-blue-50' 
                        : 'border-gray-300 bg-white hover:border-gray-400'
                    }`}
                  >
                    <FileText className={`w-6 h-6 mx-auto mb-1 ${submissionType === 'text' ? 'text-blue-600' : 'text-gray-400'}`} />
                    <p className={`text-xs font-semibold ${submissionType === 'text' ? 'text-blue-900' : 'text-gray-600'}`}>Text Submission</p>
                  </button>
                  
                  <button
                    onClick={() => setSubmissionType('file')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      submissionType === 'file' 
                        ? 'border-green-600 bg-green-50' 
                        : 'border-gray-300 bg-white hover:border-gray-400'
                    }`}
                  >
                    <File className={`w-6 h-6 mx-auto mb-1 ${submissionType === 'file' ? 'text-green-600' : 'text-gray-400'}`} />
                    <p className={`text-xs font-semibold ${submissionType === 'file' ? 'text-green-900' : 'text-gray-600'}`}>Upload PDF</p>
                  </button>
                </div>
              </div>
              
              {/* Text Submission */}
              {submissionType === 'text' && (
                <div>
                  <Label className="mb-2">Your Submission</Label>
                  <Textarea
                    value={submissionText}
                    onChange={(e) => setSubmissionText(e.target.value)}
                    placeholder="Enter your assignment submission text here..."
                    rows={8}
                    className="w-full"
                  />
                </div>
              )}

              {/* File Upload */}
              {submissionType === 'file' && (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <Label className="mb-2 block">Upload PDF File</Label>
                  {submissionFileUrl ? (
                    <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                      <File className="w-8 h-8 text-green-600" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-green-900">PDF uploaded successfully!</p>
                        <p className="text-xs text-green-700">{submissionFile?.name}</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSubmissionFile(null);
                          setSubmissionFileUrl('');
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center gap-2">
                      <Upload className="w-12 h-12 text-gray-400" />
                      <div className="text-center">
                        <p className="text-sm font-semibold text-gray-700">
                          {uploadingFile ? 'Uploading...' : 'Click to upload PDF'}
                        </p>
                        <p className="text-xs text-gray-500">PDF only (Max 10MB)</p>
                      </div>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleFileChange}
                        disabled={uploadingFile}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => {
                  setSelectedAssignment(null);
                  setSubmissionText('');
                  setSubmissionFile(null);
                  setSubmissionFileUrl('');
                  setSubmissionType('text');
                }}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={
                    uploading || 
                    uploadingFile ||
                    (submissionType === 'text' && !submissionText.trim()) ||
                    (submissionType === 'file' && !submissionFileUrl)
                  }
                  className="bg-gradient-to-r from-blue-600 to-indigo-600"
                >
                  {uploading ? 'Submitting...' : 'Submit Assignment'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quiz Taking Dialog */}
      <Dialog open={isQuizMode} onOpenChange={() => {
        setIsQuizMode(false);
        setSelectedAssignment(null);
        setQuizQuestions([]);
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedAssignment?.title}</DialogTitle>
          </DialogHeader>
          {selectedAssignment && quizQuestions.length > 0 && (
            <QuizTaker 
              questions={quizQuestions}
              timeLimit={selectedAssignment.quiz_time_limit}
              onSubmit={handleQuizSubmit}
              onCancel={() => {
                setIsQuizMode(false);
                setSelectedAssignment(null);
                setQuizQuestions([]);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}