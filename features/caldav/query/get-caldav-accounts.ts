import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface CalDavCalendarItem {
  id: string;
  calendarUrl: string;
  displayName: string | null;
  color: string | null;
  syncDirection: "BIDIRECTIONAL" | "PULL_ONLY" | "PUSH_ONLY";
  componentType: "VTODO" | "VEVENT";
  syncEnabled: boolean;
  projectId: string | null;
  _count: { items: number };
}

export interface CalDavAccountItem {
  id: string;
  displayName: string;
  serverUrl: string;
  username: string;
  syncEnabled: boolean;
  syncIntervalMin: number;
  lastSyncAt: string | null;
  calendars: CalDavCalendarItem[];
}

async function fetchAccounts(): Promise<CalDavAccountItem[]> {
  const res = await api.GET({ url: "/api/caldav/account" });
  return res.accounts;
}

export const useCalDavAccounts = () => {
  return useQuery({
    queryKey: ["caldavAccounts"],
    queryFn: fetchAccounts,
  });
};
