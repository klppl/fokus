import { redirect } from "next/navigation";
import { auth } from "@/app/auth";
import { prisma } from "@/lib/prisma/client";

import LoginPage from "./Login";
const page = async () => {
  const session = await auth();
  if (session?.user) {
    redirect("/app/todo");
  }

  const userCount = await prisma.user.count();
  if (userCount === 0) {
    redirect("/register");
  }

  return <LoginPage />;
};
export default page;
