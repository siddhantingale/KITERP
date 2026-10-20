import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageSquare, AlertTriangle, Search, Star, CheckCircle, Clock, XCircle, User, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function FeedbackComplaintsAdmin() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [response, setResponse] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [feedbackData, complaintData] = await Promise.all([
        api.entities.Feedback.list('-created_date', 100),
        api.entities.Complaint.list('-created_date', 100)
      ]);
      setFeedbacks(feedbackData);
      setComplaints(complaintData);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  const handleRespond = async (type, id) => {
    try {
      if (type === 'feedback') {
        await api.entities.Feedback.update(id, {
          admin_response: response,
          status: 'Responded'
        });
      } else {
        await api.entities.Complaint.update(id, {
          admin_response: response,
          status: 'Resolved'
        });
      }
      setResponse('');
      setSelectedItem(null);
      fetchData();
    } catch (error) {
      console.error("Error responding:", error);
    }
  };

  const handleStatusChange = async (type, id, status) => {
    try {
      if (type === 'feedback') {
        await api.entities.Feedback.update(id, { status });
      } else {
        await api.entities.Complaint.update(id, { status });
      }
      fetchData();
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Resolved':
      case 'Responded': return 'bg-green-100 text-green-800';
      case 'In Progress': return 'bg-blue-100 text-blue-800';
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      case 'Rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Medium': return 'bg-orange-100 text-orange-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filterItems = (items) => {
    return items.filter(item => {
      const matchesSearch = 
        (item.student_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.title || item.comments || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  };

  const pendingFeedbacks = feedbacks.filter(f => !f.status || f.status === 'Pending').length;
  const pendingComplaints = complaints.filter(c => !c.status || c.status === 'Pending').length;

  if (loading) {
    return <div className="p-6"><div className="animate-pulse h-96 bg-gray-200 rounded-xl"></div></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-8 text-white shadow-2xl">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <MessageSquare className="w-8 h-8" />
            Feedback & Complaints Management
          </h1>
          <p className="text-blue-100 mt-2">Review and respond to student feedback and complaints</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-xl">
            <CardContent className="p-6">
              <MessageSquare className="w-8 h-8 mb-2 opacity-80" />
              <div className="text-3xl font-bold">{feedbacks.length}</div>
              <div className="text-blue-100 text-sm">Total Feedbacks</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-500 to-orange-500 text-white border-0 shadow-xl">
            <CardContent className="p-6">
              <Clock className="w-8 h-8 mb-2 opacity-80" />
              <div className="text-3xl font-bold">{pendingFeedbacks}</div>
              <div className="text-yellow-100 text-sm">Pending Feedbacks</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white border-0 shadow-xl">
            <CardContent className="p-6">
              <AlertTriangle className="w-8 h-8 mb-2 opacity-80" />
              <div className="text-3xl font-bold">{complaints.length}</div>
              <div className="text-red-100 text-sm">Total Complaints</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-xl">
            <CardContent className="p-6">
              <Clock className="w-8 h-8 mb-2 opacity-80" />
              <div className="text-3xl font-bold">{pendingComplaints}</div>
              <div className="text-purple-100 text-sm">Pending Complaints</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Search by student name or content..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Resolved">Resolved</SelectItem>
                  <SelectItem value="Responded">Responded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="feedbacks" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-white shadow-lg rounded-xl p-1">
            <TabsTrigger value="feedbacks" className="rounded-lg">
              Feedbacks ({feedbacks.length})
            </TabsTrigger>
            <TabsTrigger value="complaints" className="rounded-lg">
              Complaints ({complaints.length})
            </TabsTrigger>
          </TabsList>

          {/* Feedbacks Tab */}
          <TabsContent value="feedbacks" className="space-y-4">
            {filterItems(feedbacks).length === 0 ? (
              <Card className="border-0 shadow-lg">
                <CardContent className="py-12 text-center">
                  <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No feedbacks found</p>
                </CardContent>
              </Card>
            ) : (
              filterItems(feedbacks).map(feedback => (
                <Card key={feedback.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <Badge className={getStatusColor(feedback.status || 'Pending')}>
                            {feedback.status || 'Pending'}
                          </Badge>
                          <Badge className="bg-blue-100 text-blue-800">
                            {feedback.feedback_type}
                          </Badge>
                          {feedback.faculty_name && (
                            <Badge variant="outline">{feedback.faculty_name}</Badge>
                          )}
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map(star => (
                              <Star
                                key={star}
                                className={`w-4 h-4 ${star <= (feedback.rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                              />
                            ))}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                          <User className="w-4 h-4" />
                          <span>{feedback.student_name || 'Anonymous'}</span>
                          <span className="text-gray-300">|</span>
                          <Calendar className="w-4 h-4" />
                          <span>{format(new Date(feedback.created_date), 'PP')}</span>
                        </div>

                        <p className="text-gray-700 mb-3">{feedback.comments}</p>

                        {feedback.admin_response && (
                          <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                            <p className="text-sm font-semibold text-green-800">Admin Response:</p>
                            <p className="text-sm text-green-700">{feedback.admin_response}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          onClick={() => { setSelectedItem({ ...feedback, type: 'feedback' }); setResponse(feedback.admin_response || ''); }}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          Respond
                        </Button>
                        <Select
                          value={feedback.status || 'Pending'}
                          onValueChange={(val) => handleStatusChange('feedback', feedback.id, val)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="In Progress">In Progress</SelectItem>
                            <SelectItem value="Responded">Responded</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Complaints Tab */}
          <TabsContent value="complaints" className="space-y-4">
            {filterItems(complaints).length === 0 ? (
              <Card className="border-0 shadow-lg">
                <CardContent className="py-12 text-center">
                  <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No complaints found</p>
                </CardContent>
              </Card>
            ) : (
              filterItems(complaints).map(complaint => (
                <Card key={complaint.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <Badge className={getStatusColor(complaint.status || 'Pending')}>
                            {complaint.status || 'Pending'}
                          </Badge>
                          <Badge className={getPriorityColor(complaint.priority)}>
                            {complaint.priority} Priority
                          </Badge>
                          <Badge className="bg-purple-100 text-purple-800">
                            {complaint.category}
                          </Badge>
                          {complaint.faculty_name && (
                            <Badge variant="outline">{complaint.faculty_name}</Badge>
                          )}
                        </div>

                        <h3 className="font-bold text-lg text-gray-900 mb-2">{complaint.title}</h3>
                        
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                          <User className="w-4 h-4" />
                          <span>{complaint.student_name}</span>
                          <span className="text-gray-300">|</span>
                          <Calendar className="w-4 h-4" />
                          <span>{format(new Date(complaint.created_date), 'PP')}</span>
                        </div>

                        <p className="text-gray-700 mb-3">{complaint.description}</p>

                        {complaint.admin_response && (
                          <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                            <p className="text-sm font-semibold text-green-800">Admin Response:</p>
                            <p className="text-sm text-green-700">{complaint.admin_response}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          onClick={() => { setSelectedItem({ ...complaint, type: 'complaint' }); setResponse(complaint.admin_response || ''); }}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Respond
                        </Button>
                        <Select
                          value={complaint.status || 'Pending'}
                          onValueChange={(val) => handleStatusChange('complaint', complaint.id, val)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="In Progress">In Progress</SelectItem>
                            <SelectItem value="Resolved">Resolved</SelectItem>
                            <SelectItem value="Rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>

        {/* Response Dialog */}
        <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                Respond to {selectedItem?.type === 'feedback' ? 'Feedback' : 'Complaint'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>From:</strong> {selectedItem?.student_name}
                </p>
                <p className="text-sm text-gray-700">
                  {selectedItem?.type === 'feedback' ? selectedItem?.comments : selectedItem?.description}
                </p>
              </div>
              <Textarea
                placeholder="Type your response..."
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                rows={4}
              />
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setSelectedItem(null)}>Cancel</Button>
                <Button
                  onClick={() => handleRespond(selectedItem?.type, selectedItem?.id)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Send Response
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}