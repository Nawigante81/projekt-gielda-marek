import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateUpcomingEarningsAlerts, getCachedEarningsCalendar, getUpcomingEarnings, setCachedEarningsCalendar } from "@/lib/earnings";

function bucketize(events: Awaited<ReturnType<typeof getUpcomingEarnings>>) {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(startToday.getTime() + 86400000);
  const week = new Date(startToday.getTime() + 7 * 86400000);
  const month = new Date(startToday.getTime() + 30 * 86400000);

  const parse = (value: string) => new Date(value);
  return {
    today: events.filter((event) => parse(event.event_date).toDateString() === startToday.toDateString()),
    tomorrow: events.filter((event) => parse(event.event_date).toDateString() === tomorrow.toDateString()),
    thisWeek: events.filter((event) => parse(event.event_date) >= startToday && parse(event.event_date) < week),
    next30Days: events.filter((event) => parse(event.event_date) >= startToday && parse(event.event_date) < month),
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cached = await getCachedEarningsCalendar();
  let events = cached?.events || [];
  let refreshedAt = cached?.refreshedAt || null;

  if (events.length === 0) {
    events = await getUpcomingEarnings();
    refreshedAt = new Date().toISOString();
    await setCachedEarningsCalendar(events);
  }

  const alertCount = await generateUpcomingEarningsAlerts();

  return NextResponse.json({
    events,
    buckets: bucketize(events),
    alertCount,
    refreshedAt,
  });
}
