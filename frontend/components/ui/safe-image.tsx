"use client";

import React, { useState } from "react";
import Image, { ImageProps } from "next/image";

function createFallbackSvgDataUri(
  width: number,
  height: number,
  label: string
): string {
  const safeLabel = (label || "LOTTE CINEMA")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .slice(0, 42);

  const fontSize = Math.max(11, Math.min(20, Math.floor(Math.min(width, height) / 8)));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#efebdb"/>
    <rect x="2" y="2" width="${Math.max(0, width - 4)}" height="${Math.max(0, height - 4)}" fill="none" stroke="#c1b687" stroke-width="2"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6f6247" font-family="Arial, sans-serif" font-weight="bold" font-size="${fontSize}">
      ${safeLabel}
    </text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function SafeImage(props: ImageProps) {
  const { src, alt, width, height, onError, ...rest } = props;
  const [hasError, setHasError] = useState(false);

  const numWidth = typeof width === "number" ? width : Number(width) || 300;
  const numHeight = typeof height === "number" ? height : Number(height) || 150;

  const fallbackSrc = createFallbackSvgDataUri(
    numWidth,
    numHeight,
    typeof alt === "string" ? alt : "LOTTE CINEMA"
  );

  const isExternalUrl = typeof src === "string" && src.startsWith("http");

  return (
    <Image
      {...rest}
      src={hasError ? fallbackSrc : src}
      alt={alt}
      width={width}
      height={height}
      unoptimized={hasError || isExternalUrl || rest.unoptimized}
      onError={(e) => {
        if (!hasError) {
          setHasError(true);
        }
        onError?.(e);
      }}
    />
  );
}
