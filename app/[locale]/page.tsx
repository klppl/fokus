import { auth } from "@/app/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma/client";

const Page = async () => {
  const session = await auth();
  if (session?.user) {
    redirect("/app/todo");
  }

  const userCount = await prisma.user.count();
  if (userCount === 0) {
    redirect("/register");
  }

  redirect("/login");
};

export default Page;
