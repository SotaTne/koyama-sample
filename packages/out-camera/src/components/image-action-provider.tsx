"use client"

import { ReactNode } from "react";
import { ClientImageProvider } from "../_components/client-provider";
// @ts-ignore 
import { OpenCvProvider } from 'opencv-react'

export function ImageActionProvider({ children }: { children: ReactNode }) {
  return (
    <OpenCvProvider openCvVersion="4.12.0">
      <ClientImageProvider>{children}</ClientImageProvider>
    </OpenCvProvider>
  );
}