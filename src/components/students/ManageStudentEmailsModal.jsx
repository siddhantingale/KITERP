import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Upload } from "lucide-react";
import { api } from "@/api/client";

export default function ManageStudentEmailsModal({ isOpen, onClose, students, onUpdate }) {
  const [bulkEmails, setBulkEmails] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState(null);

  const handleBulkUpdate = async () => {
    setIsProcessing(true);
    setMessage(null);
    try {
      const lines = bulkEmails.split('\n').filter(line => line.trim());
      let updated = 0;
      
      for (const line of lines) {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length < 2) continue;
        
        const [identifier, email] = parts;
        const student = students.find(s => 
          s.roll_no?.toLowerCase() === identifier.toLowerCase() || 
          s.name?.toLowerCase() === identifier.toLowerCase()
        );
        
        if (student && email.includes('@')) {
          await api.entities.Student.update(student.id, { email });
          updated++;
        }
      }
      
      setMessage({ type: "success", text: `Updated ${updated} student emails` });
      setTimeout(() => {
        onUpdate();
        onClose();
      }, 1500);
    } catch (error) {
      console.error("Error updating emails:", error);
      setMessage({ type: "error", text: "Failed to update emails" });
    }
    setIsProcessing(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Manage Student Emails
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div>
            <Label>Bulk Email Assignment</Label>
            <p className="text-sm text-gray-600 mb-2">
              Enter one student per line in format: <code className="bg-gray-100 px-1">RollNumber/Name, email@example.com</code>
            </p>
            <Textarea
              rows={10}
              placeholder="Example:
101, student1@gmail.com
John Doe, john@gmail.com
102, student2@gmail.com"
              value={bulkEmails}
              onChange={(e) => setBulkEmails(e.target.value)}
            />
          </div>

          {message && (
            <div className={`p-3 rounded ${message.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
              {message.text}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={isProcessing}>
              Cancel
            </Button>
            <Button 
              onClick={handleBulkUpdate} 
              disabled={isProcessing || !bulkEmails.trim()}
              className="bg-blue-600"
            >
              <Upload className="w-4 h-4 mr-2" />
              {isProcessing ? "Updating..." : "Update Emails"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}