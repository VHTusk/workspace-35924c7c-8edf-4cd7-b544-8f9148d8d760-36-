"use client";

import { useRouter } from "next/navigation";

export function OfficeLogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore
    }

    router.push("/office/login");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="w-full rounded-2xl border border-red-200 px-4 py-3 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
    >
      Logout
    </button>
  );
}
