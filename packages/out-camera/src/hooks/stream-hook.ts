"use client"

import { use } from "react";
import { StreamContext } from "../contexts/stream-context";

export function useStream(): MediaStream {
  const context = use(StreamContext);
  if (!context) {
    throw new Error('useStream must be used within StreamProvider');
  }
  return context;
}