"use client";

import { useState, useEffect } from "react";
import { AlertCircle, Mail, Phone, User, X, ArrowRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useParams } from "next/navigation";

interface VerificationBannersProps {
  sport?: string;
  isCornhole?: boolean;
  profileComplete?: boolean;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  onResendEmail?: () => void;
  className?: string;
}

interface BannerItem {
  id: string;
  type: 'profile' | 'email' | 'phone';
  message: string;
  action: string;
  href?: string;
  onClick?: () => void;
}

export function VerificationBanners({
  sport: propSport,
  isCornhole: propIsCornhole,
  profileComplete = true,
  emailVerified = true,
  phoneVerified = true,
  onResendEmail,
  className,
}: VerificationBannersProps) {
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const [resending, setResending] = useState(false);
  
  // Get sport from URL if not provided
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const sport = propSport || pathname.split('/')[1] || 'cornhole';
  const isCornhole = propIsCornhole ?? sport === 'cornhole';

  const banners: BannerItem[] = [];

  if (!profileComplete && !dismissed['profile']) {
    banners.push({
      id: 'profile',
      type: 'profile',
      message: 'Complete your profile to unlock full platform features.',
      action: 'Complete Profile',
      href: `/${sport}/profile`,
    });
  }

  if (!emailVerified && !dismissed['email']) {
    banners.push({
      id: 'email',
      type: 'email',
      message: 'Please verify your email address.',
      action: onResendEmail ? 'Resend Verification' : 'Verify Email',
      onClick: onResendEmail,
      href: onResendEmail ? undefined : `/${sport}/verify-email`,
    });
  }

  if (!phoneVerified && !dismissed['phone']) {
    banners.push({
      id: 'phone',
      type: 'phone',
      message: 'Please verify your phone number.',
      action: 'Verify Phone',
      href: `/${sport}/settings`,
    });
  }

  const handleDismiss = (id: string) => {
    setDismissed(prev => ({ ...prev, [id]: true }));
  };

  const handleResendEmail = async (banner: BannerItem) => {
    if (!onResendEmail) return;
    setResending(true);
    try {
      await onResendEmail();
      handleDismiss(banner.id);
    } catch (error) {
      console.error('Failed to resend email:', error);
    } finally {
      setResending(false);
    }
  };

  if (banners.length === 0) return null;

  const primaryTextClass = isCornhole ? "text-green-600 dark:text-green-400" : "text-teal-600 dark:text-teal-400";
  const primaryBgClass = isCornhole ? "bg-green-50 dark:bg-green-950/30" : "bg-teal-50 dark:bg-teal-950/30";
  const primaryBorderClass = isCornhole ? "border-green-200 dark:border-green-800" : "border-teal-200 dark:border-teal-800";

  const getIcon = (type: string) => {
    switch (type) {
      case 'profile':
        return <User className="w-4 h-4" />;
      case 'email':
        return <Mail className="w-4 h-4" />;
      case 'phone':
        return <Phone className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {banners.map((banner) => (
        <Alert
          key={banner.id}
          className={cn(
            "flex items-center justify-between gap-3 py-3 px-4",
            primaryBgClass,
            primaryBorderClass,
            "border"
          )}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={cn("flex-shrink-0", primaryTextClass)}>
              {getIcon(banner.type)}
            </div>
            <AlertDescription className="text-foreground text-sm truncate">
              {banner.message}
            </AlertDescription>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {banner.onClick ? (
              <Button
                size="sm"
                variant="ghost"
                className={cn("h-7 text-xs gap-1", primaryTextClass, "hover:bg-primary/10")}
                onClick={() => handleResendEmail(banner)}
                disabled={resending}
              >
                {resending ? 'Sending...' : banner.action}
                <ArrowRight className="w-3 h-3" />
              </Button>
            ) : banner.href ? (
              <Link href={banner.href}>
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn("h-7 text-xs gap-1", primaryTextClass, "hover:bg-primary/10")}
                >
                  {banner.action}
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => handleDismiss(banner.id)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </Alert>
      ))}
    </div>
  );
}

// Hook to fetch verification status
export function useVerificationStatus() {
  const [status, setStatus] = useState({
    profileComplete: true,
    emailVerified: true,
    phoneVerified: true,
    loading: true,
  });

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/player/profile-completeness', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setStatus({
            profileComplete: data.isComplete ?? true,
            emailVerified: data.emailVerified ?? true,
            phoneVerified: data.phoneVerified ?? true,
            loading: false,
          });
        } else {
          setStatus(prev => ({ ...prev, loading: false }));
        }
      } catch (error) {
        console.error('Failed to fetch verification status:', error);
        setStatus(prev => ({ ...prev, loading: false }));
      }
    };

    fetchStatus();
  }, []);

  return status;
}
