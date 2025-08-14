"use client"

import { createContext } from "react";
import { ImagePreprocessor } from "../lib/image-preprocess";

export const ImagePreprocessContext = createContext<ImagePreprocessor | null>(null);
