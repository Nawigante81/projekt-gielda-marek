import process from "node:process";
import dotenv from "dotenv";

dotenv.config();

type StepResult = {
  name: string;
  ok: boolean;
  status: number;
  details: string;
};

const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";
const username = process.env.SMOKE_USERNAME || "pytomek@o2.pl";
const password = process.env.SMOKE_PASSWORD || "admin123";

function formatCookie(cookieHeader: string | null): string {
  if (!cookieHeader) {
    return "";
  }

  return cookieHeader.split(",").map((part) => part.split(";")[0]?.trim()).filter(Boolean).join("; ");
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function runStep(
  name: string,
  input: RequestInfo | URL,
  init?: RequestInit,
  validate?: (response: Response, body: unknown) => string | null
): Promise<StepResult> {
  const response = await fetch(input, init);
  const body = await parseJsonSafe(response);
  const validationError = validate ? validate(response, body) : null;

  return {
    name,
    ok: response.ok && !validationError,
    status: response.status,
    details: validationError || JSON.stringify(body ?? {}),
  };
}

async function main(): Promise<void> {
  const results: StepResult[] = [];

  results.push(
    await runStep(
      "health",
      `${baseUrl}/api/health`,
      undefined,
      (_response, body) => {
        const payload = body as { status?: string; database?: string } | null;
        if (payload?.status !== "ok") return "health status is not ok";
        if (payload?.database !== "postgres") return `expected database=postgres, got ${payload?.database ?? "unknown"}`;
        return null;
      }
    )
  );

  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const loginBody = await parseJsonSafe(loginResponse);
  const cookie = formatCookie(loginResponse.headers.get("set-cookie"));

  results.push({
    name: "login",
    ok: loginResponse.ok && cookie.length > 0,
    status: loginResponse.status,
    details: loginResponse.ok ? "authenticated" : JSON.stringify(loginBody ?? {}),
  });

  const authHeaders: Record<string, string> = {};
  if (cookie) {
    authHeaders.Cookie = cookie;
  }

  results.push(
    await runStep(
      "auth/me",
      `${baseUrl}/api/auth/me`,
      { headers: authHeaders },
      (_response, body) => {
        const payload = body as { username?: string; userId?: number } | null;
        if (!payload?.username || !payload?.userId) return "missing authenticated user payload";
        return null;
      }
    )
  );

  const protectedEndpoints = [
    { name: "settings", path: "/api/settings" },
    { name: "portfolio", path: "/api/portfolio" },
    { name: "reports", path: "/api/reports" },
    { name: "performance", path: "/api/performance" },
    { name: "sectors", path: "/api/sectors" },
  ];

  for (const endpoint of protectedEndpoints) {
    results.push(
      await runStep(
        endpoint.name,
        `${baseUrl}${endpoint.path}`,
        { headers: authHeaders },
        (_response, body) => (body === null ? "expected JSON response" : null)
      )
    );
  }

  console.log(`Smoke test base URL: ${baseUrl}`);
  for (const result of results) {
    console.log(`[${result.ok ? "OK" : "FAIL"}] ${result.name} (${result.status})`);
    if (!result.ok) {
      console.log(`  ${result.details}`);
    }
  }

  if (results.some((result) => !result.ok)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("smoke-test:postgres failed.");
  console.error(error);
  process.exitCode = 1;
});
