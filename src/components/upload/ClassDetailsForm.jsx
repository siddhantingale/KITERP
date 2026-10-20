import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight } from "lucide-react";

const years = ["First Year", "Second Year", "Third Year", "Fourth Year"];
const branches = ["Computer Science", "Information Technology", "Electronics", "Mechanical", "Civil", "Electrical"];

export default function ClassDetailsForm({ onSubmit, onBack }) {
  const [formData, setFormData] = useState({
    college_name: "APT-TECH CRT Solutions",
    year: "",
    branch: "",
    time_slot: ""
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.year && formData.branch && formData.time_slot) {
      onSubmit(formData);
    }
  };

  return (
    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-2xl text-center">Class Details</CardTitle>
        <p className="text-slate-600 text-center">
          Provide information about the class for these students
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="college_name">College Name</Label>
            <Input
              id="college_name"
              value={formData.college_name}
              onChange={(e) => setFormData({...formData, college_name: e.target.value})}
              className="mt-2"
              required
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="year">Academic Year</Label>
              <Select
                value={formData.year}
                onValueChange={(value) => setFormData({...formData, year: value})}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="branch">Branch/Department</Label>
              <Select
                value={formData.branch}
                onValueChange={(value) => setFormData({...formData, branch: value})}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="time_slot">Time Slot</Label>
            <Input
              id="time_slot"
              placeholder="e.g., 9:00 AM - 10:00 AM"
              value={formData.time_slot}
              onChange={(e) => setFormData({...formData, time_slot: e.target.value})}
              className="mt-2"
              required
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="button" variant="outline" onClick={onBack} className="flex-1">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button 
              type="submit"
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              disabled={!formData.year || !formData.branch || !formData.time_slot}
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}