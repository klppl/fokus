import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

interface CreateAccountInput {
  displayName: string;
  serverUrl: string;
  username: string;
  password: string;
}

async function createAccount(input: CreateAccountInput) {
  return api.POST({
    url: "/api/caldav/account",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export const useCreateCalDavAccount = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAccount,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["caldavAccounts"] });
      toast({
        description: data.message || "CalDAV account created",
      });
    },
    onError: (error) => {
      toast({
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
