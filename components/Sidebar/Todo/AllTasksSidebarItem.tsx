import clsx from "clsx";
import React from "react";
import { useMenu } from "@/providers/MenuProvider";
import { Link } from "@/i18n/navigation";
import useWindowSize from "@/hooks/useWindowSize";
import { ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

const AllTasksSidebarItem = () => {
  const appDict = useTranslations("app");
  const { width } = useWindowSize();
  const { activeMenu, setActiveMenu, setShowMenu } = useMenu();

  return (
    <Button
      asChild
      variant={"ghost"}
      className={clsx(
        "justify-start border border-transparent font-normal! px-2!",
        activeMenu.name === "AllTasks" &&
        "bg-sidebar-primary",
      )}
    >
      <Link
        prefetch={true}
        href="/app/all"
        onClick={() => {
          setActiveMenu({ name: "AllTasks" });
          if (width <= 1266) setShowMenu(false);
        }}
      >
        <ListTodo
          className={clsx(
            "w-4.5 h-4.5 stroke-muted-foreground",
            activeMenu.name === "AllTasks" && "stroke-form-foreground-accent",
          )}
        />
        <p className="text-foreground">{appDict("allTasks")}</p>
      </Link>
    </Button>
  );
};

export default AllTasksSidebarItem;
