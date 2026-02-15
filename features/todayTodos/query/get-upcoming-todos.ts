import { TodoItemType } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { addDays, startOfDay, endOfDay } from "date-fns";

export const getUpcomingTodo = async (dayOffset: number) => {
  const target = addDays(new Date(), dayOffset);
  const start = startOfDay(target).getTime();
  const end = endOfDay(target).getTime();
  const data = await api.GET({
    url: `/api/todo?start=${start}&end=${end}`,
  });
  const { todos }: { todos: TodoItemType[] } = data;
  if (!todos) {
    throw new Error(
      data.message || `bad server response: Did not receive todo`,
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

export const useUpcomingTodos = (dayOffset: number) => {
  const {
    data: todos = [],
    isLoading,
  } = useQuery<TodoItemType[]>({
    queryKey: ["upcomingTodo", dayOffset],
    queryFn: () => getUpcomingTodo(dayOffset),
    enabled: dayOffset > 0,
  });

  return { todos, isLoading };
};
