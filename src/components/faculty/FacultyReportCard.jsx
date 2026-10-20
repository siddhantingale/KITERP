import React, { useState, useEffect } from "react";
import { FacultySession, FacultyExpense, FacultyInvoice, Faculty } from "@/entities/all";
import { generateFacultyInvoice } from "@/functions/generateFacultyInvoice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Receipt, DollarSign, FileText, Edit, Plus, Download, Trash2 } from "lucide-react";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function FacultyReportCard({ faculty, onUpdate }) {
  const [sessions, setSessions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [generating, setGenerating] = useState(false);

  const [facultyData, setFacultyData] = useState({
    name: faculty.name,
    rate_per_hour: faculty.rate_per_hour || 0
  });

  const [sessionForm, setSessionForm] = useState({
    session_title: "",
    subject_module: "",
    batch_class: "",
    session_date: "",
    start_time: "",
    end_time: "",
    total_hours: 0,
    mode: "Offline",
    remarks: ""
  });

  const [expenseForm, setExpenseForm] = useState({
    expense_date: "",
    expense_type: "Travel",
    amount: 0,
    description: ""
  });

  const [invoiceForm, setInvoiceForm] = useState({
    billing_period_start: "",
    billing_period_end: "",
    remarks: ""
  });

  useEffect(() => {
    if (expanded) {
      loadData();
    }
  }, [expanded, faculty.id]);

  const loadData = async () => {
    try {
      const [sessionsData, expensesData, invoicesData] = await Promise.all([
        FacultySession.filter({ faculty_id: faculty.id }),
        FacultyExpense.filter({ faculty_id: faculty.id }),
        FacultyInvoice.filter({ faculty_id: faculty.id })
      ]);
      setSessions(sessionsData);
      setExpenses(expensesData);
      setInvoices(invoicesData);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const handleUpdateFaculty = async () => {
    try {
      await Faculty.update(faculty.id, { rate_per_hour: facultyData.rate_per_hour });
      setIsEditModalOpen(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error updating faculty:", error);
    }
  };

  const calculateHours = (start, end) => {
    if (!start || !end) return 0;
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    return Math.max(0, (endHour * 60 + endMin - startHour * 60 - startMin) / 60);
  };

  const handleTimeChange = (field, value) => {
    const newForm = { ...sessionForm, [field]: value };
    if (newForm.start_time && newForm.end_time) {
      newForm.total_hours = calculateHours(newForm.start_time, newForm.end_time);
    }
    setSessionForm(newForm);
  };

  const handleSaveSession = async () => {
    try {
      const sessionData = { ...sessionForm, faculty_id: faculty.id, faculty_email: faculty.email };
      if (editingSession) {
        await FacultySession.update(editingSession.id, sessionData);
      } else {
        await FacultySession.create(sessionData);
      }
      loadData();
      setIsSessionModalOpen(false);
      setEditingSession(null);
      setSessionForm({ session_title: "", subject_module: "", batch_class: "", session_date: "", start_time: "", end_time: "", total_hours: 0, mode: "Offline", remarks: "" });
    } catch (error) {
      console.error("Error saving session:", error);
    }
  };

  const handleSaveExpense = async () => {
    try {
      const expenseData = { ...expenseForm, faculty_id: faculty.id, faculty_email: faculty.email };
      if (editingExpense) {
        await FacultyExpense.update(editingExpense.id, expenseData);
      } else {
        await FacultyExpense.create(expenseData);
      }
      loadData();
      setIsExpenseModalOpen(false);
      setEditingExpense(null);
      setExpenseForm({ expense_date: "", expense_type: "Travel", amount: 0, description: "" });
    } catch (error) {
      console.error("Error saving expense:", error);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (!confirm("Delete this session?")) return;
    try {
      await FacultySession.delete(sessionId);
      loadData();
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!confirm("Delete this expense?")) return;
    try {
      await FacultyExpense.delete(expenseId);
      loadData();
    } catch (error) {
      console.error("Error deleting expense:", error);
    }
  };

  const handleGenerateInvoice = async () => {
    if (!invoiceForm.billing_period_start || !invoiceForm.billing_period_end) {
      alert("Please select billing period");
      return;
    }

    setGenerating(true);
    try {
      const periodSessions = sessions.filter(s => 
        s.session_date >= invoiceForm.billing_period_start && 
        s.session_date <= invoiceForm.billing_period_end
      );
      const periodExpenses = expenses.filter(e => 
        e.expense_date >= invoiceForm.billing_period_start && 
        e.expense_date <= invoiceForm.billing_period_end
      );

      const totalHours = periodSessions.reduce((sum, s) => sum + (s.total_hours || 0), 0);
      const totalExpenses = periodExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const ratePerHour = facultyData.rate_per_hour || 0;
      const subtotal = totalHours * ratePerHour;
      const grandTotal = subtotal + totalExpenses;

      const invoiceNumber = `INV-${faculty.email.split('@')[0].toUpperCase()}-${Date.now()}`;

      const invoiceData = {
        faculty_id: faculty.id,
        faculty_email: faculty.email,
        invoice_number: invoiceNumber,
        billing_period_start: invoiceForm.billing_period_start,
        billing_period_end: invoiceForm.billing_period_end,
        total_hours: totalHours,
        rate_per_hour: ratePerHour,
        subtotal: subtotal,
        total_expenses: totalExpenses,
        grand_total: grandTotal,
        status: "Generated",
        remarks: invoiceForm.remarks
      };

      const newInvoice = await FacultyInvoice.create(invoiceData);

      // Generate PDF
      const response = await generateFacultyInvoice({
        faculty: { ...faculty, rate_per_hour: ratePerHour },
        invoice: newInvoice,
        sessions: periodSessions,
        expenses: periodExpenses
      });

      // Download PDF
      const byteCharacters = atob(response.pdf_base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      loadData();
      setIsInvoiceModalOpen(false);
      setInvoiceForm({ billing_period_start: "", billing_period_end: "", remarks: "" });
      alert("Invoice generated and downloaded!");
    } catch (error) {
      console.error("Error generating invoice:", error);
      alert("Failed to generate invoice");
    }
    setGenerating(false);
  };

  const totalHours = sessions.reduce((sum, s) => sum + (s.total_hours || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalEarnings = totalHours * (facultyData.rate_per_hour || 0);
  const netPayable = totalEarnings + totalExpenses;

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl">{faculty.name}</CardTitle>
              <p className="text-sm text-gray-600">{faculty.email}</p>
              <div className="flex gap-2 mt-2">
                <Badge>{faculty.department || 'N/A'}</Badge>
                <Badge variant="outline" className="text-green-600">₹{facultyData.rate_per_hour}/hr</Badge>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setFacultyData({ name: faculty.name, rate_per_hour: faculty.rate_per_hour || 0 }); setIsEditModalOpen(true); }}>
              <Edit className="w-4 h-4 mr-1" />
              Edit Rate
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-blue-600">{totalHours.toFixed(1)}</p>
              <p className="text-xs text-gray-600">Total Hours</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-green-600">₹{totalEarnings.toFixed(0)}</p>
              <p className="text-xs text-gray-600">Earnings</p>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <Receipt className="w-5 h-5 text-orange-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-orange-600">₹{totalExpenses.toFixed(0)}</p>
              <p className="text-xs text-gray-600">Expenses</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <FileText className="w-5 h-5 text-purple-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-purple-600">₹{netPayable.toFixed(0)}</p>
              <p className="text-xs text-gray-600">Net Payable</p>
            </div>
          </div>

          <Accordion type="single" collapsible value={expanded ? "details" : ""} onValueChange={(val) => setExpanded(!!val)}>
            <AccordionItem value="details">
              <AccordionTrigger>View Details & Manage</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-4">
                  <div className="flex gap-2 mb-4">
                    <Button onClick={() => setIsSessionModalOpen(true)} size="sm" className="flex-1">
                      <Plus className="w-4 h-4 mr-1" />
                      Add Session
                    </Button>
                    <Button onClick={() => setIsExpenseModalOpen(true)} size="sm" variant="outline" className="flex-1">
                      <Plus className="w-4 h-4 mr-1" />
                      Add Expense
                    </Button>
                    <Button onClick={() => setIsInvoiceModalOpen(true)} size="sm" variant="secondary" className="flex-1">
                      <FileText className="w-4 h-4 mr-1" />
                      Generate Invoice
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Sessions ({sessions.length})</h4>
                    {sessions.slice(0, 3).map(session => (
                      <div key={session.id} className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm">
                        <div>
                          <p className="font-medium">{session.session_title}</p>
                          <p className="text-xs text-gray-600">{format(new Date(session.session_date), 'dd MMM yyyy')} • {session.total_hours}h</p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => { setEditingSession(session); setSessionForm(session); setIsSessionModalOpen(true); }}>
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteSession(session.id)}>
                            <Trash2 className="w-3 h-3 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Expenses ({expenses.length})</h4>
                    {expenses.slice(0, 3).map(expense => (
                      <div key={expense.id} className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm">
                        <div>
                          <p className="font-medium">{expense.expense_type}</p>
                          <p className="text-xs text-gray-600">{format(new Date(expense.expense_date), 'dd MMM yyyy')} • ₹{expense.amount}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => { setEditingExpense(expense); setExpenseForm(expense); setIsExpenseModalOpen(true); }}>
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteExpense(expense.id)}>
                            <Trash2 className="w-3 h-3 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {invoices.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">Recent Invoices</h4>
                      {invoices.slice(0, 2).map(invoice => (
                        <div key={invoice.id} className="flex justify-between items-center p-2 bg-purple-50 rounded text-sm">
                          <div>
                            <p className="font-medium">{invoice.invoice_number}</p>
                            <p className="text-xs text-gray-600">₹{invoice.grand_total} • {invoice.status}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Edit Rate Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Faculty Rate</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>Rate per Hour (₹)</Label>
            <Input
              type="number"
              step="0.01"
              value={facultyData.rate_per_hour}
              onChange={(e) => setFacultyData({ ...facultyData, rate_per_hour: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateFaculty}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Session Modal */}
      <Dialog open={isSessionModalOpen} onOpenChange={setIsSessionModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingSession ? "Edit Session" : "Add Session"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <Label>Session Title *</Label>
              <Input value={sessionForm.session_title} onChange={(e) => setSessionForm({...sessionForm, session_title: e.target.value})} />
            </div>
            <div>
              <Label>Subject / Module</Label>
              <Input value={sessionForm.subject_module} onChange={(e) => setSessionForm({...sessionForm, subject_module: e.target.value})} />
            </div>
            <div>
              <Label>Batch / Class</Label>
              <Input value={sessionForm.batch_class} onChange={(e) => setSessionForm({...sessionForm, batch_class: e.target.value})} />
            </div>
            <div>
              <Label>Session Date *</Label>
              <Input type="date" value={sessionForm.session_date} onChange={(e) => setSessionForm({...sessionForm, session_date: e.target.value})} />
            </div>
            <div>
              <Label>Mode</Label>
              <Select value={sessionForm.mode} onValueChange={(value) => setSessionForm({...sessionForm, mode: value})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Online">Online</SelectItem>
                  <SelectItem value="Offline">Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Start Time</Label>
              <Input type="time" value={sessionForm.start_time} onChange={(e) => handleTimeChange('start_time', e.target.value)} />
            </div>
            <div>
              <Label>End Time</Label>
              <Input type="time" value={sessionForm.end_time} onChange={(e) => handleTimeChange('end_time', e.target.value)} />
            </div>
            <div>
              <Label>Total Hours *</Label>
              <Input type="number" step="0.5" value={sessionForm.total_hours} onChange={(e) => setSessionForm({...sessionForm, total_hours: parseFloat(e.target.value) || 0})} />
            </div>
            <div className="col-span-2">
              <Label>Remarks</Label>
              <Textarea value={sessionForm.remarks} onChange={(e) => setSessionForm({...sessionForm, remarks: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsSessionModalOpen(false); setEditingSession(null); }}>Cancel</Button>
            <Button onClick={handleSaveSession}>{editingSession ? "Update" : "Add"} Session</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Expense Modal */}
      <Dialog open={isExpenseModalOpen} onOpenChange={setIsExpenseModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Edit Expense" : "Add Expense"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Date *</Label>
              <Input type="date" value={expenseForm.expense_date} onChange={(e) => setExpenseForm({...expenseForm, expense_date: e.target.value})} />
            </div>
            <div>
              <Label>Type *</Label>
              <Select value={expenseForm.expense_type} onValueChange={(value) => setExpenseForm({...expenseForm, expense_type: value})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Input type="number" step="0.01" value={expenseForm.amount} onChange={(e) => setExpenseForm({...expenseForm, amount: parseFloat(e.target.value) || 0})} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={expenseForm.description} onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsExpenseModalOpen(false); setEditingExpense(null); }}>Cancel</Button>
            <Button onClick={handleSaveExpense}>{editingExpense ? "Update" : "Add"} Expense</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Invoice Modal */}
      <Dialog open={isInvoiceModalOpen} onOpenChange={setIsInvoiceModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Billing Period Start *</Label>
              <Input type="date" value={invoiceForm.billing_period_start} onChange={(e) => setInvoiceForm({...invoiceForm, billing_period_start: e.target.value})} />
            </div>
            <div>
              <Label>Billing Period End *</Label>
              <Input type="date" value={invoiceForm.billing_period_end} onChange={(e) => setInvoiceForm({...invoiceForm, billing_period_end: e.target.value})} />
            </div>
            <div>
              <Label>Remarks</Label>
              <Textarea value={invoiceForm.remarks} onChange={(e) => setInvoiceForm({...invoiceForm, remarks: e.target.value})} />
            </div>
            <div className="bg-blue-50 p-3 rounded">
              <p className="text-sm"><strong>Rate:</strong> ₹{facultyData.rate_per_hour}/hour</p>
              <p className="text-xs text-gray-600 mt-1">Invoice will include all sessions and expenses within the selected period and auto-download as PDF</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInvoiceModalOpen(false)}>Cancel</Button>
            <Button onClick={handleGenerateInvoice} disabled={generating}>
              {generating ? "Generating..." : "Generate & Download"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}