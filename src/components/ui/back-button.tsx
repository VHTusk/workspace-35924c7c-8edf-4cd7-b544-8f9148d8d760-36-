"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BackButtonProps {
  /** Navigate back in history (default) or to a specific URL */
  href?: string;
  /** Custom label text */
  label?: string;
  /** Additional classes */
  className?: string;
  /** Button variant */
  variant?: "default" | "ghost" | "outline" | "secondary" | "link";
  /** Size of the button */
  size?: "default" | "sm" | "lg" | "icon";
  /** Show only icon (no text) */
  iconOnly?: boolean;
}

/**
 * BackButton - A reusable back navigation component
 * 
 * Use this at the top of pages to provide easy navigation back.
 * 
 * Examples:
 * - <BackButton /> - Goes back in history
 * - <BackButton href="/org/home" /> - Goes to specific URL
 * - <BackButton href="/org/home" label="Dashboard" /> - With custom label
 * - <BackButton iconOnly /> - Only shows arrow icon
 */
export function BackButton({
  href,
  label = "Back",
  className,
  variant = "ghost",
  size = "sm",
  iconOnly = false,
}: BackButtonProps) {
  const router = useRouter();

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors",
          className
        )}
      >
        <ArrowLeft className="w-4 h-4" />
        {!iconOnly && <span>{label}</span>}
      </Link>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => router.back()}
      className={cn("gap-1.5", className)}
    >
      <ArrowLeft className="w-4 h-4" />
      {!iconOnly && <span>{label}</span>}
    </Button>
  );
}

/**
 * PageBackButton - Pre-styled back button for page headers
 * 
 * Standard back button with consistent styling for page headers.
 * Shows "Back to [label]" or just "Back" if no label provided.
 */
export function PageBackButton({
  href,
  label,
  className,
}: {
  href?: string;
  label?: string;
  className?: string;
}) {
  const displayLabel = label ? `Back to ${label}` : "Back";
  
  return (
    <BackButton
      href={href}
      label={displayLabel}
      className={cn("mb-4", className)}
    />
  );
}

export default BackButton;
