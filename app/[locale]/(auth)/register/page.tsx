import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma/client";
import RegisterPage from "./Register";

export default async function Page() {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    redirect("/login");
  }
  return <RegisterPage />;
}
