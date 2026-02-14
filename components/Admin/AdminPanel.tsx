"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type PurgeTarget = "todos" | "notes" | "projects" | "caldav" | "all";

interface PurgeCategory {
  target: PurgeTarget;
  label: string;
  description: string;
}

const categories: PurgeCategory[] = [
  {
    target: "todos",
    label: "Todos",
    description:
      "Delete all todos, recurring instances, and completed todo history.",
  },
  {
    target: "notes",
    label: "Notes",
    description: "Delete all notes and their content.",
  },
  {
    target: "projects",
    label: "Projects",
    description:
      "Delete all projects. Todos in those projects will be unlinked, not deleted.",
  },
  {
    target: "caldav",
    label: "CalDAV",
    description: "Delete all CalDAV accounts, calendars, and sync data.",
  },
];

const inputClass = "w-full rounded-md border px-3 py-2 text-sm bg-background";

export default function AdminPanel() {
  const { toast } = useToast();
  const [hasUser, setHasUser] = useState<boolean | null>(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [armed, setArmed] = useState<PurgeTarget | null>(null);
  const [loading, setLoading] = useState<PurgeTarget | null>(null);

  // Registration state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState("");

  // Password reset state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/setup")
      .then((res) => res.json())
      .then((data) => setHasUser(data.hasUser))
      .catch(() => setHasUser(true));
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(false);

    const res = await fetch("/api/admin/purge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": adminPassword,
      },
      body: JSON.stringify({ target: "__verify" }),
    });

    if (res.status === 401) {
      setAuthError(true);
      return;
    }

    setAuthenticated(true);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError("");
    setRegLoading(true);

    try {
      const res = await fetch("/api/admin/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({
          fname: regName,
          email: regEmail,
          password: regPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Registration failed");
      }

      toast({
        title: "User registered",
        description: `Account created for ${data.email}. You can now log in.`,
      });

      setHasUser(true);
    } catch (err) {
      setRegError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setRegLoading(false);
    }
  }

  async function handlePurge(target: PurgeTarget) {
    if (armed !== target) {
      setArmed(target);
      return;
    }

    setArmed(null);
    setLoading(target);

    try {
      const res = await fetch("/api/admin/purge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({ target }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Purge failed");
      }

      const data = await res.json();
      const { counts } = data;

      const parts: string[] = [];
      if (counts.todos > 0) parts.push(`${counts.todos} todos`);
      if (counts.notes > 0) parts.push(`${counts.notes} notes`);
      if (counts.projects > 0) parts.push(`${counts.projects} projects`);
      if (counts.caldavAccounts > 0)
        parts.push(`${counts.caldavAccounts} CalDAV accounts`);

      toast({
        title: "Purge complete",
        description:
          parts.length > 0 ? `Deleted: ${parts.join(", ")}` : "Nothing to delete",
      });
    } catch (err) {
      toast({
        title: "Purge failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        variant: "destructive",
      });
      return;
    }

    setResetLoading(true);

    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({ newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Reset failed");
      }

      const data = await res.json();

      toast({
        title: "Password reset",
        description: `Password updated for ${data.email}`,
      });

      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast({
        title: "Password reset failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setResetLoading(false);
    }
  }

  // Loading state while checking setup
  if (hasUser === null) {
    return null;
  }

  // Step 1: Always require admin password first
  if (!authenticated) {
    return (
      <div className="p-6 max-w-sm mx-auto mt-24 space-y-4">
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Enter the admin password to continue.
        </p>
        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="password"
            value={adminPassword}
            onChange={(e) => {
              setAdminPassword(e.target.value);
              setAuthError(false);
            }}
            placeholder="Admin password"
            className={inputClass}
            autoFocus
          />
          {authError && (
            <p className="text-sm text-destructive">Incorrect password.</p>
          )}
          <Button type="submit" className="w-full" disabled={!adminPassword}>
            Unlock
          </Button>
        </form>
      </div>
    );
  }

  // Step 2: No user exists — show registration
  if (!hasUser) {
    return (
      <div className="p-6 max-w-sm mx-auto mt-24 space-y-4">
        <h1 className="text-2xl font-bold">Register your user</h1>
        <p className="text-sm text-muted-foreground">
          No account found. Create your user to get started.
        </p>
        <form onSubmit={handleRegister} className="space-y-3">
          <input
            type="text"
            value={regName}
            onChange={(e) => setRegName(e.target.value)}
            placeholder="Name"
            className={inputClass}
            autoFocus
          />
          <input
            type="email"
            value={regEmail}
            onChange={(e) => setRegEmail(e.target.value)}
            placeholder="Email"
            className={inputClass}
          />
          <input
            type="password"
            value={regPassword}
            onChange={(e) => setRegPassword(e.target.value)}
            placeholder="Password"
            className={inputClass}
          />
          {regError && (
            <p className="text-sm text-destructive">{regError}</p>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={regLoading || !regName || !regEmail || !regPassword}
          >
            {regLoading ? "Creating..." : "Create Account"}
          </Button>
        </form>
      </div>
    );
  }

  // Step 3: Authenticated with existing user — full admin panel
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-muted-foreground mt-1">
          Manage your instance. These actions are irreversible.
        </p>
      </div>

      {/* Password Reset */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="space-y-1">
          <p className="font-medium">Reset User Password</p>
          <p className="text-sm text-muted-foreground">
            Set a new login password for your account.
          </p>
        </div>
        <form onSubmit={handlePasswordReset} className="space-y-2">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            className={inputClass}
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            className={inputClass}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={resetLoading || !newPassword || !confirmPassword}
            className="w-full"
          >
            {resetLoading ? "Resetting..." : "Reset Password"}
          </Button>
        </form>
      </div>

      <div className="border-t pt-6" />

      {/* Purge Categories */}
      {categories.map((cat) => (
        <div
          key={cat.target}
          className="flex items-center justify-between border rounded-lg p-4"
        >
          <div className="space-y-1">
            <p className="font-medium">{cat.label}</p>
            <p className="text-sm text-muted-foreground">{cat.description}</p>
          </div>
          <Button
            variant={armed === cat.target ? "destructive" : "outline"}
            disabled={loading !== null}
            onClick={() => handlePurge(cat.target)}
            className="ml-4 shrink-0"
          >
            {loading === cat.target
              ? "Purging..."
              : armed === cat.target
                ? "Confirm"
                : "Purge"}
          </Button>
        </div>
      ))}

      <div className="border-t pt-6">
        <div className="flex items-center justify-between border border-destructive rounded-lg p-4">
          <div className="space-y-1">
            <p className="font-medium">Reset Everything</p>
            <p className="text-sm text-muted-foreground">
              Delete all todos, notes, projects, and CalDAV data.
            </p>
          </div>
          <Button
            variant={armed === "all" ? "destructive" : "outline"}
            disabled={loading !== null}
            onClick={() => handlePurge("all")}
            className="ml-4 shrink-0"
          >
            {loading === "all"
              ? "Resetting..."
              : armed === "all"
                ? "Confirm Reset"
                : "Reset All"}
          </Button>
        </div>
      </div>
    </div>
  );
}
