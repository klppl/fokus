import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface SyncStatus {
  lastSyncAt: string | null;
  conflictCount: number;
  totalSyncItems: number;
  accountCount: number;
}

async function fetchSyncStatus(): Promise<SyncStatus> {
  const res = await api.GET({ url: "/api/caldav/sync" });
  return res.status;
}

export const useSyncStatus = () => {
  return useQuery({
    queryKey: ["syncStatus"],
    queryFn: fetchSyncStatus,
    refetchInterval: 60000, // refresh every minute
  });
};
