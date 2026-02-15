import React from "react";
import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import OverDueTodoContainer from "@/features/overdueTodos/component/OverDueTodoContainer";
import TodayTodoContainer from "@/features/todayTodos/component/TodayTodoContainer";
import UpcomingDaySection from "@/features/todayTodos/component/UpcomingDaySection";
import { OverdueDragProvider } from "@/providers/OverdueDragProvider";
import { getOverdueTodos, getUpcomingTodos } from "./actions";
import { getUserPreferences } from "@/app/[locale]/app/actions";

const Page = async () => {
  const queryClient = new QueryClient();
  const preferences = await getUserPreferences();
  const upcomingDays = preferences?.upcomingDays ?? 0;

  const prefetchPromises: Promise<void>[] = [
    queryClient.prefetchQuery({
      queryKey: ["overdueTodo"],
      queryFn: getOverdueTodos,
    }),
  ];

  for (let i = 1; i <= upcomingDays; i++) {
    const offset = i;
    prefetchPromises.push(
      queryClient.prefetchQuery({
        queryKey: ["upcomingTodo", offset],
        queryFn: () => getUpcomingTodos(offset),
      }),
    );
  }

  await Promise.all(prefetchPromises);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OverdueDragProvider>
        <div className="select-none bg-inherit mt-4">
          <OverDueTodoContainer />
          <TodayTodoContainer />
          {Array.from({ length: upcomingDays }, (_, i) => (
            <UpcomingDaySection key={i + 1} dayOffset={i + 1} />
          ))}
        </div>
      </OverdueDragProvider>
    </HydrationBoundary>
  );
};

export default Page;
