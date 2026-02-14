import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

interface ResolveConflictInput {
  syncItemId: string;
  resolution: "LOCAL_WINS" | "SERVER_WINS";
}

async function resolveConflict(input: ResolveConflictInput) {
  return api.POST({
    url: "/api/caldav/sync/conflicts",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export const useResolveConflict = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: resolveConflict,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["syncConflicts"] });
      queryClient.invalidateQueries({ queryKey: ["syncStatus"] });
      queryClient.invalidateQueries({ queryKey: ["todo"] });
      toast({ description: "Conflict resolved" });
    },
    onError: (error) => {
      toast({
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
