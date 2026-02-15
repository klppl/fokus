"use client";
import React, { useState } from "react";
import { useSyncStatus } from "@/features/caldav/query/get-sync-status";
import { useTriggerSync } from "@/features/caldav/query/trigger-sync";
import { RefreshCw, AlertTriangle } from "lucide-react";
import ConflictResolutionDialog from "@/components/Settings/ConflictResolutionDialog";

export default function SyncStatusIndicator() {
  const { data: status } = useSyncStatus();
  const { mutate: triggerSync, status: syncStatus } = useTriggerSync();
  const [showConflicts, setShowConflicts] = useState(false);
  const isSyncing = syncStatus === "pending";

  // Don't render if no CalDAV accounts
  if (!status || status.accountCount === 0) return null;

  return (
    <>
      <ConflictResolutionDialog
        open={showConflicts}
        onOpenChange={setShowConflicts}
      />
      <div className="flex items-center gap-2">
        <button
          onClick={() => triggerSync(undefined)}
          disabled={isSyncing}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="Sync CalDAV"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`}
          />
          <span>Sync</span>
        </button>

        {status.conflictCount > 0 && (
          <button
            onClick={() => setShowConflicts(true)}
            className="flex items-center gap-1 text-xs text-yellow-500 hover:text-yellow-400 transition-colors"
            title={`${status.conflictCount} conflicts`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{status.conflictCount}</span>
          </button>
        )}
      </div>
    </>
  );
}
