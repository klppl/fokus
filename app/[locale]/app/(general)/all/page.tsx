import React from "react";
import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import AllTodoContainer from "@/features/allTodos/component/AllTodoContainer";
import { getAllTodos } from "./actions";

const Page = async () => {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["allTodo", 4],
    queryFn: () => getAllTodos(4),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="select-none bg-inherit mt-4">
        <AllTodoContainer />
      </div>
    </HydrationBoundary>
  );
};

export default Page;
