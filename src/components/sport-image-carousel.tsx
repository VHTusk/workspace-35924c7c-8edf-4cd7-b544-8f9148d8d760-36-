"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

type SportImageCarouselProps = {
  images: string[];
  altPrefix: string;
  aspectClass?: string;
  className?: string;
  imageClassName?: string;
};

export default function SportImageCarousel({
  images,
  altPrefix,
  aspectClass = "aspect-[16/10]",
  className,
  imageClassName,
}: SportImageCarouselProps) {
  const [current, setCurrent] = useState(0);

  const handleApi = (api: CarouselApi | undefined) => {
    if (!api) return;

    setCurrent(api.selectedScrollSnap());
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  };

  return (
    <div className={cn("space-y-3", className)}>
      <Carousel setApi={handleApi} opts={{ loop: images.length > 1 }}>
        <CarouselContent>
          {images.map((src, index) => (
            <CarouselItem key={`${src}-${index}`}>
              <div className={cn("relative overflow-hidden rounded-2xl", aspectClass)}>
                <Image
                  src={src}
                  alt={`${altPrefix} ${index + 1}`}
                  fill
                  className={cn("object-cover", imageClassName)}
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {images.length > 1 ? (
          <>
            <CarouselPrevious className="left-3 top-1/2 h-9 w-9 -translate-y-1/2 border-white/20 bg-black/45 text-white hover:bg-black/60 disabled:opacity-40" />
            <CarouselNext className="right-3 top-1/2 h-9 w-9 -translate-y-1/2 border-white/20 bg-black/45 text-white hover:bg-black/60 disabled:opacity-40" />
          </>
        ) : null}
      </Carousel>

      {images.length > 1 ? (
        <div className="flex justify-center gap-2">
          {images.map((_, index) => (
            <span
              key={index}
              className={cn(
                "h-2 rounded-full transition-all",
                index === current ? "w-6 bg-foreground" : "w-2 bg-muted-foreground/35",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
