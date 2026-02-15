import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

interface UpdateCalendarData {
  syncDirection?: "BIDIRECTIONAL" | "PULL_ONLY" | "PUSH_ONLY";
  componentType?: "VTODO" | "VEVENT";
  syncEnabled?: boolean;
  projectId?: string | null;
}

async function updateCalendar({
  id,
  data,
}: {
  id: string;
  data: UpdateCalendarData;
}) {
  return api.PATCH({
    url: `/api/caldav/calendar/${id}`,
    body: JSON.stringify(data),
  });
}

export const useUpdateCalDavCalendar = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateCalendar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caldavAccounts"] });
    },
  });
};
