"use client";

import { useParams } from "next/navigation";

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  // Authentication disabled - render children directly
  return (
    <div className="min-h-screen bg-background">
      <main className="min-h-screen bg-background">
        {children}
      </main>
    </div>
  );
}
