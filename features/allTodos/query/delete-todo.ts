import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import { TodoItemType } from "@/types";

export const useDeleteTodo = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { mutate: deleteMutateFn, isPending: deletePending } = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      await api.DELETE({ url: `/api/todo/${id.split(":")[0]}` });
    },
    onMutate: async ({ id }: { id: string }) => {
      await queryClient.cancelQueries({ queryKey: ["allTodo"] });
      await queryClient.cancelQueries({ queryKey: ["calendarTodo"] });
      const prevQueries = queryClient.getQueriesData<TodoItemType[]>({ queryKey: ["allTodo"] });
      prevQueries.forEach(([key, data]) => {
        if (data) {
          queryClient.setQueryData(key, data.filter((todo) => todo.id !== id));
        }
      });
      return { prevQueries };
    },
    mutationKey: ["allTodo"],
    onError: (error, _, context) => {
      context?.prevQueries.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      toast({
        description:
          error.message === "Failed to fetch"
            ? "failed to connect to server"
            : error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["allTodo"] });
      queryClient.invalidateQueries({ queryKey: ["todo"] });
      queryClient.invalidateQueries({ queryKey: ["completedTodo"] });
      queryClient.invalidateQueries({ queryKey: ["calendarTodo"] });
      queryClient.invalidateQueries({ queryKey: ["overdueTodo"] });
      toast({ description: "todo deleted" });
    },
  });
  return { deleteMutateFn, deletePending };
};
