import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { BadRequestError } from "@/lib/customError";
import { errorHandler } from "@/lib/errorHandler";
import { verifyAdminPassword, getSingleUser } from "@/lib/admin";

const VALID_TARGETS = [
  "todos",
  "notes",
  "projects",
  "caldav",
  "all",
] as const;
type PurgeTarget = (typeof VALID_TARGETS)[number];

async function purgeTodos(userID: string) {
  // Delete in order: CompletedTodo, TodoInstance, CalDavSyncItem (todo-linked), Todo
  const completedTodos = await prisma.completedTodo.deleteMany({
    where: { userID },
  });
  const instances = await prisma.todoInstance.deleteMany({
    where: { todo: { userID } },
  });
  // CalDavSyncItems linked to todos for this user
  await prisma.calDavSyncItem.deleteMany({
    where: { todo: { userID } },
  });
  const todos = await prisma.todo.deleteMany({ where: { userID } });
  return todos.count + completedTodos.count + instances.count;
}

async function purgeNotes(userID: string) {
  const result = await prisma.note.deleteMany({ where: { userID } });
  return result.count;
}

async function purgeProjects(userID: string) {
  const result = await prisma.project.deleteMany({ where: { userID } });
  return result.count;
}

async function purgeCalDav(userID: string) {
  // Cascade: CalDavSyncItem → CalDavCalendar → CalDavAccount
  // CalDavCalendar has onDelete: Cascade from Account, and SyncItem has onDelete: Cascade from Calendar
  const result = await prisma.calDavAccount.deleteMany({ where: { userID } });
  return result.count;
}

export async function POST(req: NextRequest) {
  try {
    verifyAdminPassword(req);
    const user = await getSingleUser();

    const body = await req.json();
    const target = body.target as PurgeTarget;

    if (!target || !VALID_TARGETS.includes(target)) {
      throw new BadRequestError(
        `Invalid target. Must be one of: ${VALID_TARGETS.join(", ")}`
      );
    }

    const counts = {
      todos: 0,
      notes: 0,
      projects: 0,
      caldavAccounts: 0,
    };

    if (target === "todos" || target === "all") {
      counts.todos = await purgeTodos(user.id);
    }
    if (target === "notes" || target === "all") {
      counts.notes = await purgeNotes(user.id);
    }
    if (target === "projects" || target === "all") {
      counts.projects = await purgeProjects(user.id);
    }
    if (target === "caldav" || target === "all") {
      counts.caldavAccounts = await purgeCalDav(user.id);
    }

    return NextResponse.json({
      message: `Purged ${target} successfully`,
      counts,
    });
  } catch (error) {
    return errorHandler(error);
  }
}
