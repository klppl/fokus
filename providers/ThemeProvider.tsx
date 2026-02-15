"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { isDarkTheme } from "@/lib/themes";

function DarkClassSync() {
  const { resolvedTheme } = useTheme();

  React.useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme && isDarkTheme(resolvedTheme)) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [resolvedTheme]);

  return null;
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <DarkClassSync />
      {children}
    </NextThemesProvider>
  );
}
