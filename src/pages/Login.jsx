import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { GraduationCap, Loader2, Mail, Lock, User as UserIcon } from "lucide-react";
import { api, getToken } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function safeNext(next) {
  // Only allow same-site paths
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : "/";
}

export default function Login() {
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [allowSignup, setAllowSignup] = useState(true);

  useEffect(() => {
    // Already logged in? go straight through.
    if (getToken()) api.auth.me().then(() => window.location.replace(next)).catch(() => {});
    api.config().then((c) => setAllowSignup(c.allow_signup !== false)).catch(() => {});
  }, [next]);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await api.auth.loginWithPassword(form.email, form.password);
      else await api.auth.register(form);
      window.location.replace(next);
    } catch (err) {
      setError(err.message || "Something went wrong");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-6">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-4 rounded-2xl inline-block mb-4 shadow-lg">
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">EDU TRACK</h1>
          <p className="text-gray-600 mt-1">
            {mode === "login" ? "Log in to continue" : "Create your account"}
          </p>
        </div>

        {allowSignup && (
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg mb-6" role="tablist">
            {["login", "register"].map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => { setMode(m); setError(""); }}
                className={`py-2 rounded-md text-sm font-medium transition-colors ${
                  mode === m ? "bg-white shadow text-indigo-700" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {m === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && (
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full name</Label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input id="full_name" className="pl-9" value={form.full_name} onChange={update("full_name")} required autoComplete="name" />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input id="email" type="email" className="pl-9" value={form.email} onChange={update("email")} required autoComplete="email" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                id="password" type="password" className="pl-9" value={form.password} onChange={update("password")}
                required minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>
            {mode === "register" && <p className="text-xs text-slate-500">At least 6 characters.</p>}
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700" role="alert">{error}</div>
          )}

          <Button
            type="submit"
            disabled={busy}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 h-auto"
          >
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {mode === "login" ? "Log in" : "Create account"}
          </Button>
        </form>

        <p className="text-xs text-slate-500 text-center mt-6">
          Students: sign up with the same email your college registered.
          {!allowSignup && " New accounts are created by the admin."}
        </p>
      </div>
    </div>
  );
}
