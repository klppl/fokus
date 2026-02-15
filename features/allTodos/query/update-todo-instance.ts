import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { todoInstanceSchema } from "@/schema";
import { TodoItemType } from "@/types";
import React from "react";

async function patchTodo({ ghostTodo }: { ghostTodo: TodoItemType }) {
  const parsedObj = todoInstanceSchema.safeParse({
    title: ghostTodo.title,
    description: ghostTodo.description,
    priority: ghostTodo.priority,
    dtstart: ghostTodo.dtstart,
    due: ghostTodo.due,
    rrule: ghostTodo.rrule,
    instanceDate: ghostTodo.instanceDate,
  });
  if (!parsedObj.success) {
    console.error(parsedObj.error.errors[0]);
    return;
  }
  const todoId = ghostTodo.id.split(":")[0];
  await api.PATCH({
    url: `/api/todo/instance/${todoId}`,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...parsedObj.data, id: todoId }),
  });
}

export const useEditTodoInstance = (
  setEditInstanceOnly:
    | React.Dispatch<React.SetStateAction<boolean>>
    | undefined,
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { mutate: editTodoInstanceMutateFn, status: editTodoInstanceStatus } =
    useMutation({
      mutationFn: (ghostTodo: TodoItemType) => patchTodo({ ghostTodo }),
      onMutate: async (newTodo) => {
        await queryClient.cancelQueries({ queryKey: ["allTodo"] });
        const prevQueries = queryClient.getQueriesData<TodoItemType[]>({ queryKey: ["allTodo"] });
        prevQueries.forEach(([key, data]) => {
          if (data) {
            queryClient.setQueryData(key, data.map((oldTodo) => {
              if (oldTodo.id === newTodo.id) {
                return {
                  ...oldTodo,
                  title: newTodo.title,
                  description: newTodo.description,
                  priority: newTodo.priority,
                  due: newTodo.due,
                  dtstart: newTodo.dtstart,
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
        if (setEditInstanceOnly) setEditInstanceOnly(false);
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

  return { editTodoInstanceMutateFn, editTodoInstanceStatus };
};
