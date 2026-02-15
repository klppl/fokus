import { useQueryClient, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { TodoItemType } from "@/types";

export function usePinTodo() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { mutate: pinMutateFn, isPending: pinPending } = useMutation({
    mutationFn: async (todoItem: TodoItemType) => {
      await api.PATCH({
        url: `/api/todo/${todoItem.id.split(":")[0]}`,
        body: JSON.stringify({ pinned: !todoItem.pinned }),
      });
    },
    onMutate: async (todoItem: TodoItemType) => {
      await queryClient.cancelQueries({ queryKey: ["allTodo"] });
      const prevQueries = queryClient.getQueriesData<TodoItemType[]>({ queryKey: ["allTodo"] });
      prevQueries.forEach(([key, data]) => {
        if (data) {
          queryClient.setQueryData(key, data.map((t) =>
            t.id === todoItem.id ? { ...t, pinned: !todoItem.pinned } : t
          ));
        }
      });
      return { prevQueries };
    },
    onError: (error) => {
      toast({ description: error.message, variant: "destructive" });
    },
  });

  return { pinMutateFn, pinPending };
}
