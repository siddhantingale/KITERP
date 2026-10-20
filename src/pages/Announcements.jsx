import React, { useState, useEffect } from "react";
import { Announcement, Batch, User, Student } from "@/entities/all";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Megaphone, Plus, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { sendPushNotification } from "@/components/notifications/PushNotificationManager";

const priorities = ["Low", "Medium", "High", "Urgent"];
const categories = ["General", "Assessment", "Timetable", "Event", "Holiday", "Other"];

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([]);
  const [batches, setBatches] = useState([]);
  const [user, setUser] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [message, setMessage] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    recipient_type: "All",
    batch_id: "",
    priority: "Medium",
    category: "General"
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [currentUser, announcementData, batchData] = await Promise.all([
        User.me(),
        Announcement.list("-created_date", 100),
        Batch.list()
      ]);
      setUser(currentUser);
      setAnnouncements(announcementData);
      setBatches(batchData);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const announcement = await Announcement.create({
        ...formData,
        sender_name: user.full_name,
        sender_email: user.email,
        announcement_date: new Date().toISOString()
      });

      // Create notifications for recipients
      let recipients = [];
      
      if (formData.recipient_type === "Batch" && formData.batch_id) {
        // Get all students in the batch
        const students = await Student.filter({ batch_id: formData.batch_id });
        recipients = students.map(s => ({
          student_id: s.id,
          batch_id: s.batch_id
        }));
      } else if (formData.recipient_type === "Students" || formData.recipient_type === "All") {
        // Get all students
        const students = await Student.list();
        recipients = students.map(s => ({
          student_id: s.id,
          batch_id: s.batch_id
        }));
      }

      // Create notifications for all recipients
      if (recipients.length > 0) {
        // Get student emails for push notifications
        const students = formData.recipient_type === "Batch" && formData.batch_id
          ? await Student.filter({ batch_id: formData.batch_id })
          : await Student.list();
        
        const studentEmails = students.map(s => s.email).filter(Boolean);

        // Create in-app notifications
        await Promise.all(recipients.map(recipient =>
          api.entities.StudentNotification.create({
            student_id: recipient.student_id,
            student_email: students.find(s => s.id === recipient.student_id)?.email,
            batch_id: recipient.batch_id,
            title: announcement.title,
            message: announcement.message,
            category: announcement.category,
            priority: announcement.priority,
            is_read: false
          })
        ));

        // Send push notifications to all students
        await sendPushNotification({
          title: `${formData.priority === 'Urgent' ? '🚨 URGENT: ' : '📢 '}${announcement.title}`,
          body: announcement.message.substring(0, 200),
          targetEmails: studentEmails,
          data: { 
            type: 'announcement', 
            priority: formData.priority,
            category: formData.category 
          }
        });
      }
      
      setMessage({ type: "success", text: `Announcement sent to ${recipients.length} students with push notifications!` });
      await loadData();
      resetForm();
      setShowAddModal(false);
    } catch (error) {
      console.error("Error sending announcement:", error);
      setMessage({ type: "error", text: "Failed to send announcement" });
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      message: "",
      recipient_type: "All",
      batch_id: "",
      priority: "Medium",
      category: "General"
    });
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case "Urgent": return "bg-red-100 text-red-800";
      case "High": return "bg-orange-100 text-orange-800";
      case "Medium": return "bg-yellow-100 text-yellow-800";
      default: return "bg-blue-100 text-blue-800";
    }
  };

  const getCategoryColor = (category) => {
    switch(category) {
      case "Assessment": return "bg-purple-100 text-purple-800";
      case "Timetable": return "bg-green-100 text-green-800";
      case "Event": return "bg-pink-100 text-pink-800";
      case "Holiday": return "bg-cyan-100 text-cyan-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 sm:p-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -right-40 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-20 -left-40 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      </div>
      
      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        <div className="backdrop-blur-xl bg-white/60 rounded-3xl border border-white/50 shadow-2xl p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2 sm:gap-3">
                <Megaphone className="w-6 sm:w-8 h-6 sm:h-8 text-blue-600" />
                Announcements
              </h1>
              <p className="text-gray-700 text-sm sm:text-base">Broadcast messages to students and faculty</p>
            </div>
            {user && user.role === "admin" && (
            <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg gap-2 w-full sm:w-auto">
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">New Announcement</span>
                  <span className="sm:hidden">New</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Announcement</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>Title *</Label>
                    <Input value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} required />
                  </div>
                  <div>
                    <Label>Message *</Label>
                    <Textarea rows={5} value={formData.message} onChange={(e) => setFormData({...formData, message: e.target.value})} required />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Recipient Type *</Label>
                      <Select value={formData.recipient_type} onValueChange={(value) => setFormData({...formData, recipient_type: value, batch_id: ""})}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="All">Everyone</SelectItem>
                          <SelectItem value="Students">All Students</SelectItem>
                          <SelectItem value="Faculty">All Faculty</SelectItem>
                          <SelectItem value="Batch">Specific Batch</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.recipient_type === "Batch" && (
                      <div>
                        <Label>Select Batch *</Label>
                        <Select value={formData.batch_id} onValueChange={(value) => setFormData({...formData, batch_id: value})}>
                          <SelectTrigger><SelectValue placeholder="Select batch"/></SelectTrigger>
                          <SelectContent>
                            {batches.map(b => (
                              <SelectItem key={b.id} value={b.batch_id}>{b.batch_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Priority *</Label>
                      <Select value={formData.priority} onValueChange={(value) => setFormData({...formData, priority: value})}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                          {priorities.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Category *</Label>
                      <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value})}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                          {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
                    <Button type="submit" className="bg-blue-600">Send Announcement</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            )}
          </div>
        </div>

        {message && (
          <Alert className={message.type === "error" ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}>
            <AlertDescription className={message.type === "error" ? "text-red-800" : "text-green-800"}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {announcements.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Megaphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No announcements yet</p>
              </CardContent>
            </Card>
          ) : (
            <>
            {announcements.slice(0, showAll ? announcements.length : 3).map(announcement => (
              <div key={announcement.id} className="backdrop-blur-xl bg-white/70 rounded-2xl border border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getPriorityColor(announcement.priority)}>{announcement.priority}</Badge>
                        <Badge className={getCategoryColor(announcement.category)}>{announcement.category}</Badge>
                        <Badge variant="outline">{announcement.recipient_type}</Badge>
                      </div>
                      <CardTitle className="text-xl">{announcement.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 mb-4 whitespace-pre-wrap">{announcement.message}</p>
                  <div className="flex justify-between items-center text-sm text-gray-500">
                    <span>From: {announcement.sender_name}</span>
                    <span>{format(new Date(announcement.announcement_date), "MMM d, yyyy h:mm a")}</span>
                  </div>
                  {announcement.recipient_type === "Batch" && announcement.batch_id && (
                    <p className="text-sm text-gray-500 mt-2">
                      Batch: {batches.find(b => b.batch_id === announcement.batch_id)?.batch_name || announcement.batch_id}
                    </p>
                  )}
                </CardContent>
              </div>
            ))}
            {announcements.length > 3 && (
              <div className="text-center pt-4">
                <Button 
                  onClick={() => setShowAll(!showAll)} 
                  variant="outline"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 border-0"
                >
                  {showAll ? "Show Less" : `Show More (${announcements.length - 3} more)`}
                </Button>
              </div>
            )}
            </>
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