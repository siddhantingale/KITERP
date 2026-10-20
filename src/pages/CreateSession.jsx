import React, { useState, useEffect } from "react";
import { Batch, Session, User, Faculty, Student, College } from "@/entities/all";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, ArrowLeft, Info, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useYearDivisions, refreshBatches } from "@/components/utils/useBatches";

// SCOPE LOCKED TO KIT KOLHAPUR - AIML ONLY
const COLLEGE_NAME = "KIT's College of Engineering, Kolhapur";
const BRANCH_NAME = "Artificial Intelligence & Machine Learning";

const durations = ["1 Hour", "1.5 Hours", "2 Hours", "2.5 Hours", "3 Hours"];

export default function CreateSession() {
  const navigate = useNavigate();
  const { years, divisions, getDivisionsForYear } = useYearDivisions();
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [colleges, setColleges] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [privateBatches, setPrivateBatches] = useState([]);
  const [customBatches, setCustomBatches] = useState([]);
  const [stats, setStats] = useState({ batches: 0, students: 0, faculty: 0 });
  const [batchType, setBatchType] = useState("standard");
  const [error, setError] = useState(null);
  const [availableDivisions, setAvailableDivisions] = useState([]);
  const [formData, setFormData] = useState({
    session_name: "",
    year: "",
    division: "",
    faculty_name: "",
    faculty_email: "",
    topic_taught: "",
    session_date: format(new Date(), 'yyyy-MM-dd'),
    session_time: "",
    duration: "1 Hour"
  });
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const currentUser = await User.me();
        if (currentUser.role === 'admin') {
          navigate(createPageUrl("Dashboard"));
          return;
        }
        setUser(currentUser);
        setIsAdmin(false);

        const facultyData = await api.entities.Faculty.filter({ status: 'active' });
        setFaculties(facultyData);

        // Auto-fill faculty info for non-admin users
        if (currentUser.role !== 'admin') {
          const userAsFaculty = facultyData.find(f => f.email === currentUser.email);
          if (userAsFaculty) {
            setFormData(prev => ({
              ...prev,
              faculty_name: userAsFaculty.name,
              faculty_email: userAsFaculty.email
            }));
          } else {
            setFormData(prev => ({
              ...prev,
              faculty_name: currentUser.full_name || '',
              faculty_email: currentUser.email
            }));
          }
        }



      } catch (e) {
        console.error("Failed to fetch initial data", e);
        setError("Failed to load initial data. Please refresh the page.");
      }
    }
    fetchData();
  }, []);

  const handleFacultyChange = (email) => {
    const selectedFaculty = faculties.find(f => f.email === email);
    if (selectedFaculty) {
      setFormData({
        ...formData,
        faculty_name: selectedFaculty.name,
        faculty_email: selectedFaculty.email,
      });
    } else {
      // Clear faculty details if nothing is selected or an invalid value
      setFormData({
        ...formData,
        faculty_name: "",
        faculty_email: "",
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      let batchId;
      let batchName;
      let batchDescription;
      let sessionCollege;
      let sessionYear;
      let sessionBranch;
      let sessionDivision;

      // CORE validation for session details
      if (!formData.session_name || !formData.topic_taught || !formData.faculty_email || !formData.session_date || !formData.session_time || !formData.year || !formData.division) {
        setError("Please fill in all required fields.");
        setIsLoading(false);
        return;
      }

      // SCOPE LOCKED TO KIT KOLHAPUR - AIML
      const collegeShortName = "KIT_KOLHAPUR";
      batchId = `${collegeShortName}_${formData.year}_AIML_${formData.division}`.toLowerCase().replace(/[^\w-]+/g, '-');
      batchName = `AIML - ${formData.division}`;
      batchDescription = `${formData.year} - AIML - ${formData.division}`;
      sessionCollege = COLLEGE_NAME;
      sessionYear = formData.year;
      sessionBranch = BRANCH_NAME;
      sessionDivision = formData.division;

      // Create batch if it doesn't exist
      const existingBatches = await api.entities.Batch.filter({ batch_id: batchId });
      if (existingBatches.length === 0) {
        await api.entities.Batch.create({
          batch_id: batchId,
          batch_name: batchName,
          batch_description: batchDescription,
          batch_type: 'standard',
          college_name: COLLEGE_NAME,
          year: formData.year,
          branch: BRANCH_NAME,
          division: formData.division,
          student_count: 0,
          created_by: user.email
        });
      }

      const sessionData = {
        session_name: formData.session_name,
        college_name: sessionCollege,
        year: sessionYear,
        branch: sessionBranch,
        division: sessionDivision,
        batch_description: batchDescription,
        faculty_name: formData.faculty_name,
        faculty_email: formData.faculty_email,
        topic_taught: formData.topic_taught,
        session_date: formData.session_date,
        session_time: formData.session_time,
        duration: formData.duration || "1 Hour", // Default duration if not set
        batch_id: batchId,
        status: "scheduled",
        total_students: 0,
        present_count: 0
      };

      await api.entities.Session.create(sessionData);
      refreshBatches(); // Trigger global sync
      navigate(createPageUrl("Dashboard"));
    } catch (err) {
      console.error("Error creating session:", err);
      setError(`Failed to create session: ${err.message || 'An unknown error occurred.'}`);
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-3 sm:p-4 md:p-6 lg:p-8 relative overflow-hidden safe-area-inset">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -right-20 w-64 sm:w-96 h-64 sm:h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-64 sm:w-96 h-64 sm:h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      </div>
      
      <div className="max-w-4xl mx-auto relative z-10">
         <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6 md:mb-8">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl("Dashboard"))}
            className="backdrop-blur-md bg-white/70 border-white/50 hover:bg-white/90 flex-shrink-0 h-9 w-9 sm:h-10 sm:w-10 touch-manipulation"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent leading-tight">Create New Session</h1>
            <p className="text-gray-700 text-sm sm:text-base mt-0.5 sm:mt-1">Schedule a new attendance session for your class</p>
          </div>
        </div>

        {user && (
            <Alert className="mb-6 backdrop-blur-xl bg-blue-50/80 border-blue-200/50">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                    Creating session for: <strong>KIT College, Kolhapur - AIML Department</strong>
                </AlertDescription>
            </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mb-6 backdrop-blur-xl bg-red-50/80 border-red-200/50">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="backdrop-blur-xl bg-white/70 border-white/50 shadow-xl sm:shadow-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-b border-white/30 px-4 py-4 sm:px-6 sm:py-5">
            <CardTitle className="text-base sm:text-lg md:text-xl flex items-center gap-2 sm:gap-3 text-gray-900">
              <CalendarIcon className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
              Session Details
            </CardTitle>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
              <div className="space-y-4 sm:space-y-6">
                <h3 className="text-base sm:text-lg font-semibold text-slate-700 pb-2 border-b">Session Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <Label htmlFor="session_name" className="font-semibold text-slate-700 text-sm sm:text-base">Session Name *</Label>
                    <Input id="session_name" placeholder="e.g., Database Management" value={formData.session_name} onChange={(e) => setFormData({...formData, session_name: e.target.value})} className="mt-1.5 sm:mt-2 h-10 sm:h-9 text-base sm:text-sm" required />
                  </div>
                  <div>
                    <Label htmlFor="topic_taught" className="font-semibold text-slate-700 text-sm sm:text-base">Topic to be Taught *</Label>
                    <Input id="topic_taught" placeholder="e.g., SQL Queries" value={formData.topic_taught} onChange={(e) => setFormData({...formData, topic_taught: e.target.value})} className="mt-1.5 sm:mt-2 h-10 sm:h-9 text-base sm:text-sm" required />
                  </div>
                </div>
              </div>

              <div className="space-y-4 sm:space-y-6">
                <h3 className="text-base sm:text-lg font-semibold text-slate-700 pb-2 border-b">Class Information</h3>
                
                <div className="p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs sm:text-sm font-semibold text-blue-900">🏛️ College: KIT's College of Engineering, Kolhapur</p>
                  <p className="text-xs sm:text-sm font-semibold text-blue-900 mt-1">🔬 Department: Artificial Intelligence & Machine Learning (AIML)</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <Label htmlFor="year" className="font-semibold text-slate-700 text-sm sm:text-base">Academic Year *</Label>
                    <Select 
                      value={formData.year} 
                      onValueChange={(value) => {
                        setFormData({...formData, year: value, division: ""});
                        setAvailableDivisions(getDivisionsForYear(value));
                      }} 
                      required
                    >
                      <SelectTrigger className="mt-1.5 sm:mt-2 h-10 sm:h-9"><SelectValue placeholder="Select year" /></SelectTrigger>
                      <SelectContent>
                        {years.length > 0 ? years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>) : (
                          <SelectItem value="no-data" disabled>No years available</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="division" className="font-semibold text-slate-700 text-sm sm:text-base">Division *</Label>
                    <Select value={formData.division} onValueChange={(value) => setFormData({...formData, division: value})} required>
                      <SelectTrigger className="mt-1.5 sm:mt-2 h-10 sm:h-9"><SelectValue placeholder="Select division" /></SelectTrigger>
                      <SelectContent>
                        {(formData.year ? availableDivisions : divisions).length > 0 ? 
                          (formData.year ? availableDivisions : divisions).map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>) : (
                          <SelectItem value="no-data" disabled>{formData.year ? 'No divisions for selected year' : 'Select year first'}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-4 sm:space-y-6">
                <h3 className="text-base sm:text-lg font-semibold text-slate-700 pb-2 border-b">Faculty & Schedule</h3>
                <div>
                  <Label htmlFor="faculty_name" className="font-semibold text-slate-700 text-sm sm:text-base">Faculty *</Label>
                  {isAdmin ? (
                    <Select value={formData.faculty_email} onValueChange={handleFacultyChange} required>
                      <SelectTrigger className="mt-1.5 sm:mt-2 h-10 sm:h-9"><SelectValue placeholder="Select faculty" /></SelectTrigger>
                      <SelectContent>
                        {faculties.map((f) => (
                          <SelectItem key={f.id} value={f.email}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="mt-1.5 sm:mt-2 p-2.5 sm:p-3 bg-gray-100 rounded-lg border">
                      <p className="font-semibold text-gray-900 text-sm sm:text-base">{formData.faculty_name}</p>
                      <p className="text-xs sm:text-sm text-gray-600">{formData.faculty_email}</p>
                    </div>
                  )}
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                  <div>
                    <Label htmlFor="session_date" className="font-semibold text-slate-700 text-sm sm:text-base">Session Date *</Label>
                    <Input id="session_date" type="date" value={formData.session_date} onChange={(e) => setFormData({...formData, session_date: e.target.value})} className="mt-1.5 sm:mt-2 h-10 sm:h-9 text-base sm:text-sm" required />
                  </div>
                  <div>
                    <Label htmlFor="session_time" className="font-semibold text-slate-700 text-sm sm:text-base">Session Time *</Label>
                    <Input id="session_time" type="time" value={formData.session_time} onChange={(e) => setFormData({...formData, session_time: e.target.value})} className="mt-1.5 sm:mt-2 h-10 sm:h-9 text-base sm:text-sm" required />
                  </div>
                  <div>
                    <Label htmlFor="duration" className="font-semibold text-slate-700 text-sm sm:text-base">Duration *</Label>
                    <Select value={formData.duration} onValueChange={(value) => setFormData({...formData, duration: value})}>
                      <SelectTrigger className="mt-1.5 sm:mt-2 h-10 sm:h-9"><SelectValue placeholder="Select duration" /></SelectTrigger>
                      <SelectContent>{durations.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 pt-4 sm:pt-6 border-t">
                <Button type="button" variant="outline" onClick={() => navigate(createPageUrl("Dashboard"))} className="w-full sm:w-auto px-6 sm:px-8 backdrop-blur-md bg-white/70 h-10 sm:h-9 order-2 sm:order-1 touch-manipulation">Cancel</Button>
                <Button type="submit" disabled={isLoading} className="w-full sm:w-auto px-6 sm:px-8 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 h-10 sm:h-9 order-1 sm:order-2 touch-manipulation">
                  {isLoading ? 'Creating...' : 'Create Session'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
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