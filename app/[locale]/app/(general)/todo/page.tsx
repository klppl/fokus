import React from "react";
import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import OverDueTodoContainer from "@/features/overdueTodos/component/OverDueTodoContainer";
import TodayTodoContainer from "@/features/todayTodos/component/TodayTodoContainer";
import { OverdueDragProvider } from "@/providers/OverdueDragProvider";
import { getOverdueTodos } from "./actions";
const Page = async () => {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["overdueTodo"],
    queryFn: getOverdueTodos
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OverdueDragProvider>
        <div className="select-none bg-inherit mt-4">
          <OverDueTodoContainer />
          <TodayTodoContainer />
        </div>
      </OverdueDragProvider>
    </HydrationBoundary>
  );
};

export default Page;
