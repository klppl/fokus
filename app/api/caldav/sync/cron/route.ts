import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { syncAccount } from "@/lib/caldav/sync-engine";
import { CalDavAccount } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CALDAV_CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 },
      );
    }

    // Find all accounts due for sync
    const now = new Date();
    const accounts = await prisma.calDavAccount.findMany({
      where: {
        syncEnabled: true,
        OR: [
          { lastSyncAt: null },
          {
            lastSyncAt: {
              lt: new Date(now.getTime() - 15 * 60 * 1000), // At least 15 min since last sync
            },
          },
        ],
      },
    });

    const results = [];
    for (const account of accounts) {
      try {
        const result = await syncAccount(account as CalDavAccount);
        results.push({
          accountId: account.id,
          displayName: account.displayName,
          ...result,
        });
      } catch (error) {
        results.push({
          accountId: account.id,
          displayName: account.displayName,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Log the cron run
    await prisma.cronLog.create({
      data: {
        runAt: now,
        success: true,
        log: `CalDAV sync: ${accounts.length} accounts processed`,
      },
    });

    return NextResponse.json(
      {
        message: `Synced ${accounts.length} accounts`,
        results,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Cron sync failed",
      },
      { status: 500 },
    );
  }
}
