"use client";

import { useSyncExternalStore } from "react";
import { ADMIN_JWT_KEY } from "@/lib/nrgs-api";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("nrgs-admin-auth", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("nrgs-admin-auth", onChange);
  };
}

function getSnapshot() {
  return !!localStorage.getItem(ADMIN_JWT_KEY);
}

function getServerSnapshot() {
  return false;
}

/** Whether an admin JWT is present (client-only; false on server). */
export function useAdminSession(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
