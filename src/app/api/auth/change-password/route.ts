import { NextRequest, NextResponse } from "next/server";
import { getSession, getUserByUsername, verifyPassword, updatePassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Brak wymaganych pól" }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "Hasło musi mieć minimum 6 znaków" }, { status: 400 });
  }

  const user = await getUserByUsername(session.username);
  if (!user || !verifyPassword(currentPassword, user.password_hash)) {
    return NextResponse.json({ error: "Nieprawidłowe aktualne hasło" }, { status: 401 });
  }

  await updatePassword(session.userId, newPassword);
  return NextResponse.json({ success: true });
}
