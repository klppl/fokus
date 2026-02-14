"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateCalDavAccount } from "@/features/caldav/query/create-caldav-account";
import { Loader2 } from "lucide-react";

interface CalDavAccountFormProps {
  onSuccess?: () => void;
}

export default function CalDavAccountForm({ onSuccess }: CalDavAccountFormProps) {
  const [displayName, setDisplayName] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const { mutate: createAccount, status } = useCreateCalDavAccount();
  const isLoading = status === "pending";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAccount(
      { displayName, serverUrl, username, password },
      {
        onSuccess: () => {
          setDisplayName("");
          setServerUrl("");
          setUsername("");
          setPassword("");
          onSuccess?.();
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="caldav-name" className="text-sm font-medium">Display Name</label>
        <Input
          id="caldav-name"
          placeholder="My CalDAV Server"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="caldav-url" className="text-sm font-medium">Server URL</label>
        <Input
          id="caldav-url"
          type="url"
          placeholder="https://caldav.example.com"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="caldav-user" className="text-sm font-medium">Username</label>
        <Input
          id="caldav-user"
          placeholder="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="caldav-pass" className="text-sm font-medium">Password</label>
        <Input
          id="caldav-pass"
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <Button type="submit" disabled={isLoading} className="mt-2">
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Add Account
      </Button>
    </form>
  );
}
