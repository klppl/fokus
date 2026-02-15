"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/Modal";
import { useConflicts, SyncConflict } from "@/features/caldav/query/get-conflicts";
import { useResolveConflict } from "@/features/caldav/query/resolve-conflict";
import { AlertTriangle, Loader2 } from "lucide-react";

interface ConflictResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ConflictResolutionDialog({
  open,
  onOpenChange,
}: ConflictResolutionDialogProps) {
  const { data: conflicts, isLoading } = useConflicts();

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalOverlay>
        <ModalContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <ModalHeader>
            <ModalTitle>Sync Conflicts</ModalTitle>
            <ModalDescription>
              These items were modified both locally and on the CalDAV server.
              Choose which version to keep.
            </ModalDescription>
          </ModalHeader>

          <div className="flex flex-col gap-4 mt-4">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {conflicts && conflicts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No conflicts to resolve.
              </p>
            )}

            {conflicts?.map((conflict) => (
              <ConflictCard key={conflict.id} conflict={conflict} />
            ))}
          </div>
        </ModalContent>
      </ModalOverlay>
    </Modal>
  );
}

function ConflictCard({ conflict }: { conflict: SyncConflict }) {
  const { mutate: resolve, status } = useResolveConflict();
  const isResolving = status === "pending";

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-yellow-500" />
        <span className="font-medium text-sm">
          {conflict.localTodo?.title || conflict.caldavUid}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Local version */}
        <div className="border rounded p-3 bg-background">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Local
          </p>
          {conflict.localTodo ? (
            <div className="text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Title:</span>{" "}
                {conflict.localTodo.title}
              </p>
              <p>
                <span className="text-muted-foreground">Priority:</span>{" "}
                {conflict.localTodo.priority}
              </p>
              <p>
                <span className="text-muted-foreground">Start:</span>{" "}
                {new Date(conflict.localTodo.dtstart).toLocaleString()}
              </p>
              <p>
                <span className="text-muted-foreground">Due:</span>{" "}
                {new Date(conflict.localTodo.due).toLocaleString()}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Deleted locally</p>
          )}
        </div>

        {/* Server version */}
        <div className="border rounded p-3 bg-background">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Server (CalDAV)
          </p>
          <p className="text-xs text-muted-foreground break-all">
            {conflict.serverIcalOnConflict
              ? "Server has a different version"
              : "No server data available"}
          </p>
        </div>
      </div>

      <div className="flex gap-2 mt-3 justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            resolve({ syncItemId: conflict.id, resolution: "LOCAL_WINS" })
          }
          disabled={isResolving}
        >
          Keep Local
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            resolve({ syncItemId: conflict.id, resolution: "SERVER_WINS" })
          }
          disabled={isResolving}
        >
          Keep Server
        </Button>
      </div>
    </div>
  );
}
