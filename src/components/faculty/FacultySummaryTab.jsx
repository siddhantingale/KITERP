import React, { useState, useEffect } from "react";
import { FacultySession, FacultyExpense, FacultyInvoice } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Receipt, FileText, TrendingUp, Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

export default function FacultySummaryTab({ faculty }) {
  const [sessions, setSessions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAllData();
  }, [faculty.id]);

  const loadAllData = async () => {
    setIsLoading(true);
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
    setIsLoading(false);
  };

  const getFilteredData = () => {
    let startDate = new Date(0);
    const today = new Date();

    if (filterPeriod === "current_month") {
      startDate = startOfMonth(today);
    } else if (filterPeriod === "last_month") {
      startDate = startOfMonth(subMonths(today, 1));
      today.setTime(endOfMonth(subMonths(today, 1)).getTime());
    } else if (filterPeriod === "last_3_months") {
      startDate = subMonths(today, 3);
    }

    const filteredSessions = sessions.filter(s => {
      const sessionDate = new Date(s.session_date);
      return sessionDate >= startDate && sessionDate <= today;
    });

    const filteredExpenses = expenses.filter(e => {
      const expenseDate = new Date(e.expense_date);
      return expenseDate >= startDate && expenseDate <= today;
    });

    const filteredInvoices = invoices.filter(i => {
      const invoiceDate = new Date(i.created_date);
      return invoiceDate >= startDate && invoiceDate <= today;
    });

    return { filteredSessions, filteredExpenses, filteredInvoices };
  };

  const { filteredSessions, filteredExpenses, filteredInvoices } = getFilteredData();

  const totalHours = filteredSessions.reduce((sum, s) => sum + (s.total_hours || 0), 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const ratePerHour = faculty.rate_per_hour || 0;
  const totalEarnings = totalHours * ratePerHour;
  const netPayable = totalEarnings + totalExpenses;
  const totalInvoiced = filteredInvoices.reduce((sum, i) => sum + (i.grand_total || 0), 0);

  // Monthly breakdown
  const monthlyData = {};
  filteredSessions.forEach(session => {
    const monthKey = format(new Date(session.session_date), "MMM yyyy");
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { hours: 0, earnings: 0, expenses: 0 };
    }
    monthlyData[monthKey].hours += session.total_hours || 0;
    monthlyData[monthKey].earnings += (session.total_hours || 0) * ratePerHour;
  });

  filteredExpenses.forEach(expense => {
    const monthKey = format(new Date(expense.expense_date), "MMM yyyy");
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { hours: 0, earnings: 0, expenses: 0 };
    }
    monthlyData[monthKey].expenses += expense.amount || 0;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Financial Summary</h3>
        <Select value={filterPeriod} onValueChange={setFilterPeriod}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="current_month">Current Month</SelectItem>
            <SelectItem value="last_month">Last Month</SelectItem>
            <SelectItem value="last_3_months">Last 3 Months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 opacity-80" />
              <div>
                <p className="text-sm opacity-90">Total Hours</p>
                <p className="text-3xl font-bold">{totalHours.toFixed(1)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 opacity-80" />
              <div>
                <p className="text-sm opacity-90">Earnings</p>
                <p className="text-3xl font-bold">₹{totalEarnings.toFixed(0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Receipt className="w-8 h-8 opacity-80" />
              <div>
                <p className="text-sm opacity-90">Expenses</p>
                <p className="text-3xl font-bold">₹{totalExpenses.toFixed(0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 opacity-80" />
              <div>
                <p className="text-sm opacity-90">Net Payable</p>
                <p className="text-3xl font-bold">₹{netPayable.toFixed(0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(monthlyData).reverse().map(([month, data]) => (
              <div key={month} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold">{month}</span>
                </div>
                <div className="flex gap-6 text-sm">
                  <div>
                    <span className="text-gray-600">Hours:</span>
                    <span className="font-bold ml-2">{data.hours.toFixed(1)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Earnings:</span>
                    <span className="font-bold text-green-600 ml-2">₹{data.earnings.toFixed(0)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Expenses:</span>
                    <span className="font-bold text-orange-600 ml-2">₹{data.expenses.toFixed(0)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Net:</span>
                    <span className="font-bold text-purple-600 ml-2">₹{(data.earnings + data.expenses).toFixed(0)}</span>
                  </div>
                </div>
              </div>
            ))}

            {Object.keys(monthlyData).length === 0 && (
              <p className="text-center text-gray-500 py-8">No data for selected period</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-600">Sessions</p>
            <p className="text-2xl font-bold text-blue-600">{filteredSessions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-600">Avg Hours/Session</p>
            <p className="text-2xl font-bold text-green-600">
              {filteredSessions.length > 0 ? (totalHours / filteredSessions.length).toFixed(1) : 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-600">Invoices Generated</p>
            <p className="text-2xl font-bold text-purple-600">{filteredInvoices.length}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}