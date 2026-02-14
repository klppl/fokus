import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/auth";
import { UnauthorizedError, BadRequestError } from "@/lib/customError";
import { prisma } from "@/lib/prisma/client";
import { errorHandler } from "@/lib/errorHandler";
import { encryptPassword } from "@/lib/caldav/crypto";
import { z } from "zod";

const patchSchema = z.object({
  displayName: z.string().trim().min(1).optional(),
  serverUrl: z.string().trim().url().optional(),
  username: z.string().trim().min(1).optional(),
  password: z.string().min(1).optional(),
  syncEnabled: z.boolean().optional(),
  syncIntervalMin: z.number().min(5).max(1440).optional(),
});

export async function PATCH(
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

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestError(parsed.error.errors[0].message);

    // Verify ownership
    const existing = await prisma.calDavAccount.findFirst({
      where: { id, userID: user.id },
    });
    if (!existing) throw new BadRequestError("Account not found");

    const { password, ...rest } = parsed.data;

    const updateData: Record<string, unknown> = { ...rest };
    if (password) {
      const { encrypted, iv } = encryptPassword(password);
      updateData.encryptedPassword = encrypted;
      updateData.passwordIV = iv;
    }

    const account = await prisma.calDavAccount.update({
      where: { id },
      data: updateData,
      include: { calendars: true },
    });

    const sanitized = { ...account, encryptedPassword: undefined, passwordIV: undefined };

    return NextResponse.json(
      { message: "Account updated", account: sanitized },
      { status: 200 },
    );
  } catch (error) {
    return errorHandler(error);
  }
}

export async function DELETE(
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

    // Verify ownership
    const existing = await prisma.calDavAccount.findFirst({
      where: { id, userID: user.id },
    });
    if (!existing) throw new BadRequestError("Account not found");

    await prisma.calDavAccount.delete({ where: { id } });

    return NextResponse.json(
      { message: "Account deleted" },
      { status: 200 },
    );
  } catch (error) {
    return errorHandler(error);
  }
}
