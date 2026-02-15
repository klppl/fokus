"use server";

import { auth } from "@/app/auth";
import { UnauthorizedError } from "@/lib/customError";
import generateTodosFromRRule from "@/lib/generateTodosFromRRule";
import { getMovedInstances } from "@/lib/getMovedInstances";
import { overrideBy } from "@/lib/overrideBy";
import { prisma } from "@/lib/prisma/client";
import { resolveTimezone } from "@/lib/resolveTimeZone";
import { TodoItemType, recurringTodoItemType } from "@/types";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { startOfDay, addWeeks } from "date-fns";

export async function getAllTodos(weeks: number = 4): Promise<TodoItemType[]> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) {
    throw new UnauthorizedError("You must be logged in to do this");
  }
  const timeZone = await resolveTimezone(user);

  const nowInTz = toZonedTime(new Date(), timeZone);
  const todayStartLocal = startOfDay(nowInTz);
  const dateRangeStart = fromZonedTime(todayStartLocal, timeZone);
  const dateRangeEnd = fromZonedTime(addWeeks(todayStartLocal, weeks), timeZone);

  // Fetch all uncompleted one-off todos
  const oneOffTodos = await prisma.todo.findMany({
    where: {
      userID: user.id,
      rrule: null,
      completed: false,
      due: {
        gte: dateRangeStart,
      },
      dtstart: {
        lte: dateRangeEnd,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch all recurring todos
  const recurringParents = (await prisma.todo.findMany({
    where: {
      userID: user.id,
      rrule: { not: null },
      dtstart: { lte: dateRangeEnd },
      completed: false,
    },
    include: { instances: true },
  })) as unknown as recurringTodoItemType[];

  // Expand RRULEs to generate occurrences
  const ghostTodos = generateTodosFromRRule(recurringParents, timeZone, {
    dateRangeStart,
    dateRangeEnd,
  });

  // Apply overrides
  const mergedUsingRecurrId = overrideBy(ghostTodos, (inst) => inst.recurId);

  // Find out of range overrides
  const movedTodos = getMovedInstances(mergedUsingRecurrId, recurringParents, {
    dateRangeStart,
    dateRangeEnd,
  });

  const allGhosts = [...mergedUsingRecurrId, ...movedTodos].filter((todo) => {
    return todo.completed === false;
  });

  // Normalize one-off todos to match TodoItemType
  const normalizedOneOffTodos = oneOffTodos.map((todo) => ({
    ...todo,
    instanceDate: null as Date | null,
    instances: null as TodoItemType["instances"],
  }));

  const allTodos = [...normalizedOneOffTodos, ...allGhosts].sort(
    (a, b) => a.order - b.order,
  );

  const todoWithFormattedDates = allTodos.map((todo) => {
    const todoInstanceDate = todo.instanceDate
      ? new Date(todo.instanceDate)
      : null;
    const todoInstanceDateTime = todoInstanceDate?.getTime();
    const todoId = `${todo.id}:${todoInstanceDateTime}`;
    return {
      ...todo,
      id: todoId,
    };
  });

  return todoWithFormattedDates as unknown as TodoItemType[];
}
