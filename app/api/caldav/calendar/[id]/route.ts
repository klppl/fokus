import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/auth";
import { UnauthorizedError, BadRequestError } from "@/lib/customError";
import { prisma } from "@/lib/prisma/client";
import { calDavCalendarPatchSchema } from "@/schema";
import { errorHandler } from "@/lib/errorHandler";

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
    if (!id) throw new BadRequestError("Calendar ID is required");

    // Verify ownership through account
    const calendar = await prisma.calDavCalendar.findFirst({
      where: { id },
      include: { account: { select: { userID: true } } },
    });
    if (!calendar || calendar.account.userID !== user.id)
      throw new BadRequestError("Calendar not found");

    const body = await req.json();
    const parsed = calDavCalendarPatchSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestError(parsed.error.errors[0].message);

    const updated = await prisma.calDavCalendar.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(
      { message: "Calendar updated", calendar: updated },
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
    if (!id) throw new BadRequestError("Calendar ID is required");

    const calendar = await prisma.calDavCalendar.findFirst({
      where: { id },
      include: { account: { select: { userID: true } } },
    });
    if (!calendar || calendar.account.userID !== user.id)
      throw new BadRequestError("Calendar not found");

    await prisma.calDavCalendar.delete({ where: { id } });

    return NextResponse.json(
      { message: "Calendar removed from sync" },
      { status: 200 },
    );
  } catch (error) {
    return errorHandler(error);
  }
}
