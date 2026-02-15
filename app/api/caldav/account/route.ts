import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/auth";
import { UnauthorizedError, BadRequestError } from "@/lib/customError";
import { prisma } from "@/lib/prisma/client";
import { calDavAccountSchema } from "@/schema";
import { errorHandler } from "@/lib/errorHandler";
import { encryptPassword } from "@/lib/caldav/crypto";
import { createCalDavClient, discoverCalendars } from "@/lib/caldav/client";
import { CalDavAccount } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const user = session?.user;
    if (!user?.id)
      throw new UnauthorizedError("You must be logged in to do this");

    const body = await req.json();
    const parsed = calDavAccountSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestError(parsed.error.errors[0].message);

    const { displayName, serverUrl, username, password } = parsed.data;

    // Encrypt the password
    const { encrypted, iv } = encryptPassword(password);

    // Create account in DB
    const account = await prisma.calDavAccount.create({
      data: {
        userID: user.id,
        displayName,
        serverUrl,
        username,
        encryptedPassword: encrypted,
        passwordIV: iv,
      },
    });

    // Attempt discovery
    try {
      const client = await createCalDavClient(account as CalDavAccount);
      const discovered = await discoverCalendars(client);
      console.log(`[caldav-account] Discovered ${discovered.length} calendar(s) for "${displayName}"`);

      // Create calendar records
      for (const cal of discovered) {
        console.log(`[caldav-account] Creating calendar: "${cal.displayName}" type=${cal.componentType} url=${cal.url}`);
        await prisma.calDavCalendar.create({
          data: {
            accountId: account.id,
            calendarUrl: cal.url,
            displayName: cal.displayName,
            color: cal.color,
            ctag: cal.ctag,
            syncToken: cal.syncToken,
            componentType: cal.componentType,
          },
        });
      }
    } catch (err) {
      console.error(`[caldav-account] Discovery failed for "${displayName}":`, err instanceof Error ? err.message : err);
    }

    const accountWithCalendars = await prisma.calDavAccount.findUnique({
      where: { id: account.id },
      include: { calendars: true },
    });

    return NextResponse.json(
      { message: "CalDAV account created", account: accountWithCalendars },
      { status: 200 },
    );
  } catch (error) {
    return errorHandler(error);
  }
}

export async function GET() {
  try {
    const session = await auth();
    const user = session?.user;
    if (!user?.id)
      throw new UnauthorizedError("You must be logged in to do this");

    const accounts = await prisma.calDavAccount.findMany({
      where: { userID: user.id },
      include: {
        calendars: {
          include: {
            _count: {
              select: { items: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Strip encrypted password from response
    const sanitized = accounts.map((acc) => ({
      ...acc,
      encryptedPassword: undefined,
      passwordIV: undefined,
    }));

    return NextResponse.json({ accounts: sanitized }, { status: 200 });
  } catch (error) {
    return errorHandler(error);
  }
}
