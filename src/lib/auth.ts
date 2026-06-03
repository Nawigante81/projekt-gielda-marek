import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import {
  createUser as createUserRecord,
  getUserByUsername as getUserByUsernameRecord,
  updateUserPassword as updateUserPasswordRecord,
} from "./postgres-access";

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

export async function getUserByUsername(username: string) {
  return getUserByUsernameRecord(username);
}

export async function createUserWithPassword(username: string, password: string): Promise<void> {
  const hash = hashPassword(password);
  await createUserRecord(username, hash);
}

export async function updatePassword(userId: number, newPassword: string): Promise<void> {
  const hash = hashPassword(newPassword);
  await updateUserPasswordRecord(userId, hash);
}

export { COOKIE_NAME };
export { COOKIE_PATH };
