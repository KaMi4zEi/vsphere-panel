"use client";
import { createContext, useContext, useEffect, useState } from "react";

const SiteContext = createContext<string>("vSphere Panel");

export function SiteProvider({ children, initial }: { children: React.ReactNode; initial: string }) {
  return <SiteContext.Provider value={initial}>{children}</SiteContext.Provider>;
}

export function useSiteName(): string {
  return useContext(SiteContext);
}
