"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Pause, Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HeroSlide {
  id: string;
  title: string;
  subtitle?: string | null;
  caption?: string | null;
  imageUrl: string;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  linkUrl?: string | null;
  linkText?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
}

interface HeroCarouselProps {
  sport: "cornhole" | "darts";
  autoPlayInterval?: number;
  className?: string;
}

export function HeroCarousel({
  sport,
  autoPlayInterval = 5000,
  className,
}: HeroCarouselProps) {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup transition timer on unmount
  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  // Fetch slides from API.
  useEffect(() => {
    const fetchSlides = async () => {
      try {
        const response = await fetch(`/api/public/hero-slides?sport=${sport}`);
        if (response.ok) {
          const data = await response.json();
          if (data.slides && data.slides.length > 0) {
            setSlides(data.slides);
          } else {
            setSlides([]);
          }
        } else {
          setSlides([]);
        }
      } catch (error) {
        console.error("Failed to fetch hero slides:", error);
        setSlides([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSlides();
  }, [sport]);

  const totalSlides = slides.length;

  const goToNext = useCallback(() => {
    if (isTransitioning || totalSlides === 0) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev + 1) % totalSlides);
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = setTimeout(() => setIsTransitioning(false), 500);
  }, [totalSlides, isTransitioning]);

  const goToPrev = useCallback(() => {
    if (isTransitioning || totalSlides === 0) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = setTimeout(() => setIsTransitioning(false), 500);
  }, [totalSlides, isTransitioning]);

  const goToSlide = useCallback((index: number) => {
    if (isTransitioning || index === currentIndex || totalSlides === 0) return;
    setIsTransitioning(true);
    setCurrentIndex(index);
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = setTimeout(() => setIsTransitioning(false), 500);
  }, [isTransitioning, currentIndex, totalSlides]);

  // Auto-play
  useEffect(() => {
    if (!isPlaying || totalSlides === 0) return;

    const timer = setInterval(goToNext, autoPlayInterval);
    return () => clearInterval(timer);
  }, [isPlaying, autoPlayInterval, goToNext, totalSlides]);

  if (loading) {
    return (
      <div className={cn("relative overflow-hidden rounded-xl", className)}>
        <div className="relative aspect-[16/9] sm:aspect-[21/9] w-full bg-muted flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (totalSlides === 0) {
    return null;
  }

  return (
    <div className={cn("relative overflow-hidden rounded-xl group", className)}>
      {/* Main Image */}
      <div className="relative aspect-[16/9] sm:aspect-[21/9] w-full">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className={cn(
              "absolute inset-0 transition-all duration-500 ease-in-out",
              index === currentIndex
                ? "opacity-100 scale-100"
                : "opacity-0 scale-105"
            )}
          >
            <Image
              src={slide.imageUrl}
              alt={slide.title}
              fill
              className="object-cover"
              priority={index === 0}
              sizes="(max-width: 768px) 100vw, 1344px"
            />
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
            
            {/* Caption */}
            {(slide.caption || slide.subtitle) && (
              <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
                {slide.subtitle && (
                  <p className="text-white/80 text-sm mb-1">{slide.subtitle}</p>
                )}
                {slide.caption && (
                  <p className="text-white text-lg sm:text-xl font-medium drop-shadow-lg">
                    {slide.caption}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Navigation Arrows */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full",
          "bg-black/30 hover:bg-black/50 text-white border border-white/20",
          "backdrop-blur-sm transition-all",
          "opacity-0 group-hover:opacity-100"
        )}
        onClick={goToPrev}
        aria-label="Previous slide"
      >
        <ChevronLeft className="h-6 w-6" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full",
          "bg-black/30 hover:bg-black/50 text-white border border-white/20",
          "backdrop-blur-sm transition-all",
          "opacity-0 group-hover:opacity-100"
        )}
        onClick={goToNext}
        aria-label="Next slide"
      >
        <ChevronRight className="h-6 w-6" />
      </Button>

      {/* Bottom Controls */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
        {/* Slide Indicators */}
        <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                index === currentIndex
                  ? sport === "cornhole"
                    ? "bg-green-400 w-4"
                    : "bg-teal-400 w-4"
                  : "bg-white/50 hover:bg-white/70"
              )}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        {/* Play/Pause Button */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 rounded-full",
            "bg-black/40 hover:bg-black/60 text-white",
            "backdrop-blur-sm transition-all"
          )}
          onClick={() => setIsPlaying(!isPlaying)}
          aria-label={isPlaying ? "Pause carousel" : "Play carousel"}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 ml-0.5" />
          )}
        </Button>
      </div>
    </div>
  );
}
