import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/auth";
import { UnauthorizedError, BadRequestError } from "@/lib/customError";
import { prisma } from "@/lib/prisma/client";
import { errorHandler } from "@/lib/errorHandler";
import { calDavSyncConflictResolutionSchema } from "@/schema";
import { icalToTodo } from "@/lib/caldav/ical-converter";
import { Priority } from "@prisma/client";
import { serializeExdates } from "@/lib/prisma/db-adapter";

export async function GET() {
  try {
    const session = await auth();
    const user = session?.user;
    if (!user?.id)
      throw new UnauthorizedError("You must be logged in to do this");

    const conflicts = await prisma.calDavSyncItem.findMany({
      where: {
        conflictState: "PENDING_RESOLUTION",
        calendar: {
          account: { userID: user.id },
        },
      },
      include: {
        todo: {
          select: {
            title: true,
            description: true,
            dtstart: true,
            due: true,
            priority: true,
          },
        },
        calendar: {
          select: { componentType: true },
        },
      },
    });

    const formatted = conflicts.map((c) => ({
      id: c.id,
      caldavUid: c.caldavUid,
      caldavHref: c.caldavHref,
      todoId: c.todoId,
      localTodo: c.todo,
      serverIcalOnConflict: c.serverIcalOnConflict,
      conflictState: c.conflictState,
    }));

    return NextResponse.json({ conflicts: formatted }, { status: 200 });
  } catch (error) {
    return errorHandler(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const user = session?.user;
    if (!user?.id)
      throw new UnauthorizedError("You must be logged in to do this");

    const body = await req.json();
    const parsed = calDavSyncConflictResolutionSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestError(parsed.error.errors[0].message);

    const { syncItemId, resolution } = parsed.data;

    // Verify ownership
    const syncItem = await prisma.calDavSyncItem.findFirst({
      where: {
        id: syncItemId,
        calendar: {
          account: { userID: user.id },
        },
      },
      include: {
        calendar: { select: { componentType: true } },
      },
    });
    if (!syncItem) throw new BadRequestError("Sync item not found");

    if (resolution === "LOCAL_WINS") {
      // Keep local version, mark for push
      await prisma.calDavSyncItem.update({
        where: { id: syncItemId },
        data: {
          conflictState: "NONE",
          locallyModifiedAt: new Date(),
          serverIcalOnConflict: null,
        },
      });
    } else {
      // SERVER_WINS: apply server version
      if (syncItem.serverIcalOnConflict && syncItem.todoId) {
        const parsed = icalToTodo(
          syncItem.serverIcalOnConflict,
          syncItem.calendar.componentType,
        );
        if (parsed) {
          await prisma.todo.update({
            where: { id: syncItem.todoId },
            data: {
              title: parsed.title,
              description: parsed.description,
              dtstart: parsed.dtstart,
              due: parsed.due || parsed.dtstart,
              rrule: parsed.rrule,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              exdates: serializeExdates(parsed.exdates) as any,
              priority: parsed.priority as Priority,
              completed: parsed.completed,
              pinned: parsed.pinned,
            },
          });
        }
      }

      await prisma.calDavSyncItem.update({
        where: { id: syncItemId },
        data: {
          conflictState: "NONE",
          locallyModifiedAt: null,
          lastSyncedAt: new Date(),
          serverIcalOnConflict: null,
          lastSyncedIcal: syncItem.serverIcalOnConflict,
        },
      });
    }

    return NextResponse.json(
      { message: "Conflict resolved" },
      { status: 200 },
    );
  } catch (error) {
    return errorHandler(error);
  }
}
