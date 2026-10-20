import React, { useCallback, useEffect, useState } from "react";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KeyRound, Loader2, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

// Admin page: login accounts (replaces the user management the hosted dashboard used to provide).
export default function UserAccounts() {
  const [users, setUsers] = useState([]);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState(null); // { mode: 'create' } | { mode: 'password', user }
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "user" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, current] = await Promise.all([api.users.list(), api.auth.me()]);
      setUsers(list);
      setMe(current);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const changeRole = async (user, role) => {
    try {
      await api.users.update(user.id, { role });
      toast.success(`${user.full_name || user.email} is now ${role === "admin" ? "an admin" : "a regular user"}`);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const remove = async (user) => {
    if (!window.confirm(`Delete the login account for ${user.email}? Their student/faculty records are kept.`)) return;
    try {
      await api.users.delete(user.id);
      toast.success("Account deleted");
      load();
    } catch (e) { toast.error(e.message); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (dialog.mode === "create") {
        await api.users.create(form);
        toast.success(`Account created for ${form.email}`);
      } else {
        await api.users.setPassword(dialog.user.id, form.password);
        toast.success(`Password reset for ${dialog.user.email}`);
      }
      setDialog(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const open = (d) => {
    setForm({ full_name: "", email: "", password: "", role: "user" });
    setDialog(d);
  };

  const shown = users.filter((u) =>
    `${u.full_name} ${u.email}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-600" /> User Accounts
          </h1>
          <p className="text-gray-600 mt-1">Login accounts for admins, faculty and students.</p>
        </div>
        <Button onClick={() => open({ mode: "create" })} className="bg-gradient-to-r from-blue-600 to-indigo-600">
          <Plus className="w-4 h-4 mr-2" /> New account
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-lg">{users.length} account{users.length === 1 ? "" : "s"}</CardTitle>
          <Input placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((u) => {
                  const isMe = me && u.id === me.id;
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.full_name}{isMe && <span className="text-xs text-gray-500"> (you)</span>}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        {isMe ? (
                          <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100"><ShieldCheck className="w-3 h-3 mr-1" />Admin</Badge>
                        ) : (
                          <Select value={u.role} onValueChange={(v) => changeRole(u, v)}>
                            <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-600">{new Date(u.created_date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button variant="ghost" size="sm" onClick={() => open({ mode: "password", user: u })} title="Reset password">
                          <KeyRound className="w-4 h-4" />
                        </Button>
                        {!isMe && (
                          <Button variant="ghost" size="sm" onClick={() => remove(u)} title="Delete account" className="text-red-600 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {shown.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-gray-500 py-8">No accounts found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-gray-500">
        Faculty access is switched on in <strong>Manage Faculty</strong> (set status to active).
        Students sign up with the email on their student record and land in the Student Portal.
      </p>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.mode === "create" ? "New account" : `Reset password — ${dialog?.user?.email}`}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            {dialog?.mode === "create" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="ua_name">Full name</Label>
                  <Input id="ua_name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ua_email">Email</Label>
                  <Input id="ua_email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User (faculty / student)</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="ua_pw">{dialog?.mode === "create" ? "Password" : "New password"}</Label>
              <Input id="ua_pw" type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              <p className="text-xs text-gray-500">At least 6 characters. Share it with the user privately.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
              <Button type="submit" disabled={busy} className="bg-gradient-to-r from-blue-600 to-indigo-600">
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {dialog?.mode === "create" ? "Create account" : "Reset password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
