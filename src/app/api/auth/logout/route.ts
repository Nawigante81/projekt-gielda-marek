import { NextResponse } from "next/server";
import { COOKIE_NAME, COOKIE_PATH } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, "", { path: COOKIE_PATH, maxAge: 0 });
  return response;
}
