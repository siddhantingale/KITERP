import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, User, Mail, Hash, GraduationCap, Calendar } from "lucide-react";

export default function StudentProfile({ student, user, onLogout }) {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
        <Button 
          onClick={onLogout}
          variant="destructive"
          className="bg-red-600 hover:bg-red-700"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>

      <Card className="shadow-xl border-0 bg-gradient-to-br from-white to-blue-50">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
              <span className="text-3xl font-bold text-blue-600">
                {student.name.trim().charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <CardTitle className="text-2xl">{student.name.trim() || (user.email ? user.email.split('@')[0] : 'Student')}</CardTitle>
              <p className="text-blue-100 text-sm">Student Profile</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm">
              <User className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-xs text-gray-500">Full Name</p>
                <p className="font-semibold text-gray-900">{student.name.trim() || (user.email ? user.email.split('@')[0] : 'Student')}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm">
              <Mail className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="font-semibold text-gray-900">{student.email || user.email}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm">
              <Hash className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-xs text-gray-500">Roll Number</p>
                <p className="font-semibold text-gray-900">{student.roll_no}</p>
              </div>
            </div>
            
            {student.prn && (
              <div className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm">
                <GraduationCap className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-xs text-gray-500">PRN</p>
                  <p className="font-semibold text-gray-900">{student.prn}</p>
                </div>
              </div>
            )}
            
            {student.year && (
              <div className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm">
                <Calendar className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-xs text-gray-500">Year</p>
                  <p className="font-semibold text-gray-900">{student.year}</p>
                </div>
              </div>
            )}
            
            {student.branch && (
              <div className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm">
                <GraduationCap className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-xs text-gray-500">Branch</p>
                  <p className="font-semibold text-gray-900">{student.branch}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}