import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { UnauthorizedError, BadRequestError } from "@/lib/customError";

export function verifyAdminPassword(req: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new BadRequestError("ADMIN_PASSWORD is not configured on the server");
  }

  const providedPassword = req.headers.get("x-admin-password");
  if (!providedPassword || providedPassword !== adminPassword) {
    throw new UnauthorizedError("Invalid admin password");
  }
}

export async function getSingleUser() {
  const user = await prisma.user.findFirst();
  if (!user) {
    throw new BadRequestError("No user found in the database");
  }
  return user;
}
