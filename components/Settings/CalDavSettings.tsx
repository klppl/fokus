"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/Modal";
import {
  useCalDavAccounts,
  CalDavAccountItem,
} from "@/features/caldav/query/get-caldav-accounts";
import { useDeleteCalDavAccount } from "@/features/caldav/query/delete-caldav-account";
import { useTriggerSync } from "@/features/caldav/query/trigger-sync";
import CalDavAccountForm from "./CalDavAccountForm";
import {
  RefreshCw,
  Trash2,
  Plus,
  Server,
  Calendar,
  Loader2,
} from "lucide-react";

interface CalDavSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CalDavSettings({
  open,
  onOpenChange,
}: CalDavSettingsProps) {
  const { data: accounts, isLoading } = useCalDavAccounts();
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalOverlay>
        <ModalContent className="max-w-lg top-1/2 -translate-y-1/2 max-h-[80vh] overflow-y-auto">
          <ModalHeader>
            <ModalTitle>CalDAV Sync</ModalTitle>
            <ModalDescription>
              Connect to CalDAV servers to sync your todos.
            </ModalDescription>
          </ModalHeader>

          <div className="flex flex-col gap-4 mt-4">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {accounts && accounts.length === 0 && !showAddForm && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No CalDAV accounts configured.
              </p>
            )}

            {accounts?.map((account) => (
              <AccountCard key={account.id} account={account} />
            ))}

            {showAddForm ? (
              <div className="border rounded-lg p-4">
                <h4 className="text-sm font-medium mb-3">Add CalDAV Account</h4>
                <CalDavAccountForm
                  onSuccess={() => setShowAddForm(false)}
                />
                <Button
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => setShowAddForm(true)}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add CalDAV Account
              </Button>
            )}
          </div>
        </ModalContent>
      </ModalOverlay>
    </Modal>
  );
}

function AccountCard({ account }: { account: CalDavAccountItem }) {
  const { mutate: deleteAccount, status: deleteStatus } =
    useDeleteCalDavAccount();
  const { mutate: triggerSync, status: syncStatus } = useTriggerSync();
  const isDeleting = deleteStatus === "pending";
  const isSyncing = syncStatus === "pending";

  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">{account.displayName}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => triggerSync(account.id)}
            disabled={isSyncing}
            title="Sync now"
          >
            <RefreshCw
              className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`}
            />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => deleteAccount(account.id)}
            disabled={isDeleting}
            title="Remove account"
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-1">
        {account.serverUrl} &middot; {account.username}
      </p>

      {account.lastSyncAt && (
        <p className="text-xs text-muted-foreground mt-0.5">
          Last synced: {new Date(account.lastSyncAt).toLocaleString()}
        </p>
      )}

      {account.calendars.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {account.calendars.map((cal) => (
            <div
              key={cal.id}
              className="flex items-center gap-2 text-xs text-muted-foreground pl-2"
            >
              <Calendar className="w-3 h-3" />
              <span>{cal.displayName || cal.calendarUrl}</span>
              <span className="text-xs opacity-60">
                ({cal.componentType} &middot; {cal.syncDirection.replace("_", " ").toLowerCase()})
              </span>
              <span className="text-xs opacity-60">
                {cal._count.items} items
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
