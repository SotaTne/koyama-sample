"use client";

import { ReactNode, useState, useEffect, useMemo } from "react";
import { ImagePreprocessContext } from "../contexts/preprocess-context";
import { ImageRecognizerContext } from "../contexts/recognizer-context";
import { ImagePreprocessor } from "../lib/image-preprocess";
import { Recognizer } from "../lib/recognizer";
// @ts-ignore
import { useOpenCv } from "opencv-react";

export function ClientImageProvider({ children }: { children: ReactNode }) {
  const [preprocessor, setPreprocessor] = useState<ImagePreprocessor | null>(null);
  const [recognizer, setRecognizer] = useState<Recognizer | null>(null);
  const { cv } = useOpenCv();

  useEffect(() => {
    if (cv) {
      setPreprocessor(new ImagePreprocessor(cv));
      Recognizer.create().then((instance) => {
        setRecognizer(instance);
      });
    }
  }, [cv]);

  if (!preprocessor || !recognizer || !cv) {
    return <div>OpenCV loading...</div>;
  }

  return (
    <ImagePreprocessContext value={preprocessor}>
      <ImageRecognizerContext value={recognizer}>
        {children}
      </ImageRecognizerContext>
    </ImagePreprocessContext>
  );
}