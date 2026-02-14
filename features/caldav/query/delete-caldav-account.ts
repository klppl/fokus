import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

async function deleteAccount(accountId: string) {
  return api.DELETE({ url: `/api/caldav/account/${accountId}` });
}

export const useDeleteCalDavAccount = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caldavAccounts"] });
      toast({ description: "CalDAV account removed" });
    },
    onError: (error) => {
      toast({
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
