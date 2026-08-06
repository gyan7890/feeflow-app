import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const requiredTables = [
  { name: "feeflow_students", select: "id" },
  { name: "feeflow_payments", select: "id" },
  { name: "feeflow_reminders", select: "id" },
  { name: "feeflow_settings", select: "teacher_id" },
  { name: "teacher_profiles", select: "id" },
  { name: "feeflow_subjects", select: "id" },
  { name: "leads", select: "id" },
];

function getSupabaseConfig() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "https://hpkfsuvxafcctdmkooup.supabase.co";

  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "sb_publishable_pj1JvuR1OhzTpQgipH5AsQ_apaIw7uZ";

  return { url, key };
}

export async function GET() {
  const config = getSupabaseConfig();

  if ("error" in config) {
    return Response.json({ ok: false, error: config.error }, { status: 500 });
  }

  try {
    const supabase = createClient(config.url, config.key, {
      auth: { persistSession: false },
    });
    
    let sessionError: string | null = null;
    try {
      const { error } = await supabase.auth.getSession();
      if (error) sessionError = error.message;
    } catch (err) {
      sessionError = err instanceof Error ? err.message : "Network request failed.";
    }

    if (sessionError) {
      return Response.json({ ok: false, error: sessionError }, { status: 502 });
    }

    const tableChecks = await Promise.all(
      requiredTables.map(async (table) => {
        try {
          const result = await supabase.from(table.name).select(table.select).limit(0);

          if (!result.error) {
            return { table: table.name, ok: true };
          }

          return {
            table: table.name,
            ok: false,
            missing: isMissingTableError(result.error.message),
            error: result.error.message,
          };
        } catch (err) {
          return {
            table: table.name,
            ok: false,
            missing: false,
            error: err instanceof Error ? err.message : "Fetch failed",
          };
        }
      }),
    );

    const missingTables = tableChecks.filter((check) => !check.ok && check.missing).map((check) => check.table);
    const failedTables = tableChecks.filter((check) => !check.ok && !check.missing);

    if (missingTables.length > 0) {
      return Response.json(
        {
          ok: true,
          status: "connected",
          tablesReady: false,
          projectUrl: config.url,
          message: "Supabase connection active. Some database tables are pending setup script.",
          missingTables,
          setupFile: "supabase/setup.sql",
          hint: "Run supabase/setup.sql once in your Supabase SQL editor to create missing tables.",
        },
        { status: 200 },
      );
    }

    if (failedTables.length > 0) {
      return Response.json(
        {
          ok: false,
          projectUrl: config.url,
          error: "Supabase is reachable, but one or more table checks failed.",
          failedTables,
        },
        { status: 502 },
      );
    }

    return Response.json({ ok: true, projectUrl: config.url, tables: tableChecks });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Supabase check failed.",
      },
      { status: 500 },
    );
  }
}

function isMissingTableError(message: string) {
  return message.includes("schema cache") || message.includes("Could not find the table") || message.includes("does not exist");
}
