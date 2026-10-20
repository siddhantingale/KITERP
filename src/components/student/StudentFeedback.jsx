import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Star, CheckCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function StudentFeedback({ student }) {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    type: 'Faculty',
    faculty_name: '',
    rating: 5,
    comments: '',
    isAnonymous: false
  });
  const [faculties, setFaculties] = useState([]);

  useEffect(() => {
    const loadFaculties = async () => {
      try {
        const facultyList = await api.entities.Faculty.filter({ status: 'active' });
        setFaculties(facultyList);
      } catch (error) {
        console.error("Error loading faculties:", error);
      }
    };
    loadFaculties();
  }, []);

  useEffect(() => {
    fetchFeedbacks();
  }, [student]);

  const fetchFeedbacks = async () => {
    try {
      const list = await api.entities.Feedback.filter({
        student_id: student.id
      }, '-created_date');
      
      // Use static feedback if no data
      if (list.length === 0) {
        const staticFeedback = [
          {
            id: '1',
            feedback_type: 'Faculty',
            rating: 5,
            comments: 'Dr. Anil Kumar explains Machine Learning concepts very clearly. The practical examples are really helpful.',
            is_anonymous: false,
            status: 'Reviewed'
          },
          {
            id: '2',
            feedback_type: 'Infrastructure',
            rating: 4,
            comments: 'The computer lab facilities are good, but could use more high-performance machines for ML training.',
            is_anonymous: true,
            status: 'Acknowledged'
          }
        ];
        setFeedbacks(staticFeedback);
      } else {
        setFeedbacks(list);
      }
    } catch (error) {
      console.error("Error fetching feedbacks:", error);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    try {
      await api.entities.Feedback.create({
        student_id: student.id,
        student_name: formData.isAnonymous ? 'Anonymous' : student.name,
        student_email: student.email,
        batch_id: student.batch_id,
        feedback_type: formData.type,
        faculty_name: formData.type === 'Faculty' ? formData.faculty_name : null,
        rating: formData.rating,
        comments: formData.comments,
        is_anonymous: formData.isAnonymous,
        college_name: student.college_name,
        year: student.year,
        branch: student.branch
      });
      
      await fetchFeedbacks();
      setShowForm(false);
      setFormData({ type: 'Faculty', faculty_name: '', rating: 5, comments: '', isAnonymous: false });
    } catch (error) {
      console.error("Error submitting feedback:", error);
    }
  };

  if (loading) {
    return <div className="h-64 bg-gray-200 rounded animate-pulse"></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">💬 Feedback</h1>
          <p className="text-gray-600 mt-1">Share your experience</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
          <MessageSquare className="w-4 h-4 mr-2" />
          Give Feedback
        </Button>
      </div>

      {/* Feedbacks List */}
      <div className="space-y-4">
        {feedbacks.map(fb => (
          <Card key={fb.id} className="border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-semibold">
                    {fb.feedback_type}
                  </span>
                  {fb.is_anonymous && (
                    <span className="ml-2 px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                      Anonymous
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-4 h-4 ${i < fb.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} />
                  ))}
                </div>
              </div>
              <p className="text-gray-700">{fb.comments}</p>
              <div className="flex items-center gap-2 mt-3">
                <span className={`px-3 py-1 text-xs rounded-full ${
                  fb.status === 'Reviewed' ? 'bg-green-100 text-green-700' :
                  fb.status === 'Acknowledged' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {fb.status}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {feedbacks.length === 0 && (
          <div className="text-center py-12">
            <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No feedbacks submitted yet</p>
          </div>
        )}
      </div>

      {/* Feedback Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Feedback</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Feedback Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value, faculty_name: ''})}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="Faculty">Faculty Feedback</option>
                <option value="Other">Other Feedback</option>
              </select>
            </div>

            {formData.type === 'Faculty' && (
              <div>
                <label className="block text-sm font-semibold mb-2">Select Faculty *</label>
                <select
                  value={formData.faculty_name}
                  onChange={(e) => setFormData({...formData, faculty_name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">Choose faculty...</option>
                  {faculties.map(f => (
                    <option key={f.id} value={f.name}>{f.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold mb-2">Rating</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(num => (
                  <button
                    key={num}
                    onClick={() => setFormData({...formData, rating: num})}
                    className={`p-2 rounded ${formData.rating >= num ? 'text-yellow-500' : 'text-gray-300'}`}
                  >
                    <Star className={`w-8 h-8 ${formData.rating >= num ? 'fill-yellow-500' : ''}`} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Comments</label>
              <Textarea
                value={formData.comments}
                onChange={(e) => setFormData({...formData, comments: e.target.value})}
                placeholder="Share your feedback..."
                rows={4}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isAnonymous}
                onChange={(e) => setFormData({...formData, isAnonymous: e.target.checked})}
                id="anonymous"
              />
              <label htmlFor="anonymous" className="text-sm">Submit anonymously</label>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSubmit} className="bg-blue-600">Submit Feedback</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}