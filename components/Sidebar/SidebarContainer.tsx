"use client"
import clsx from "clsx";
import React, { useRef, useState } from "react";
import { useMenu } from "@/providers/MenuProvider";
import CalendarItem from "./Calendar/CalendarItem";
import CompletedItem from "./Completed/CompletedItem";
import NoteCollapsible from "./Note/NoteCollapsible";
import TodoItem from "./Todo/TodoSidebarItem";
import AllTasksSidebarItem from "./Todo/AllTasksSidebarItem";
import UserCard from "./User/UserCard";
import ProjectSidebarItemContainer from "./Project/ProjectsSidebarItemContainer";
import LineSeparator from "../ui/lineSeparator";
import SyncStatusIndicator from "./Settings/SyncStatusIndicator";
import { Link } from "@/i18n/navigation";
import { Settings2Icon } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SidebarContainer = () => {
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const { isResizing, setIsResizing, showMenu } = useMenu();
  const [sidebarWidth, setSidebarWidth] = useState(350);

  const startResizing = React.useCallback(() => {
    setIsResizing(true);
  }, [setIsResizing]);

  const stopResizing = React.useCallback(() => {
    setIsResizing(false);
  }, [setIsResizing]);

  const resize = React.useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing) {
        setSidebarWidth(
          mouseMoveEvent.clientX -
          sidebarRef.current!.getBoundingClientRect().left,
        );
      }
    },
    [isResizing],
  );

  React.useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  return (
    <>
      <Overlay />
      <nav
        id="sidebar_container"
        ref={sidebarRef}
        className={clsx(
          "flex h-full fixed inset-0 xl:relative w-full xl:max-w-125 shrink-0 bg-sidebar z-20 duration-200",
          !showMenu
            ? "-translate-x-full min-w-0 overflow-hidden transition-all"
            : "min-w-50 transition-transform overflow-visible",
        )}
        style={{ width: showMenu ? `min(100vw, ${sidebarWidth}px)` : "0px" }}
        onMouseDown={(e) => {
          if (isResizing) e.preventDefault();
        }}
      >
        <div className="flex flex-col justify-between flex-1 min-w-0 m-0 p-0">
          <div className="px-4 mt-2">
            <div className="flex items-baseline gap-2 mb-2 px-2">
              <span className="text-lg font-semibold text-foreground">fokus</span>
              <span className="text-xs text-muted-foreground">Simply sorted.</span>
            </div>
            <UserCard />
          </div>
          <div className="flex flex-col gap-1 overflow-y-scroll   h-full  my-2 px-4 text-muted-foreground">
            <TodoItem />
            <AllTasksSidebarItem />
            <CompletedItem />
            <CalendarItem />
            <NoteCollapsible />
            <LineSeparator className="m-0 mt-8 mb-4" />
            <ProjectSidebarItemContainer />
          </div>
          <div className="flex items-center gap-3 px-4 pb-3">
            <SyncStatusIndicator />
            <Link
              href="/admin"
              className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <Settings2Icon className="w-3.5 h-3.5" />
              <span>Admin</span>
            </Link>
          </div>
        </div>
      </nav>
      <ResizeHandle isResizing={isResizing} startResizing={startResizing} />
    </>
  );
};

export default SidebarContainer;

const Overlay = () => {
  const { showMenu, setShowMenu } = useMenu();
  return (
    <div
      className={clsx(
        "fixed w-screen h-screen bg-black z-10 xl:hidden opacity-50",
        !showMenu && "hidden",
      )}
      onClick={() => setShowMenu(false)}
    />
  );
};

const ResizeHandle = ({
  isResizing,
  startResizing,
}: {
  isResizing: boolean;
  startResizing: () => void;
}) => {
  return (
    <div
      className={clsx(
        "hidden xl:block w-1 cursor-col-resize hover:bg-border",
        isResizing && "bg-border",
      )}
      onMouseDown={startResizing}
    />
  );
};
