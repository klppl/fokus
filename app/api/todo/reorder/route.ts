import { auth } from "@/app/auth";
import {
  UnauthorizedError,
  BadRequestError,
  InternalError,
  BaseServerError,
} from "@/lib/customError";
import { reorderTodos } from "@/lib/prisma/db-adapter";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user?.id)
      throw new UnauthorizedError("You must be logged in to do this");

    const changeMap: { id: string; order: number }[] = await req.json();
    if (!changeMap) throw new BadRequestError("Invalid request body");

    //run all updates in bulk
    const updatedTodos = await reorderTodos(changeMap);
    // Check if all updates were successful
    const allUpdated = updatedTodos === changeMap.length;

    if (!allUpdated) {
      throw new InternalError("Failed to update todo order");
    }

    return NextResponse.json({ message: "Todo updated" }, { status: 200 });
  } catch (error) {
    console.log(error);

    if (error instanceof BaseServerError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message.slice(0, 50)
            : "An unexpected error occurred",
      },
      { status: 500 },
    );
  }
}
