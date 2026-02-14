import { prisma } from "@/lib/prisma/client";

/**
 * Mark a todo as locally modified for CalDAV sync.
 * This is called after todo CRUD operations.
 * Non-blocking: failures are silently caught.
 */
export async function markTodoModified(todoId: string): Promise<void> {
  try {
    await prisma.calDavSyncItem.updateMany({
      where: { todoId, conflictState: "NONE" },
      data: { locallyModifiedAt: new Date() },
    });
  } catch {
    // Sync tracking failures must never break primary operations
  }
}

/**
 * Mark a todo instance as locally modified.
 */
export async function markInstanceModified(
  todoInstanceId: string,
): Promise<void> {
  try {
    await prisma.calDavSyncItem.updateMany({
      where: { todoInstanceId, conflictState: "NONE" },
      data: { locallyModifiedAt: new Date() },
    });
  } catch {
    // Sync tracking failures must never break primary operations
  }
}

/**
 * Mark a todo as deleted for CalDAV sync.
 * The sync engine will send DELETE to the CalDAV server.
 */
export async function markTodoDeleted(todoId: string): Promise<void> {
  try {
    // Set locallyModifiedAt but keep the sync item so the engine knows to delete on server
    await prisma.calDavSyncItem.updateMany({
      where: { todoId },
      data: { locallyModifiedAt: new Date(), todoId: null },
    });
  } catch {
    // Sync tracking failures must never break primary operations
  }
}
