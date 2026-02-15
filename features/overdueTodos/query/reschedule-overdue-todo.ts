import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { TodoItemType } from "@/types";
import { useUserTimezone } from "@/features/user/query/get-timezone";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

async function rescheduleTodo({
  todoId,
  dtstart,
  due,
}: {
  todoId: string;
  dtstart: Date;
  due: Date;
}) {
  await api.PATCH({
    url: `/api/todo/${todoId}`,
    body: JSON.stringify({
      dtstart,
      due,
      dateChanged: true,
    }),
  });
}

export const useRescheduleToToday = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userTz = useUserTimezone();
  const timeZone = userTz?.timeZone ?? "UTC";

  const { mutate: rescheduleToToday } = useMutation({
    mutationFn: (params: { todo: TodoItemType }) => {
      const { todo } = params;
      const originalDuration = todo.due.getTime() - todo.dtstart.getTime();

      // Get today's date in user's timezone (UTC fields = local values)
      const nowLocal = toZonedTime(new Date(), timeZone);
      const todayYear = nowLocal.getUTCFullYear();
      const todayMonth = nowLocal.getUTCMonth();
      const todayDate = nowLocal.getUTCDate();

      // Get original time-of-day in user's timezone
      const origLocal = toZonedTime(todo.dtstart, timeZone);
      const hours = origLocal.getUTCHours();
      const minutes = origLocal.getUTCMinutes();
      const seconds = origLocal.getUTCSeconds();

      // Build "today + original time" in local tz, then convert to real UTC
      const newLocalDtstart = new Date(Date.UTC(todayYear, todayMonth, todayDate, hours, minutes, seconds));
      const newDtstart = fromZonedTime(newLocalDtstart, timeZone);
      const newDue = new Date(newDtstart.getTime() + originalDuration);

      const todoId = todo.id.split(":")[0];

      return rescheduleTodo({ todoId, dtstart: newDtstart, due: newDue });
    },
    onMutate: async ({ todo }) => {
      await queryClient.cancelQueries({ queryKey: ["overdueTodo"] });
      const oldTodos = queryClient.getQueryData<TodoItemType[]>([
        "overdueTodo",
      ]);

      queryClient.setQueryData(
        ["overdueTodo"],
        (old: TodoItemType[] | undefined) =>
          (old ?? []).filter((t) => t.id !== todo.id),
      );

      return { oldTodos };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["overdueTodo"] });
      queryClient.invalidateQueries({ queryKey: ["todo"] });
      queryClient.invalidateQueries({ queryKey: ["calendarTodo"] });
    },
    onError: (error, _vars, context) => {
      queryClient.setQueryData(["overdueTodo"], context?.oldTodos);
      toast({ description: error.message, variant: "destructive" });
    },
  });

  return { rescheduleToToday };
};
