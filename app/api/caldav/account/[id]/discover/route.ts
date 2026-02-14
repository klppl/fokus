import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/auth";
import { UnauthorizedError, BadRequestError } from "@/lib/customError";
import { prisma } from "@/lib/prisma/client";
import { errorHandler } from "@/lib/errorHandler";
import { createCalDavClient, discoverCalendars } from "@/lib/caldav/client";
import { CalDavAccount } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    const user = session?.user;
    if (!user?.id)
      throw new UnauthorizedError("You must be logged in to do this");

    const { id } = await params;
    if (!id) throw new BadRequestError("Account ID is required");

    const account = await prisma.calDavAccount.findFirst({
      where: { id, userID: user.id },
    });
    if (!account) throw new BadRequestError("Account not found");

    const client = await createCalDavClient(account as CalDavAccount);
    const discovered = await discoverCalendars(client);

    // Get existing calendar URLs
    const existingCalendars = await prisma.calDavCalendar.findMany({
      where: { accountId: id },
      select: { calendarUrl: true },
    });
    const existingUrls = new Set(existingCalendars.map((c) => c.calendarUrl));

    // Create new calendars that don't already exist
    const newCalendars = [];
    for (const cal of discovered) {
      if (!existingUrls.has(cal.url)) {
        const created = await prisma.calDavCalendar.create({
          data: {
            accountId: id,
            calendarUrl: cal.url,
            displayName: cal.displayName,
            color: cal.color,
            ctag: cal.ctag,
            syncToken: cal.syncToken,
            componentType: cal.componentType,
          },
        });
        newCalendars.push(created);
      }
    }

    const allCalendars = await prisma.calDavCalendar.findMany({
      where: { accountId: id },
    });

    return NextResponse.json(
      {
        message: `Discovered ${discovered.length} calendars, ${newCalendars.length} new`,
        calendars: allCalendars,
      },
      { status: 200 },
    );
  } catch (error) {
    return errorHandler(error);
  }
}
