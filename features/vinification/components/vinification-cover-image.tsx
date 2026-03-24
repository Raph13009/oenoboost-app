"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getVinificationIllustrationSrc, VINIFICATION_PLACEHOLDER_IMAGE } from "../utils";

type VinificationCoverImageProps = {
  illustrationUrl: string | null;
  alt: string;
  fill?: boolean;
  sizes: string;
  className?: string;
  priority?: boolean;
};

export function VinificationCoverImage({
  illustrationUrl,
  alt,
  fill,
  sizes,
  className,
  priority,
}: VinificationCoverImageProps) {
  const [src, setSrc] = useState(() => getVinificationIllustrationSrc(illustrationUrl));

  useEffect(() => {
    setSrc(getVinificationIllustrationSrc(illustrationUrl));
  }, [illustrationUrl]);

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      sizes={sizes}
      className={className}
      priority={priority}
      draggable={false}
      onError={() =>
        setSrc((current) =>
          current === VINIFICATION_PLACEHOLDER_IMAGE ? current : VINIFICATION_PLACEHOLDER_IMAGE,
        )
      }
    />
  );
}
