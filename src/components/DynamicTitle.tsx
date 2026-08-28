"use client";
import { useEffect } from "react";

const DEFAULT_NAME = "vSphere Panel";

export default function DynamicTitle() {
  useEffect(() => {
    fetch("/api/identity")
      .then(r => r.json())
      .then(d => {
        // Titre de l'onglet
        document.title = d.siteName || DEFAULT_NAME;

        // Favicon dynamique
        if (d.hasFavicon) {
          const existing = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
          const link: HTMLLinkElement = existing ?? document.createElement("link");
          link.rel = "icon";
          link.href = `/api/favicon?t=${Date.now()}`; // cache busting
          if (!existing) document.head.appendChild(link);
        }
      })
      .catch(() => {});
  }, []);
  return null;
}
