import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/auth";
import { UnauthorizedError, BadRequestError } from "@/lib/customError";
import { prisma } from "@/lib/prisma/client";
import { errorHandler } from "@/lib/errorHandler";
import { createCalDavClient } from "@/lib/caldav/client";
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

    // Test the connection
    await createCalDavClient(account as CalDavAccount);

    return NextResponse.json(
      { message: "Connection successful", success: true },
      { status: 200 },
    );
  } catch (error) {
    return errorHandler(error);
  }
}
