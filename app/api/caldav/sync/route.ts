import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/auth";
import { UnauthorizedError } from "@/lib/customError";
import { prisma } from "@/lib/prisma/client";
import { errorHandler } from "@/lib/errorHandler";
import { syncAccount, syncAllForUser } from "@/lib/caldav/sync-engine";
import { CalDavAccount } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const user = session?.user;
    if (!user?.id)
      throw new UnauthorizedError("You must be logged in to do this");

    const body = await req.json().catch(() => ({}));
    const { accountId } = body;

    let result;
    if (accountId) {
      const account = await prisma.calDavAccount.findFirst({
        where: { id: accountId, userID: user.id },
      });
      if (!account) {
        return NextResponse.json(
          { message: "Account not found" },
          { status: 404 },
        );
      }
      result = await syncAccount(account as CalDavAccount);
    } else {
      result = await syncAllForUser(user.id);
    }

    console.log(`[caldav-sync] Result:`, JSON.stringify(result));
    return NextResponse.json(
      {
        message: `Sync complete: ${result.pulled} pulled, ${result.pushed} pushed, ${result.deleted} deleted, ${result.conflicts} conflicts`,
        result,
      },
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
      select: { lastSyncAt: true },
    });

    const conflictCount = await prisma.calDavSyncItem.count({
      where: {
        conflictState: "PENDING_RESOLUTION",
        calendar: {
          account: { userID: user.id },
        },
      },
    });

    const totalSyncItems = await prisma.calDavSyncItem.count({
      where: {
        calendar: {
          account: { userID: user.id },
        },
      },
    });

    const lastSyncAt = accounts.reduce<Date | null>((latest, acc) => {
      if (!acc.lastSyncAt) return latest;
      if (!latest || acc.lastSyncAt > latest) return acc.lastSyncAt;
      return latest;
    }, null);

    return NextResponse.json(
      {
        status: {
          lastSyncAt,
          conflictCount,
          totalSyncItems,
          accountCount: accounts.length,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return errorHandler(error);
  }
}
