import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { AlertCircle, Clock, CheckCircle, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { toast } from "sonner";
import { sendPushNotification } from "@/components/notifications/PushNotificationManager";

export default function StudentComplaints({ student }) {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    category: 'Faculty',
    faculty_name: '',
    title: '',
    description: '',
    priority: 'Medium'
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
    fetchComplaints();
  }, [student]);

  const fetchComplaints = async () => {
    try {
      const list = await api.entities.Complaint.filter({
        student_id: student.id
      }, '-created_date');
      
      // Use static complaints if no data
      if (list.length === 0) {
        const staticComplaints = [
          {
            id: '1',
            title: 'Lab Equipment Issue',
            description: 'Some computers in Lab 301 are not working properly. Need immediate repair for ML practical sessions.',
            category: 'Infrastructure',
            priority: 'High',
            status: 'In Review',
            created_date: '2026-01-20',
            admin_response: 'IT team has been notified. Repairs scheduled for tomorrow.'
          },
          {
            id: '2',
            title: 'Assignment Submission Portal Error',
            description: 'Unable to submit Data Structures assignment due to portal error. Getting timeout message.',
            category: 'Technical',
            priority: 'Urgent',
            status: 'Resolved',
            created_date: '2026-01-18',
            admin_response: 'Portal has been fixed. You can now submit your assignment. Deadline extended by 2 days.'
          }
        ];
        setComplaints(staticComplaints);
      } else {
        setComplaints(list);
      }
    } catch (error) {
      console.error("Error fetching complaints:", error);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    try {
      const complaint = await api.entities.Complaint.create({
        student_id: student.id,
        student_name: student.name,
        student_email: student.email,
        prn: student.prn,
        batch_id: student.batch_id,
        college_name: student.college_name,
        year: student.year,
        faculty_name: formData.category === 'Faculty' ? formData.faculty_name : null,
        issue: formData.description,
        ...formData
      });

      // Send push notification to all admins
      await sendPushNotification({
        title: `🚨 New Complaint: ${formData.title}`,
        body: `From: ${student.name} | Category: ${formData.category} | Priority: ${formData.priority}`,
        targetType: 'admin',
        data: { 
          type: 'complaint', 
          priority: formData.priority,
          url: '/FeedbackComplaintsAdmin'
        }
      });
      
      toast.success("Complaint submitted successfully!");
      await fetchComplaints();
      setShowForm(false);
      setFormData({ category: 'Faculty', faculty_name: '', title: '', description: '', priority: 'Medium' });
    } catch (error) {
      console.error("Error submitting complaint:", error);
      toast.error("Failed to submit complaint");
    }
  };

  const getStatusIcon = (status) => {
    if (status === 'Resolved') return CheckCircle;
    if (status === 'In Review') return Clock;
    return AlertCircle;
  };

  if (loading) {
    return <div className="h-64 bg-gray-200 rounded animate-pulse"></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🚨 Complaints</h1>
          <p className="text-gray-600 mt-1">Raise and track your concerns</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-red-600 hover:bg-red-700">
          <AlertCircle className="w-4 h-4 mr-2" />
          Raise Complaint
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Total</p>
            <h3 className="text-4xl font-bold text-gray-900">{complaints.length}</h3>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">In Review</p>
            <h3 className="text-4xl font-bold text-orange-600">
              {complaints.filter(c => c.status === 'In Review').length}
            </h3>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Resolved</p>
            <h3 className="text-4xl font-bold text-green-600">
              {complaints.filter(c => c.status === 'Resolved').length}
            </h3>
          </CardContent>
        </Card>
      </div>

      {/* Complaints List */}
      <div className="space-y-4">
        {complaints.map(complaint => {
          const StatusIcon = getStatusIcon(complaint.status);
          return (
            <Card key={complaint.id} className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{complaint.title}</h3>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                        {complaint.category}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        complaint.priority === 'Urgent' ? 'bg-red-100 text-red-700' :
                        complaint.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                        complaint.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {complaint.priority}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusIcon className={`w-5 h-5 ${
                      complaint.status === 'Resolved' ? 'text-green-600' :
                      complaint.status === 'In Review' ? 'text-orange-600' :
                      'text-gray-600'
                    }`} />
                    <span className={`px-3 py-1 text-sm rounded-full font-semibold ${
                      complaint.status === 'Resolved' ? 'bg-green-100 text-green-700' :
                      complaint.status === 'In Review' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {complaint.status}
                    </span>
                  </div>
                </div>
                
                <p className="text-gray-700 mb-3">{complaint.description}</p>
                <p className="text-xs text-gray-500">
                  Submitted: {format(new Date(complaint.created_date), 'PPP')}
                </p>

                {complaint.admin_response && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="w-4 h-4 text-blue-600" />
                      <span className="font-semibold text-blue-900">Admin Response</span>
                    </div>
                    <p className="text-sm text-gray-700">{complaint.admin_response}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {complaints.length === 0 && (
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No complaints submitted</p>
          </div>
        )}
      </div>

      {/* Complaint Form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raise a Complaint</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Complaint Type</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value, faculty_name: ''})}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="Faculty">Faculty Related</option>
                <option value="Other">Other Issues</option>
              </select>
            </div>

            {formData.category === 'Faculty' && (
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
              <label className="block text-sm font-semibold mb-2">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({...formData, priority: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Title</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="Brief title of your complaint"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Describe your issue in detail..."
                rows={5}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSubmit} className="bg-red-600">Submit Complaint</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}