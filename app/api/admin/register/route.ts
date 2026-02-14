import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { BadRequestError } from "@/lib/customError";
import { errorHandler } from "@/lib/errorHandler";
import { verifyAdminPassword } from "@/lib/admin";
import { registrationSchema } from "@/schema";
import { sha256 } from "@noble/hashes/sha256";
import { pbkdf2 } from "@noble/hashes/pbkdf2";
import { randomBytes, bytesToHex } from "@noble/hashes/utils";

export async function POST(req: NextRequest) {
  try {
    verifyAdminPassword(req);

    const existingUser = await prisma.user.count();
    if (existingUser > 0) {
      throw new BadRequestError("A user already exists. Use password reset instead.");
    }

    const body = await req.json();
    const parsed = registrationSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message || "Invalid input";
      throw new BadRequestError(firstError);
    }

    const { fname, lname, email, password } = parsed.data;

    const salt = randomBytes(16);
    const saltHex = bytesToHex(salt);
    const passwordHash = pbkdf2(sha256, password, salt, {
      c: 10000,
      dkLen: 32,
    });
    const passwordHex = bytesToHex(passwordHash);
    const hashedPassword = `${saltHex}:${passwordHex}`;

    const name = lname ? `${fname} ${lname}` : fname;

    await prisma.user.create({
      data: { name, email, password: hashedPassword },
    });

    return NextResponse.json({ message: "User registered successfully", email });
  } catch (error) {
    return errorHandler(error);
  }
}
