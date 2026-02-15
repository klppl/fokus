"use client";
import React from "react";
import { useUpcomingTodos } from "../query/get-upcoming-todos";
import TodoGroup from "@/components/todo/component/TodoGroup";
import LineSeparator from "@/components/ui/lineSeparator";
import { useTranslations } from "next-intl";
import { addDays } from "date-fns";
import { useCompleteTodo } from "../query/complete-todo";
import { useDeleteTodo } from "../query/delete-todo";
import { useEditTodo } from "../query/update-todo";
import { useEditTodoInstance } from "../query/update-todo-instance";
import { usePinTodo } from "../query/pin-todo";
import { usePrioritizeTodo } from "../query/prioritize-todo";
import { useReorderTodo } from "../query/reorder-todo";
import TodoMutationProvider from "@/providers/TodoMutationProvider";
import TodoListLoading from "@/components/todo/component/TodoListLoading";
import { useLocale } from "next-intl";

const UpcomingDaySection = ({ dayOffset }: { dayOffset: number }) => {
  const { todos, isLoading } = useUpcomingTodos(dayOffset);
  const appDict = useTranslations("app");
  const locale = useLocale();

  const targetDate = addDays(new Date(), dayOffset);
  const label =
    dayOffset === 1
      ? appDict("tomorrow")
      : new Intl.DateTimeFormat(locale, { weekday: "long", month: "short", day: "numeric" }).format(targetDate);

  return (
    <TodoMutationProvider
      useCompleteTodo={useCompleteTodo}
      useDeleteTodo={useDeleteTodo}
      useEditTodo={useEditTodo}
      useEditTodoInstance={useEditTodoInstance}
      usePinTodo={usePinTodo}
      usePrioritizeTodo={usePrioritizeTodo}
      useReorderTodo={useReorderTodo}
    >
      <div className="mt-10">
        <h3 className="text-xl font-semibold select-none text-muted-foreground">
          {label}
        </h3>
        <LineSeparator className="flex-1" />
        {isLoading && <TodoListLoading />}
        {!isLoading && todos.length === 0 && (
          <p className="text-muted-foreground text-sm py-2 select-none">—</p>
        )}
        {todos.length > 0 && (
          <TodoGroup
            todos={todos}
            className="flex flex-col bg-transparent gap-1"
          />
        )}
      </div>
    </TodoMutationProvider>
  );
};

export default UpcomingDaySection;
