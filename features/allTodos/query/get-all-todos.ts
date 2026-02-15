import { TodoItemType } from "@/types";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { startOfToday, addWeeks } from "date-fns";

export const getAllTodos = async (weeks: number) => {
  const start = startOfToday().getTime();
  const end = addWeeks(startOfToday(), weeks).getTime();
  const data = await api.GET({
    url: `/api/todo?start=${start}&end=${end}`,
  });
  const { todos }: { todos: TodoItemType[] } = data;
  if (!todos) {
    throw new Error(
      data.message || `bad server response: Did not recieve todo`,
    );
  }
  const todoWithFormattedDates = todos.map((todo) => {
    const todoInstanceDate = todo.instanceDate
      ? new Date(todo.instanceDate)
      : null;
    const todoInstanceDateTime = todoInstanceDate?.getTime();
    const todoId = `${todo.id}:${todoInstanceDateTime}`;
    return {
      ...todo,
      id: todoId,
      createdAt: new Date(todo.createdAt),
      dtstart: new Date(todo.dtstart),
      due: new Date(todo.due),
      instanceDate: todoInstanceDate,
    };
  });

  return todoWithFormattedDates;
};

export const useAllTodos = (weeks: number = 4) => {
  const { toast } = useToast();
  const {
    data: todos = [],
    isLoading: todoLoading,
    isError,
    error,
  } = useQuery<TodoItemType[]>({
    queryKey: ["allTodo", weeks],
    retry: 2,
    queryFn: () => getAllTodos(weeks),
    placeholderData: keepPreviousData,
  });
  useEffect(() => {
    if (isError === true) {
      toast({ description: error.message, variant: "destructive" });
    }
  }, [isError]);

  return { todos, todoLoading };
};
