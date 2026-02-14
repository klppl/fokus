import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { BadRequestError } from "@/lib/customError";
import { errorHandler } from "@/lib/errorHandler";
import { verifyAdminPassword, getSingleUser } from "@/lib/admin";
import { sha256 } from "@noble/hashes/sha256";
import { pbkdf2 } from "@noble/hashes/pbkdf2";
import { randomBytes, bytesToHex } from "@noble/hashes/utils";

export async function POST(req: NextRequest) {
  try {
    verifyAdminPassword(req);
    const user = await getSingleUser();

    const body = await req.json();
    const { newPassword } = body;

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      throw new BadRequestError("Password must be at least 6 characters");
    }

    const salt = randomBytes(16);
    const saltHex = bytesToHex(salt);
    const passwordHash = pbkdf2(sha256, newPassword, salt, {
      c: 10000,
      dkLen: 32,
    });
    const passwordHex = bytesToHex(passwordHash);
    const hashedPassword = `${saltHex}:${passwordHex}`;

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return NextResponse.json({
      message: "Password reset successfully",
      email: user.email,
    });
  } catch (error) {
    return errorHandler(error);
  }
}
