"use client";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

interface OverdueDragContextValue {
  isDraggingOverdue: boolean;
  setIsDraggingOverdue: (v: boolean) => void;
  todaySectionRef: React.RefObject<HTMLDivElement | null>;
  isPointerOverToday: () => boolean;
}

const OverdueDragContext = createContext<OverdueDragContextValue | null>(null);

export function OverdueDragProvider({ children }: { children: React.ReactNode }) {
  const [isDraggingOverdue, setIsDraggingOverdue] = useState(false);
  const todaySectionRef = useRef<HTMLDivElement | null>(null);
  const pointerPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      pointerPos.current = { x: e.clientX, y: e.clientY };
    }
    window.addEventListener("pointermove", onPointerMove);
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, []);

  const isPointerOverToday = useCallback(() => {
    const el = todaySectionRef.current;
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const { x, y } = pointerPos.current;
    return (
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom
    );
  }, []);

  return (
    <OverdueDragContext.Provider
      value={{ isDraggingOverdue, setIsDraggingOverdue, todaySectionRef, isPointerOverToday }}
    >
      {children}
    </OverdueDragContext.Provider>
  );
}

export function useOverdueDrag() {
  const ctx = useContext(OverdueDragContext);
  if (!ctx) throw new Error("useOverdueDrag must be used within OverdueDragProvider");
  return ctx;
}
