import { NextRequest, NextResponse } from "next/server";
import {
  getUserByUsername,
  verifyPassword,
  signToken,
  COOKIE_NAME,
  COOKIE_PATH,
  shouldUseSecureCookie,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: "Brak danych logowania" }, { status: 400 });
    }

    const user = await getUserByUsername(username);
    if (!user) {
      return NextResponse.json({ error: "Nieprawidłowe dane logowania" }, { status: 401 });
    }

    const valid = verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Nieprawidłowe dane logowania" }, { status: 401 });
    }

    const token = await signToken({ userId: user.id, username: user.username });
    const response = NextResponse.json({ success: true, userId: user.id, username: user.username });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: shouldUseSecureCookie(req.url),
      sameSite: "lax",
      path: COOKIE_PATH,
      maxAge: 86400, // 24h
    });
    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}
