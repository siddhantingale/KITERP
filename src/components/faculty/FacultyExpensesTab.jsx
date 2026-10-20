import React, { useState, useEffect } from "react";
import { FacultyExpense } from "@/entities/all";
import { UploadFile } from "@/integrations/Core";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Edit, Trash2, Receipt, Upload } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function FacultyExpensesTab({ faculty }) {
  const [expenses, setExpenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    expense_date: "",
    expense_type: "Travel",
    amount: 0,
    description: "",
    receipt_url: ""
  });

  useEffect(() => {
    loadExpenses();
  }, [faculty.id]);

  const loadExpenses = async () => {
    setIsLoading(true);
    try {
      const data = await FacultyExpense.filter({ faculty_id: faculty.id }, "-expense_date");
      setExpenses(data);
    } catch (error) {
      console.error("Error loading expenses:", error);
    }
    setIsLoading(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await UploadFile({ file });
      setFormData({ ...formData, receipt_url: file_url });
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Failed to upload receipt");
    }
    setUploading(false);
  };

  const handleSubmit = async () => {
    try {
      const expenseData = {
        ...formData,
        faculty_id: faculty.id,
        faculty_email: faculty.email
      };

      if (editingExpense) {
        await FacultyExpense.update(editingExpense.id, expenseData);
      } else {
        await FacultyExpense.create(expenseData);
      }

      loadExpenses();
      handleCloseModal();
    } catch (error) {
      console.error("Error saving expense:", error);
      alert("Failed to save expense");
    }
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setFormData({
      expense_date: expense.expense_date,
      expense_type: expense.expense_type,
      amount: expense.amount,
      description: expense.description || "",
      receipt_url: expense.receipt_url || ""
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (expenseId) => {
    if (!confirm("Delete this expense?")) return;
    try {
      await FacultyExpense.delete(expenseId);
      loadExpenses();
    } catch (error) {
      console.error("Error deleting expense:", error);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingExpense(null);
    setFormData({
      expense_date: "",
      expense_type: "Travel",
      amount: 0,
      description: "",
      receipt_url: ""
    });
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const expensesByType = expenses.reduce((acc, exp) => {
    acc[exp.expense_type] = (acc[exp.expense_type] || 0) + exp.amount;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold">Expenses</h3>
          <p className="text-sm text-gray-600">Total: <span className="font-bold text-green-600">₹{totalExpenses.toFixed(2)}</span></p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="bg-green-600 hover:bg-green-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Expense
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {Object.entries(expensesByType).map(([type, amount]) => (
          <Card key={type}>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-gray-600">{type}</p>
              <p className="text-2xl font-bold text-green-600">₹{amount.toFixed(0)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4">
        {expenses.map((expense) => (
          <Card key={expense.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Receipt className="w-4 h-4 text-green-600" />
                    <h4 className="font-semibold">{expense.expense_type}</h4>
                    <span className="text-xl font-bold text-green-600">₹{expense.amount}</span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>📅 {format(new Date(expense.expense_date), "dd MMM yyyy")}</p>
                    {expense.description && <p className="italic">"{expense.description}"</p>}
                    {expense.receipt_url && (
                      <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                        <Receipt className="w-3 h-3" />
                        View Receipt
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => handleEdit(expense)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDelete(expense.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {expenses.length === 0 && !isLoading && (
          <Card>
            <CardContent className="text-center py-12">
              <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No expenses recorded yet</p>
              <Button onClick={() => setIsModalOpen(true)} className="mt-4">Add First Expense</Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={handleCloseModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Edit Expense" : "Add New Expense"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Expense Date *</Label>
              <Input
                type="date"
                value={formData.expense_date}
                onChange={(e) => setFormData({...formData, expense_date: e.target.value})}
              />
            </div>
            <div>
              <Label>Expense Type *</Label>
              <Select value={formData.expense_type} onValueChange={(value) => setFormData({...formData, expense_type: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Travel">Travel</SelectItem>
                  <SelectItem value="Food">Food</SelectItem>
                  <SelectItem value="Hotel/Lounge">Hotel/Lounge</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (₹) *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value) || 0})}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Details about this expense..."
                rows={3}
              />
            </div>
            <div>
              <Label>Receipt (Optional)</Label>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="flex-1"
                />
                {formData.receipt_url && (
                  <Button variant="outline" size="icon" onClick={() => window.open(formData.receipt_url, '_blank')}>
                    <Receipt className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {uploading && <p className="text-sm text-gray-500 mt-1">Uploading...</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>Cancel</Button>
            <Button onClick={handleSubmit}>
              {editingExpense ? "Update Expense" : "Add Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}