import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma/client";
import { sha256 } from "@noble/hashes/sha256";
import { pbkdf2 } from "@noble/hashes/pbkdf2";
import { hexToBytes, bytesToHex } from "@noble/hashes/utils";
import type { Adapter } from "next-auth/adapters";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma) as Adapter,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        const { email, password } = credentials as {
          email: string;
          password: string;
        };

        let user = null;

        // Find the user
        user = await prisma.user.findUnique({
          where: { email: email },
        });

        if (!user || !user.password) {
          throw new Error("Invalid credentials.");
        }

        try {
          // Check if this is a new format password (has a colon separator)
          if (user.password.includes(":")) {
            // Split the stored password to get the salt and hash
            const [saltHex, storedHashHex] = user.password.split(":");
            const salt = hexToBytes(saltHex);

            // Recreate the hash with the provided password and stored salt
            const calculatedHash = pbkdf2(sha256, password, salt, {
              c: 10000,
              dkLen: 32,
            });
            const calculatedHex = bytesToHex(calculatedHash);

            // Compare calculated hash with stored hash
            if (calculatedHex !== storedHashHex) {
              throw new Error("Invalid credentials.");
            }
          } else {
            throw new Error("Invalid password format. Please reset your password.");
          }

          return user;
        } catch {
          throw new Error("Authentication failed.");
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.timeZone = user.timeZone;
        if (account?.provider === "credentials") {
          token.name = user.name;
        }
      }

      // Verify the user still exists in the database
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { id: true },
        });
        if (!dbUser) {
          return { ...token, id: null };
        }
      }

      return token;
    },
    session({ session, token }) {
      if (!token.id) {
        // User was deleted — invalidate the session
        session.user = undefined as unknown as typeof session.user;
        return session;
      }
      session.user.id = token.id as string;
      session.user.timeZone = token.timeZone
      return session;
    },
  },
});
