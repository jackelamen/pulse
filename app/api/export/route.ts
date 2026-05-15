import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const EXPORT_TABLES = [
  "lists",
  "folders",
  "tags",
  "tasks",
  "habits",
  "habit_logs",
  "focus_sessions",
  "user_settings",
] as const;

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let entries: Array<readonly [string, unknown[]]>;
  try {
    entries = await Promise.all(
      EXPORT_TABLES.map(async (table) => {
        const { data, error } = await supabase.from(table).select("*");
        if (error) throw new Error(`${table}: ${error.message}`);
        return [table, data ?? []] as const;
      })
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export failed" },
      { status: 500 }
    );
  }

  const payload = {
    app: "Pulse",
    version: 1,
    exported_at: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email ?? null,
    },
    tables: Object.fromEntries(entries),
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="pulse-export-${new Date()
        .toISOString()
        .slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
