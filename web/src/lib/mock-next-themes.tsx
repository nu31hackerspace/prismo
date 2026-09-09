"use client";
import React from "react";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useTheme() {
  return { theme: 'light', setTheme: () => {}, resolvedTheme: 'light', themes: ['light'] };
}
