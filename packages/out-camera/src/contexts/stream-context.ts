"use client"

import { createContext } from "react";

export const StreamContext = createContext<MediaStream | null>(null);
