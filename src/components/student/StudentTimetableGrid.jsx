import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter } from "lucide-react";

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function StudentTimetableGrid({ student }) {
  const [timetable, setTimetable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterBatch, setFilterBatch] = useState('all');
  const [filterDay, setFilterDay] = useState('all');

  useEffect(() => {
    fetchTimetable();
  }, [student]);

  const fetchTimetable = async () => {
    try {
      const schedules = await api.entities.TimeTable.filter({
        batch_id: student.batch_id
      });

      if (schedules.length === 0) {
        // Static demo data matching image format
        const staticData = [
          { day_of_week: 'Thursday', time_slot: '09:00-10:00', subject: 'gbj', faculty_name: 'Guest Faculty', class_type: 'Theory' },
          { day_of_week: 'Monday', time_slot: '11:15-12:15', subject: 'DBMS', faculty_name: 'Siddhant Ingale', class_type: 'Practical' },
          { day_of_week: 'Wednesday', time_slot: '11:15-12:15', subject: 'gbj', faculty_name: 'Guest Faculty', class_type: 'Theory' },
          { day_of_week: 'Thursday', time_slot: '12:15-13:15', subject: 'gbj', faculty_name: 'Guest Faculty', class_type: 'Theory' },
          { day_of_week: 'Monday', time_slot: '13:15-14:15', subject: 'COOS', faculty_name: 'Siddhant Ingale', class_type: 'Theory' },
          { day_of_week: 'Monday', time_slot: '14:15-15:15', subject: 'DBMS', faculty_name: 'Siddhant Ingale', class_type: 'Practical' },
          { day_of_week: 'Tuesday', time_slot: '14:15-15:15', subject: 'COOS', faculty_name: 'Siddhant Ingale', class_type: 'Theory' },
          { day_of_week: 'Friday', time_slot: '14:15-15:15', subject: 'COOS', faculty_name: 'Siddhant Ingale', class_type: 'Theory' }
        ];
        setTimetable(staticData);
      } else {
        setTimetable(schedules);
      }
    } catch (error) {
      console.error("Error fetching timetable:", error);
    }
    setLoading(false);
  };

  // Get all unique time slots
  const getTimeSlots = () => {
    const slots = [...new Set(timetable.map(t => t.time_slot))];
    return slots.sort((a, b) => {
      const timeA = a.split('-')[0];
      const timeB = b.split('-')[0];
      return timeA.localeCompare(timeB);
    });
  };

  // Get entry for specific day and time
  const getEntryForDayTime = (day, timeSlot) => {
    return timetable.find(t => t.day_of_week === day && t.time_slot === timeSlot);
  };

  const filteredTimetable = timetable.filter(t => {
    if (filterDay !== 'all' && t.day_of_week !== filterDay) return false;
    return true;
  });

  const timeSlots = getTimeSlots();

  if (loading) {
    return <div className="h-96 bg-gray-200 rounded animate-pulse"></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">🗓️ Timetable</h1>
        <p className="text-gray-600 mt-1">Your weekly class schedule</p>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">Filters:</span>
            </div>
            <Select value={filterDay} onValueChange={setFilterDay}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Days" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Days</SelectItem>
                {DAYS.map(day => (
                  <SelectItem key={day} value={day}>{day}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Timetable Grid */}
      <Card className="border-0 shadow-xl overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                  <th className="p-3 text-left font-bold border border-blue-700 sticky left-0 bg-blue-600 z-10">
                    Time / Day
                  </th>
                  {DAYS.map((day, idx) => (
                    <th key={day} className="p-3 text-center font-bold border border-blue-700">
                      {SHORT_DAYS[idx]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((timeSlot, rowIdx) => (
                  <tr key={timeSlot} className={rowIdx % 2 === 0 ? 'bg-blue-50/30' : 'bg-white'}>
                    <td className="p-3 border border-gray-200 font-semibold text-sm text-gray-700 sticky left-0 bg-blue-50 z-10">
                      {timeSlot}
                    </td>
                    {DAYS.map(day => {
                      const entry = getEntryForDayTime(day, timeSlot);
                      
                      if (!entry) {
                        return (
                          <td key={day} className="p-3 border border-gray-200 text-center text-gray-400">
                            —
                          </td>
                        );
                      }

                      return (
                        <td key={day} className="p-3 border border-gray-200">
                          <div className="text-center">
                            <div className="font-bold text-gray-900 text-sm mb-1">
                              {entry.subject}
                            </div>
                            <div className="text-xs text-gray-600 mb-1">
                              {entry.faculty_name}
                            </div>
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                              entry.class_type === 'Theory' ? 'bg-blue-500 text-white' :
                              entry.class_type === 'Practical' ? 'bg-purple-500 text-white' :
                              entry.class_type === 'Lab' ? 'bg-green-500 text-white' :
                              'bg-gray-500 text-white'
                            }`}>
                              {entry.class_type}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {timeSlots.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No timetable data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}