// Entity shortcuts, e.g. import { Student, Batch, User } from "@/entities/all";
import { api } from '@/api/client';

export const Announcement = api.entities.Announcement;
export const Assignment = api.entities.Assignment;
export const AssignmentSubmission = api.entities.AssignmentSubmission;
export const AttendanceRecord = api.entities.AttendanceRecord;
export const AttendanceSession = api.entities.AttendanceSession;
export const AttendanceSubmissionLog = api.entities.AttendanceSubmissionLog;
export const Batch = api.entities.Batch;
export const College = api.entities.College;
export const Complaint = api.entities.Complaint;
export const ExcalidrawNote = api.entities.ExcalidrawNote;
export const Faculty = api.entities.Faculty;
export const FacultyExpense = api.entities.FacultyExpense;
export const FacultyInvoice = api.entities.FacultyInvoice;
export const FacultySession = api.entities.FacultySession;
export const FacultySubjectMapping = api.entities.FacultySubjectMapping;
export const Feedback = api.entities.Feedback;
export const GeoFenceZone = api.entities.GeoFenceZone;
export const Message = api.entities.Message;
export const Note = api.entities.Note;
export const PendingPushNotification = api.entities.PendingPushNotification;
export const ProxyDetectionLog = api.entities.ProxyDetectionLog;
export const PushSubscription = api.entities.PushSubscription;
export const QRActiveStudent = api.entities.QRActiveStudent;
export const Query = api.entities.Query;
export const QuizQuestion = api.entities.QuizQuestion;
export const QuizResponse = api.entities.QuizResponse;
export const Session = api.entities.Session;
export const Student = api.entities.Student;
export const StudentNotification = api.entities.StudentNotification;
export const StudentPerformance = api.entities.StudentPerformance;
export const TeachingNote = api.entities.TeachingNote;
export const TimeTable = api.entities.TimeTable;

// The logged-in user (plus admin listing of all users).
export const User = {
  me: () => api.auth.me(),
  updateMe: (data) => api.auth.updateMe(data),
  updateMyUserData: (data) => api.auth.updateMe(data),
  login: (next) => api.auth.login(next),
  logout: (redirectUrl) => api.auth.logout(redirectUrl),
  list: (sort, limit, skip) => api.entities.User.list(sort, limit, skip),
  filter: (q, sort, limit, skip) => api.entities.User.filter(q, sort, limit, skip),
  get: (id) => api.entities.User.get(id),
  update: (id, data) => api.entities.User.update(id, data),
};
