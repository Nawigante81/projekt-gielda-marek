import { getSettingValue, upsertSetting } from "./postgres-access";

export async function readJsonCache<T>(key: string, ttlMs: number): Promise<T | null> {
  const raw = await getSettingValue(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { cachedAt?: string; data?: T };
    if (!parsed.cachedAt || parsed.data === undefined) return null;
    const ageMs = Date.now() - new Date(parsed.cachedAt).getTime();
    if (!Number.isFinite(ageMs) || ageMs > ttlMs) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export async function writeJsonCache<T>(key: string, data: T): Promise<void> {
  await upsertSetting(key, JSON.stringify({ cachedAt: new Date().toISOString(), data }));
}
