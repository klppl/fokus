import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { todoSchema } from "@/schema";
import { TodoItemType } from "@/types";

export interface TodoItemTypeWithDateChecksum extends TodoItemType {
  dateRangeChecksum: string;
  rruleChecksum: string | null;
}

async function patchTodo({ todo }: { todo: TodoItemTypeWithDateChecksum }) {
  if (!todo.id) {
    throw new Error("this todo is missing");
  }
  const parsedObj = todoSchema.safeParse({
    title: todo.title,
    description: todo.description,
    priority: todo.priority,
    dtstart: todo.dtstart,
    due: todo.due,
    rrule: todo.rrule,
    projectID: todo.projectID,
  });
  if (!parsedObj.success) {
    console.log(parsedObj.error.errors[0]);
    return;
  }
  const dateChanged =
    todo.dateRangeChecksum !==
    todo.dtstart.toISOString() + todo.due.toISOString();
  const rruleChanged = todo.rruleChecksum !== todo.rrule;
  const todoId = todo.id.split(":")[0];
  await api.PATCH({
    url: `/api/todo/${todoId}`,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...parsedObj.data,
      id: todoId,
      instanceDate: todo.instanceDate,
      dateChanged,
      rruleChanged,
      projectID: todo.projectID,
    }),
  });
}

export const useEditTodo = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { mutate: editTodoMutateFn, status: editTodoStatus } = useMutation({
    mutationFn: (params: TodoItemTypeWithDateChecksum) =>
      patchTodo({ todo: params }),
    onMutate: async (newTodo) => {
      await queryClient.cancelQueries({ queryKey: ["allTodo"] });
      const prevQueries = queryClient.getQueriesData<TodoItemType[]>({ queryKey: ["allTodo"] });
      prevQueries.forEach(([key, data]) => {
        if (data) {
          queryClient.setQueryData(key, data.map((oldTodo) => {
            if (oldTodo.id === newTodo.id) {
              return {
                ...oldTodo,
                completed: newTodo.completed,
                pinned: newTodo.pinned,
                title: newTodo.title,
                description: newTodo.description,
                priority: newTodo.priority,
                due: newTodo.due,
                dtstart: newTodo.dtstart,
                rrule: newTodo.rrule,
                projectID: newTodo.projectID,
                durationMinutes: newTodo.durationMinutes,
              };
            }
            return oldTodo;
          }));
        }
      });
      return { prevQueries };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["calendarTodo"] });
      queryClient.invalidateQueries({ queryKey: ["todo"] });
    },
    onError: (error, newTodo, context) => {
      context?.prevQueries.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      toast({ description: error.message, variant: "destructive" });
    },
  });

  return { editTodoMutateFn, editTodoStatus };
};
