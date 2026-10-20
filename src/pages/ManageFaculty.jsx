import React, { useState, useEffect, useCallback } from "react";
import { Faculty } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Trash2, UserCog, Mail, Building, Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import FacultyFormModal from "../components/faculty/FacultyFormModal";
import FacultySessionsTab from "../components/faculty/FacultySessionsTab";
import FacultyExpensesTab from "../components/faculty/FacultyExpensesTab";
import FacultyInvoicesTab from "../components/faculty/FacultyInvoicesTab";
import FacultySummaryTab from "../components/faculty/FacultySummaryTab";
import SubjectAllotmentTab from "../components/faculty/SubjectAllotmentTab";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function ManageFaculty() {
  const [faculty, setFaculty] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState(null);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const fetchFaculty = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await Faculty.list("-created_date");
      setFaculty(data);
    } catch (error) {
      console.error("Error fetching faculty:", error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchFaculty();
  }, [fetchFaculty]);

  const handleSave = async (data) => {
    try {
      if (editingFaculty) {
        await Faculty.update(editingFaculty.id, data);
      } else {
        await Faculty.create(data);
      }
      fetchFaculty();
      setIsModalOpen(false);
      setEditingFaculty(null);
    } catch (error) {
      console.error("Error saving faculty:", error);
    }
  };

  const handleEdit = (facultyMember) => {
    setEditingFaculty(facultyMember);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      await Faculty.delete(id);
      fetchFaculty();
    } catch (error) {
      console.error("Error deleting faculty:", error);
    }
  };

  const handleToggleStatus = async (facultyMember) => {
    try {
      const newStatus = facultyMember.status === 'active' ? 'inactive' : 'active';
      await Faculty.update(facultyMember.id, {
        status: newStatus
      });
      fetchFaculty();
    } catch (error) {
      console.error("Error toggling faculty status:", error);
    }
  };

  const handleViewDetails = (facultyMember) => {
    setSelectedFaculty(facultyMember);
    setIsDetailsModalOpen(true);
  };

  const filteredFaculty = faculty.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayedFaculty = showAll ? filteredFaculty : filteredFaculty.slice(0, 5);

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Faculty Management</h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">Manage AIML department faculty members</p>
          </div>
          <Button 
            onClick={() => { setEditingFaculty(null); setIsModalOpen(true); }}
            className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" /> 
            Add New Faculty
          </Button>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search faculty by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-base"
            />
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => (
              <Card key={i} className="bg-white shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-28" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="h-8 w-16" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : faculty.length === 0 ? (
            <div className="text-center py-12">
              <UserCog className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Faculty Members</h3>
              <p className="text-gray-600 mb-4">Get started by adding your first faculty member</p>
              <Button onClick={() => setIsModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Faculty Member
              </Button>
            </div>
          ) : (
            <>
            {displayedFaculty.map((facultyMember) => (
              <Card 
                key={facultyMember.id} 
                className="bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleViewDetails(facultyMember)}
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center space-x-3 sm:space-x-4 w-full sm:w-auto">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <UserCog className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {facultyMember.name}
                          </h3>
                          <Badge 
                            className={`${
                              facultyMember.status === 'active' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {facultyMember.status}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="w-4 h-4" />
                            <span>{facultyMember.email}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Building className="w-4 h-4" />
                            <span>AIML Department</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto" onClick={(e) => e.stopPropagation()}>
                      {/* Activate/Deactivate Button */}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleToggleStatus(facultyMember)}
                        className={`w-full sm:w-auto ${
                          facultyMember.status === 'active' 
                            ? 'border-orange-200 text-orange-600 hover:bg-orange-50' 
                            : 'border-green-200 text-green-600 hover:bg-green-50'
                        }`}
                      >
                        <span className="hidden sm:inline">{facultyMember.status === 'active' ? '🔒 Deactivate' : '✅ Activate'}</span>
                        <span className="sm:hidden">{facultyMember.status === 'active' ? '🔒' : '✅'}</span>
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleEdit(facultyMember)}
                        className="border-blue-200 text-blue-600 hover:bg-blue-50 w-full sm:w-auto"
                      >
                        <Edit className="w-4 h-4 sm:mr-1" />
                        <span className="hidden sm:inline">Edit</span>
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="border-red-200 text-red-600 hover:bg-red-50 w-full sm:w-auto">
                            <Trash2 className="w-4 h-4 sm:mr-1" />
                            <span className="hidden sm:inline">Delete</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Faculty Member?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete <strong>{facultyMember.name}</strong> from the system. 
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDelete(facultyMember.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {/* Show More/Less Button */}
            {filteredFaculty.length > 5 && (
              <div className="text-center pt-4">
                <Button
                  onClick={() => setShowAll(!showAll)}
                  variant="outline"
                  className="w-full md:w-auto px-8"
                >
                  {showAll ? `Show Less` : `Show More (${filteredFaculty.length - 5} more)`}
                </Button>
              </div>
            )}
            </>
          )}
        </div>
      </div>

      <FacultyFormModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingFaculty(null); }}
        onSave={handleSave}
        facultyMember={editingFaculty}
      />

      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              {selectedFaculty?.name} - Faculty Management Portal
            </DialogTitle>
          </DialogHeader>

          {selectedFaculty && (
            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="subjects">Subject Allotment</TabsTrigger>
                <TabsTrigger value="sessions">Sessions</TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Faculty Profile</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Name</p>
                        <p className="font-semibold">{selectedFaculty.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Email</p>
                        <p className="font-semibold">{selectedFaculty.email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Department</p>
                        <p className="font-semibold">AIML</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Status</p>
                        <span className={`px-3 py-1 rounded-full text-sm ${selectedFaculty.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {selectedFaculty.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => handleToggleStatus(selectedFaculty)}
                        className={`${
                          selectedFaculty.status === 'active' 
                            ? 'bg-orange-600 hover:bg-orange-700' 
                            : 'bg-green-600 hover:bg-green-700'
                        }`}
                      >
                        {selectedFaculty.status === 'active' ? '🔒 Deactivate Account' : '✅ Activate Account'}
                      </Button>
                      <Button 
                        onClick={() => { setIsDetailsModalOpen(false); handleEdit(selectedFaculty); }}
                        variant="outline"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Profile
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="subjects" className="mt-6">
                <SubjectAllotmentTab faculty={selectedFaculty} onUpdate={fetchFaculty} />
              </TabsContent>

              <TabsContent value="sessions" className="mt-6">
                <FacultySessionsTab faculty={selectedFaculty} />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}