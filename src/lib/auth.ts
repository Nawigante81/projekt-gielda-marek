import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { getDb } from "./db";
import { cookies } from "next/headers";

const SECRET = new TextEncoder().encode(
  process.env.APP_SECRET_KEY || "super-secret-key-change-in-production-min-32-chars"
);

const COOKIE_NAME = "stock_analyst_token";
const COOKIE_PATH = "/";

export interface JWTPayload {
  userId: number;
  username: string;
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(SECRET);
}

export async function verifyToken(
  token: string
): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    return verifyToken(token);
  }

  return null;
}

export function shouldUseSecureCookie(requestUrl?: string): boolean {
  const explicit = process.env.COOKIE_SECURE;
  if (explicit === "true") return true;
  if (explicit === "false") return false;

  if (!requestUrl) {
    return process.env.NODE_ENV === "production";
  }

  try {
    return new URL(requestUrl).protocol === "https:";
  } catch {
    return process.env.NODE_ENV === "production";
  }
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function getUserByUsername(username: string) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username) as
    | { id: number; username: string; password_hash: string }
    | undefined;
}

export function createUser(username: string, password: string): void {
  const db = getDb();
  const hash = hashPassword(password);
  db.prepare(
    "INSERT INTO users (username, password_hash) VALUES (?, ?)"
  ).run(username, hash);
}

export function updatePassword(userId: number, newPassword: string): void {
  const db = getDb();
  const hash = hashPassword(newPassword);
  db.prepare(
    "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(hash, userId);
}

export { COOKIE_NAME };
export { COOKIE_PATH };
