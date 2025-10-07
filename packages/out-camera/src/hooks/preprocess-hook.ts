"use client";

import { use } from "react";
import { ImagePreprocessContext } from "../contexts/preprocess-context";
import { ImagePreprocessor } from "../lib/image-preprocess";

export function useImagePreprocessor(): ImagePreprocessor {
  const context = use(ImagePreprocessContext);
  if (!context) {
    throw new Error(
      "useImagePreprocessor must be used within ImagePreprocessProvider"
    );
  }
  return context;
}
