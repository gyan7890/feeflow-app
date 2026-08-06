import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type LeadPayload = {
  name?: string;
  email?: string;
  phone?: string;
  center?: string;
  plan?: string;
  message?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fallbackLeads: Array<Record<string, string>> = [];

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return { error: "Supabase environment variables are missing." };
  }

  return { url, key };
}

export async function POST(request: Request) {
  let payload: LeadPayload;

  try {
    payload = (await request.json()) as LeadPayload;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const lead = {
    name: clean(payload.name),
    email: clean(payload.email).toLowerCase(),
    phone: clean(payload.phone),
    center: clean(payload.center),
    plan: clean(payload.plan) || "Free",
    message: clean(payload.message),
    source: "feeflow_landing",
  };

  if (!lead.name) {
    return Response.json({ ok: false, error: "Name is required." }, { status: 400 });
  }

  if (!emailPattern.test(lead.email)) {
    return Response.json({ ok: false, error: "A valid email is required." }, { status: 400 });
  }

  const config = getSupabaseConfig();

  if ("error" in config) {
    return Response.json({ ok: false, error: config.error }, { status: 500 });
  }

  try {
    const supabase = createClient(config.url, config.key, {
      auth: { persistSession: false },
    });
    const { data, error } = await supabase
      .from("leads")
      .insert(lead)
      .select("id,name,email,plan,created_at")
      .single();

    if (error) {
      if (isMissingLeadsTable(error.message)) {
        const fallbackLead = {
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          ...lead,
        };
        fallbackLeads.push(fallbackLead);

        return Response.json(
          {
            ok: true,
            lead: fallbackLead,
            persistence: "memory",
            hint: "Your request was received. Permanent CRM storage is not enabled yet.",
          },
          { status: 202 },
        );
      }

      return Response.json(
        {
          ok: false,
          error: "We could not save your request right now. Please try again in a moment.",
        },
        { status: 502 },
      );
    }

    return Response.json({ ok: true, lead: data }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Could not save lead.",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return Response.json({
    ok: true,
    fallbackCount: fallbackLeads.length,
    leads: fallbackLeads.slice(-20).reverse(),
  });
}

function isMissingLeadsTable(message: string) {
  return (
    message.includes("public.leads") ||
    message.includes("schema cache") ||
    (message.includes("relation") && message.includes("leads"))
  );
}
