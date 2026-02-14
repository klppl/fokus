import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface SyncConflict {
  id: string;
  caldavUid: string;
  caldavHref: string;
  todoId: string | null;
  localTodo: {
    title: string;
    description: string | null;
    dtstart: string;
    due: string;
    priority: string;
  } | null;
  serverIcalOnConflict: string | null;
  conflictState: string;
}

async function fetchConflicts(): Promise<SyncConflict[]> {
  const res = await api.GET({ url: "/api/caldav/sync/conflicts" });
  return res.conflicts;
}

export const useConflicts = () => {
  return useQuery({
    queryKey: ["syncConflicts"],
    queryFn: fetchConflicts,
  });
};
