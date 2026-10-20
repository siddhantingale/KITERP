import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function SessionForm({ batch, students, onSessionCreate, onBack, isLoading }) {
  const [sessionData, setSessionData] = useState({
    session_name: "",
    college_name: batch.college_name,
    year: batch.year,
    branch: batch.branch,
    time_slot: "",
    session_date: format(new Date(), 'yyyy-MM-dd')
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (sessionData.session_name && sessionData.time_slot) {
      onSessionCreate(sessionData);
    }
  };

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-3">
          <Calendar className="w-7 h-7 text-blue-600" />
          Create Attendance Session
        </CardTitle>
        <div className="text-sm text-slate-600 space-y-1">
          <p><strong>Batch:</strong> {batch.college_name}</p>
          <p><strong>Class:</strong> {batch.year} - {batch.branch}</p>
          <p><strong>Students:</strong> {students.length}</p>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="session_name">Session Name</Label>
            <Input
              id="session_name"
              placeholder="e.g., Programming Class, Database Lecture"
              value={sessionData.session_name}
              onChange={(e) => setSessionData({...sessionData, session_name: e.target.value})}
              className="mt-2"
              required
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="session_date">Session Date</Label>
              <Input
                id="session_date"
                type="date"
                value={sessionData.session_date}
                onChange={(e) => setSessionData({...sessionData, session_date: e.target.value})}
                className="mt-2"
                required
              />
            </div>

            <div>
              <Label htmlFor="time_slot">Time Slot</Label>
              <Input
                id="time_slot"
                placeholder="e.g., 9:00 AM - 10:00 AM"
                value={sessionData.time_slot}
                onChange={(e) => setSessionData({...sessionData, time_slot: e.target.value})}
                className="mt-2"
                required
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="button" variant="outline" onClick={onBack} className="flex-1">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Batches
            </Button>
            <Button 
              type="submit"
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              disabled={isLoading || !sessionData.session_name || !sessionData.time_slot}
            >
              {isLoading ? "Creating..." : "Start Taking Attendance"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}