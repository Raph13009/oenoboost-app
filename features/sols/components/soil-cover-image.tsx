"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getSoilImageSrc, SOIL_PLACEHOLDER_IMAGE } from "../utils";

type SoilCoverImageProps = {
  photoUrl: string | null;
  alt: string;
  fill?: boolean;
  sizes: string;
  className?: string;
  priority?: boolean;
};

export function SoilCoverImage({
  photoUrl,
  alt,
  fill,
  sizes,
  className,
  priority,
}: SoilCoverImageProps) {
  const [src, setSrc] = useState(() => getSoilImageSrc(photoUrl));

  useEffect(() => {
    setSrc(getSoilImageSrc(photoUrl));
  }, [photoUrl]);

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
          current === SOIL_PLACEHOLDER_IMAGE ? current : SOIL_PLACEHOLDER_IMAGE,
        )
      }
    />
  );
}
