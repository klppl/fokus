import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";

export async function GET() {
  const userCount = await prisma.user.count();
  return NextResponse.json({ hasUser: userCount > 0 });
}
