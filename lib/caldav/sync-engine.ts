import { prisma } from "@/lib/prisma/client";
import {
  CalDavAccount,
  CalDavCalendar,
  Priority,
} from "@prisma/client";
import {
  createCalDavClient,
  fetchChangedResources,
  putResource,
  deleteResource,
} from "./client";
import {
  icalToTodo,
  todoToIcal,
  LocalTodo,
  LocalTodoInstance,
} from "./ical-converter";
import {
  deserializeExdates,
  serializeExdates,
  getNextTodoOrder,
} from "@/lib/prisma/db-adapter";


interface SyncResult {
  pulled: number;
  pushed: number;
  deleted: number;
  conflicts: number;
  errors: string[];
}

/**
 * Run a full sync for an account (all enabled calendars).
 */
export async function syncAccount(account: CalDavAccount): Promise<SyncResult> {
  const totals: SyncResult = {
    pulled: 0,
    pushed: 0,
    deleted: 0,
    conflicts: 0,
    errors: [],
  };

  const calendars = await prisma.calDavCalendar.findMany({
    where: { accountId: account.id, syncEnabled: true },
  });

  console.log(`[caldav-sync] Account "${account.displayName}": found ${calendars.length} enabled calendar(s)`);

  const client = await createCalDavClient(account);

  for (const calendar of calendars) {
    try {
      const result = await syncCalendar(client, account, calendar);
      totals.pulled += result.pulled;
      totals.pushed += result.pushed;
      totals.deleted += result.deleted;
      totals.conflicts += result.conflicts;
      totals.errors.push(...result.errors);
    } catch (error) {
      totals.errors.push(
        `Calendar ${calendar.displayName || calendar.calendarUrl}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // Update lastSyncAt
  await prisma.calDavAccount.update({
    where: { id: account.id },
    data: { lastSyncAt: new Date() },
  });

  return totals;
}

/**
 * Sync a single calendar.
 */
async function syncCalendar(
  client: Awaited<ReturnType<typeof createCalDavClient>>,
  account: CalDavAccount,
  calendar: CalDavCalendar,
): Promise<SyncResult> {
  const result: SyncResult = {
    pulled: 0,
    pushed: 0,
    deleted: 0,
    conflicts: 0,
    errors: [],
  };

  // PULL phase
  if (calendar.syncDirection !== "PUSH_ONLY") {
    try {
      console.log(`[caldav-sync] Fetching from calendar "${calendar.displayName}" (${calendar.calendarUrl}), direction=${calendar.syncDirection}, componentType=${calendar.componentType}`);
      const { resources, deletedHrefs, newSyncToken } =
        await fetchChangedResources(client, calendar);

      // Process deletions from server
      for (const href of deletedHrefs) {
        try {
          const syncItem = await prisma.calDavSyncItem.findFirst({
            where: { calendarId: calendar.id, caldavHref: href },
          });
          if (syncItem) {
            if (syncItem.todoId) {
              await prisma.todo.delete({
                where: { id: syncItem.todoId },
              }).catch(() => {}); // May already be deleted
            }
            await prisma.calDavSyncItem.delete({
              where: { id: syncItem.id },
            });
            result.deleted++;
          }
        } catch (error) {
          result.errors.push(
            `Delete ${href}: ${error instanceof Error ? error.message : "Unknown"}`,
          );
        }
      }

      // Process changed/new resources
      console.log(`[caldav-sync] Pull: ${resources.length} resources from calendar "${calendar.displayName || calendar.calendarUrl}" (componentType=${calendar.componentType})`);
      for (const resource of resources) {
        try {
          const parsed = icalToTodo(resource.icalData, calendar.componentType);
          if (!parsed) {
            console.warn(`[caldav-sync] Skipped resource ${resource.href}: icalToTodo returned null (componentType=${calendar.componentType})`);
            console.warn(`[caldav-sync] Resource data preview: ${resource.icalData.substring(0, 200)}`);
            continue;
          }

          const existingItem = await prisma.calDavSyncItem.findFirst({
            where: { calendarId: calendar.id, caldavUid: parsed.uid },
          });

          // Check for conflict
          if (
            existingItem &&
            existingItem.locallyModifiedAt &&
            existingItem.lastSyncedAt &&
            existingItem.locallyModifiedAt > existingItem.lastSyncedAt
          ) {
            // Check if server actually changed since last sync
            const serverUnchanged =
              (existingItem.caldavEtag && existingItem.caldavEtag === resource.etag) ||
              (existingItem.lastSyncedIcal && existingItem.lastSyncedIcal === resource.icalData);

            if (serverUnchanged) {
              // Only local side changed — skip, let push phase handle it
              continue;
            }

            // Both sides truly changed — conflict
            await prisma.calDavSyncItem.update({
              where: { id: existingItem.id },
              data: {
                conflictState: "PENDING_RESOLUTION",
                serverIcalOnConflict: resource.icalData,
                caldavEtag: resource.etag,
              },
            });
            result.conflicts++;
            continue;
          }

          // Apply server version to local
          const due = parsed.due || parsed.dtstart;
          const todoData = {
            title: parsed.title,
            description: parsed.description,
            dtstart: parsed.dtstart,
            due,
            rrule: parsed.rrule,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            exdates: serializeExdates(parsed.exdates) as any,
            priority: parsed.priority as Priority,
            completed: parsed.completed,
            pinned: parsed.pinned,
            durationMinutes: Math.round(
              (due.getTime() - parsed.dtstart.getTime()) / (1000 * 60),
            ) || 30,
          };

          let todoId: string;

          if (existingItem?.todoId) {
            // Update existing todo
            await prisma.todo.update({
              where: { id: existingItem.todoId },
              data: todoData,
            });
            todoId = existingItem.todoId;
          } else {
            // Create new todo
            const nextOrder = await getNextTodoOrder(account.userID);
            const todo = await prisma.todo.create({
              data: {
                ...todoData,
                userID: account.userID,
                projectID: calendar.projectId,
                order: nextOrder ?? parsed.order ?? undefined,
              },
            });
            todoId = todo.id;
          }

          // Handle instance overrides
          for (const inst of parsed.instances) {
            await prisma.todoInstance.upsert({
              where: {
                todoId_instanceDate: {
                  todoId,
                  instanceDate: inst.recurrenceId,
                },
              },
              update: {
                overriddenTitle: inst.title,
                overriddenDescription: inst.description,
                overriddenPriority: inst.priority,
                overriddenDtstart: inst.dtstart,
                overriddenDue: inst.due,
                completedAt: inst.completedAt,
              },
              create: {
                todoId,
                recurId: inst.recurrenceId.toISOString(),
                instanceDate: inst.recurrenceId,
                overriddenTitle: inst.title,
                overriddenDescription: inst.description,
                overriddenPriority: inst.priority,
                overriddenDtstart: inst.dtstart,
                overriddenDue: inst.due,
                completedAt: inst.completedAt,
              },
            });
          }

          // Upsert sync item
          if (existingItem) {
            await prisma.calDavSyncItem.update({
              where: { id: existingItem.id },
              data: {
                caldavEtag: resource.etag,
                lastSyncedIcal: resource.icalData,
                lastSyncedAt: new Date(),
                locallyModifiedAt: null,
                todoId,
              },
            });
          } else {
            await prisma.calDavSyncItem.create({
              data: {
                calendarId: calendar.id,
                caldavUid: parsed.uid,
                caldavEtag: resource.etag,
                caldavHref: resource.href,
                lastSyncedIcal: resource.icalData,
                lastSyncedAt: new Date(),
                todoId,
              },
            });
          }

          result.pulled++;
        } catch (error) {
          result.errors.push(
            `Pull ${resource.href}: ${error instanceof Error ? error.message : "Unknown"}`,
          );
        }
      }

      // Update sync token
      if (newSyncToken) {
        await prisma.calDavCalendar.update({
          where: { id: calendar.id },
          data: { syncToken: newSyncToken },
        });
      }
    } catch (error) {
      result.errors.push(
        `Pull phase: ${error instanceof Error ? error.message : "Unknown"}`,
      );
    }
  }

  // PUSH phase
  if (calendar.syncDirection !== "PULL_ONLY") {
    try {
      // Find locally modified items that need pushing
      // Items with locallyModifiedAt set are pending push
      const modifiedItems = await prisma.calDavSyncItem.findMany({
        where: {
          calendarId: calendar.id,
          conflictState: "NONE",
          locallyModifiedAt: { not: null },
        },
        include: {
          todo: {
            include: {
              instances: true,
              project: { select: { name: true } },
            },
          },
        },
      });

      for (const item of modifiedItems) {
        try {
          if (!item.todo) {
            // Todo was deleted locally — send DELETE to server
            try {
              await deleteResource(client, item.caldavHref, item.caldavEtag || undefined);
            } catch {
              // May already be gone from server
            }
            await prisma.calDavSyncItem.delete({
              where: { id: item.id },
            });
            result.deleted++;
            continue;
          }

          const tatsuTodo: LocalTodo = {
            id: item.todo.id,
            title: item.todo.title,
            description: item.todo.description,
            dtstart: item.todo.dtstart,
            due: item.todo.due,
            rrule: item.todo.rrule,
            exdates: deserializeExdates(item.todo.exdates),
            priority: item.todo.priority,
            completed: item.todo.completed,
            pinned: item.todo.pinned,
            order: item.todo.order,
            timeZone: item.todo.timeZone,
            projectName: item.todo.project?.name || null,
            durationMinutes: item.todo.durationMinutes,
          };

          const instances: LocalTodoInstance[] = item.todo.instances.map(
            (inst) => ({
              id: inst.id,
              todoId: inst.todoId,
              instanceDate: inst.instanceDate,
              overriddenTitle: inst.overriddenTitle,
              overriddenDescription: inst.overriddenDescription,
              overriddenPriority: inst.overriddenPriority,
              overriddenDtstart: inst.overriddenDtstart,
              overriddenDue: inst.overriddenDue,
              overriddenDurationMinutes: inst.overriddenDurationMinutes,
              completedAt: inst.completedAt,
            }),
          );

          const icalData = todoToIcal(
            tatsuTodo,
            instances,
            calendar.componentType,
            item.caldavUid,
          );

          try {
            const { newEtag, href } = await putResource(
              client,
              calendar.calendarUrl,
              item.caldavHref,
              icalData,
              item.caldavEtag || undefined,
            );

            await prisma.calDavSyncItem.update({
              where: { id: item.id },
              data: {
                caldavEtag: newEtag,
                caldavHref: href,
                lastSyncedIcal: icalData,
                lastSyncedAt: new Date(),
                locallyModifiedAt: null,
              },
            });

            result.pushed++;
          } catch (error) {
            if (
              error instanceof Error &&
              error.message === "PRECONDITION_FAILED"
            ) {
              // Server changed since last sync — mark as conflict
              await prisma.calDavSyncItem.update({
                where: { id: item.id },
                data: { conflictState: "PENDING_RESOLUTION" },
              });
              result.conflicts++;
            } else {
              throw error;
            }
          }
        } catch (error) {
          result.errors.push(
            `Push ${item.caldavHref}: ${error instanceof Error ? error.message : "Unknown"}`,
          );
        }
      }

      // Push new todos that don't have sync items yet
      // If calendar is linked to a project, only push todos from that project.
      // Otherwise, push all unsynced todos for this user.
      {
        const unsyncedTodos = await prisma.todo.findMany({
          where: {
            ...(calendar.projectId ? { projectID: calendar.projectId } : {}),
            userID: account.userID,
            syncItems: { none: {} },
          },
          include: {
            instances: true,
            project: { select: { name: true } },
          },
        });

        for (const todo of unsyncedTodos) {
          try {
            const tatsuTodo: LocalTodo = {
              id: todo.id,
              title: todo.title,
              description: todo.description,
              dtstart: todo.dtstart,
              due: todo.due,
              rrule: todo.rrule,
              exdates: deserializeExdates(todo.exdates),
              priority: todo.priority,
              completed: todo.completed,
              pinned: todo.pinned,
              order: todo.order,
              timeZone: todo.timeZone,
              projectName: todo.project?.name || null,
              durationMinutes: todo.durationMinutes,
            };

            const instances: LocalTodoInstance[] = todo.instances.map(
              (inst) => ({
                id: inst.id,
                todoId: inst.todoId,
                instanceDate: inst.instanceDate,
                overriddenTitle: inst.overriddenTitle,
                overriddenDescription: inst.overriddenDescription,
                overriddenPriority: inst.overriddenPriority,
                overriddenDtstart: inst.overriddenDtstart,
                overriddenDue: inst.overriddenDue,
                overriddenDurationMinutes: inst.overriddenDurationMinutes,
                completedAt: inst.completedAt,
              }),
            );

            const uid = `tatsu-${todo.id}`;
            const filename = `${uid}.ics`;
            const icalData = todoToIcal(
              tatsuTodo,
              instances,
              calendar.componentType,
              uid,
            );

            const { newEtag, href } = await putResource(
              client,
              calendar.calendarUrl,
              filename,
              icalData,
            );

            await prisma.calDavSyncItem.create({
              data: {
                calendarId: calendar.id,
                caldavUid: uid,
                caldavEtag: newEtag,
                caldavHref: href,
                lastSyncedIcal: icalData,
                lastSyncedAt: new Date(),
                todoId: todo.id,
              },
            });

            result.pushed++;
          } catch (error) {
            result.errors.push(
              `Push new ${todo.id}: ${error instanceof Error ? error.message : "Unknown"}`,
            );
          }
        }
      }
    } catch (error) {
      result.errors.push(
        `Push phase: ${error instanceof Error ? error.message : "Unknown"}`,
      );
    }
  }

  return result;
}

/**
 * Sync all enabled accounts for a user.
 */
export async function syncAllForUser(userId: string): Promise<SyncResult> {
  const accounts = await prisma.calDavAccount.findMany({
    where: { userID: userId, syncEnabled: true },
  });

  const totals: SyncResult = {
    pulled: 0,
    pushed: 0,
    deleted: 0,
    conflicts: 0,
    errors: [],
  };

  for (const account of accounts) {
    try {
      const result = await syncAccount(account);
      totals.pulled += result.pulled;
      totals.pushed += result.pushed;
      totals.deleted += result.deleted;
      totals.conflicts += result.conflicts;
      totals.errors.push(...result.errors);
    } catch (error) {
      totals.errors.push(
        `Account ${account.displayName}: ${error instanceof Error ? error.message : "Unknown"}`,
      );
    }
  }

  return totals;
}
