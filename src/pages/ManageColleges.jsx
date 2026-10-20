import React, { useState, useEffect, useCallback } from "react";
import { College } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2, Building2 } from "lucide-react";
import CollegeFormModal from "../components/colleges/CollegeFormModal";
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

export default function ManageColleges() {
  const [colleges, setColleges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCollege, setEditingCollege] = useState(null);

  const fetchColleges = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await College.list("-created_date");
      setColleges(data);
    } catch (error) {
      console.error("Error fetching colleges:", error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchColleges();
  }, [fetchColleges]);

  const handleSave = async (data) => {
    try {
      if (editingCollege) {
        await College.update(editingCollege.id, data);
      } else {
        await College.create(data);
      }
      fetchColleges();
      setIsModalOpen(false);
      setEditingCollege(null);
    } catch (error) {
      console.error("Error saving college:", error);
    }
  };

  const handleEdit = (college) => {
    setEditingCollege(college);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      await College.delete(id);
      fetchColleges();
    } catch (error) {
      console.error("Error deleting college:", error);
    }
  };

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Manage Colleges</h1>
          <Button onClick={() => { setEditingCollege(null); setIsModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Add New College
          </Button>
        </div>

        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5" /> College List ({colleges.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>College Name</TableHead>
                    <TableHead>Short Name</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {colleges.map((college) => (
                    <TableRow key={college.id}>
                      <TableCell className="font-medium">{college.college_name}</TableCell>
                      <TableCell>{college.short_name}</TableCell>
                      <TableCell>{college.city}</TableCell>
                      <TableCell>{college.state}</TableCell>
                      <TableCell className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={() => handleEdit(college)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the college.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(college.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <CollegeFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        college={editingCollege}
      />
    </div>
  );
}