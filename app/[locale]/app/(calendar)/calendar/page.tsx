import React from "react";
import dynamic from "next/dynamic";
import Spinner from "@/components/ui/spinner";

const CalendarClient = dynamic(
  () => import("@/features/calendar/component/CalendarClient"),
  { loading: () => <div className="flex h-full items-center justify-center"><Spinner /></div> },
);

const page = async ({}) => {
  return <CalendarClient />;
};

export default page;
