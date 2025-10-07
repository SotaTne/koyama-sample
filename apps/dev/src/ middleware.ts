import { NextResponse } from "next/server";
export function middleware(req: Request) {
  const res = NextResponse.next();
  res.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(self), pan-tilt-zoom=(self)"
  );
  return res;
}
