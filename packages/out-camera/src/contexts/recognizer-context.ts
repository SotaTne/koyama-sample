"use client"

import { createContext } from "react";
import { Recognizer } from "../lib/recognizer";

export const ImageRecognizerContext = createContext<Recognizer | null>(null);