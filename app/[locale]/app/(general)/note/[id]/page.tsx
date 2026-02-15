"use client";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect } from "react";
import dynamic from "next/dynamic";
import { useNote } from "@/features/notes/query/get-notes";
import NoteLoading from "@/components/Sidebar/Note/NoteLoading";

const Editor = dynamic(
  () => import("@/features/notes/component/Editor"),
  { loading: () => <NoteLoading /> },
);
const Page = () => {
  const router = useRouter();
  const params = useParams();
  const { notes, notesLoading } = useNote();
  const note = notes.find(({ id }) => id === params.id);

  useEffect(() => {
    if (!notesLoading && !note) {
      router.replace("/app/todo");
    }
  }, [notesLoading, note, router]);

  if (notesLoading) return <NoteLoading />;

  if (!note) return null;

  return <Editor note={note} />;
};

export default Page;
