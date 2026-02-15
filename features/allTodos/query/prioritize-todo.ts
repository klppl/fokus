import { useQueryClient, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { TodoItemType } from "@/types";

export const usePrioritizeTodo = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { mutate: prioritizeMutateFn, isPending: prioritizePending } =
    useMutation({
      mutationFn: async ({
        id,
        level,
        isRecurring,
      }: {
        id: string;
        level: "Low" | "Medium" | "High";
        isRecurring: boolean;
      }) => {
        const todoId = id.split(":")[0];
        const instanceDate = id.split(":")[1];
        if (isRecurring) {
          await api.PATCH({
            url: `/api/todo/instance/${todoId}/prioritize/?priority=${level}&instanceDate=${instanceDate}`,
          });
        } else {
          await api.PATCH({
            url: `/api/todo/${todoId}`,
            body: JSON.stringify({ priority: level }),
          });
        }
      },
      onMutate: async ({
        id,
        level,
      }: {
        id: string;
        level: "Low" | "Medium" | "High";
      }) => {
        await queryClient.cancelQueries({ queryKey: ["allTodo"] });
        const prevQueries = queryClient.getQueriesData<TodoItemType[]>({ queryKey: ["allTodo"] });
        prevQueries.forEach(([key, data]) => {
          if (data) {
            queryClient.setQueryData(key, data.map((t) =>
              t.id === id ? { ...t, priority: level } : t
            ));
          }
        });
        return { prevQueries };
      },
      onError: (error) => {
        toast({ description: error.message, variant: "destructive" });
      },
      onSettled() {
        queryClient.invalidateQueries({ queryKey: ["completedTodo"] });
      },
    });

  return { prioritizeMutateFn, prioritizePending };
};
