"use client"

import { use } from "react";
import { ImageRecognizerContext } from "../contexts/recognizer-context";
import { Recognizer } from "../lib/recognizer";

export function useImageRecognizer(): Recognizer {
  const context = use(ImageRecognizerContext);
  if (!context) {
    throw new Error('useImageRecognizer must be used within ImageRecognizerProvider');
  }
  return context;
}