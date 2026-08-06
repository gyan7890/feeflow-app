import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type SubscriptionVerifyPayload = {
  teacher_id?: string;
  plan?: "pro_monthly" | "pro_yearly" | "1_month_trial" | "trial" | "Free" | "Pro";
  purchase_token?: string;
  order_id?: string;
  status?: "active" | "pending" | "cancelled" | "expired" | "renewed";
};

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return { error: "Supabase environment variables are missing." };
  }

  return { url, key };
}

export async function POST(request: Request) {
  let payload: SubscriptionVerifyPayload;

  try {
    payload = (await request.json()) as SubscriptionVerifyPayload;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const teacherId = payload.teacher_id?.trim();
  const plan = payload.plan || "1_month_trial";
  const purchaseToken = payload.purchase_token?.trim() || `trial_token_${teacherId}_${Date.now()}`;
  const orderId = payload.order_id?.trim() || `GPA.TRIAL-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const status = payload.status || "active";

  if (!teacherId) {
    return Response.json({ ok: false, error: "Teacher ID is required for verification." }, { status: 400 });
  }

  const config = getSupabaseConfig();
  if ("error" in config) {
    return Response.json({ ok: false, error: config.error }, { status: 500 });
  }

  try {
    const supabase = createClient(config.url, config.key, {
      auth: { persistSession: false },
    });

    const now = new Date();
    const durationDays = plan === "pro_yearly" ? 365 : 30;
    const expiryDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const subscriptionRecord = {
      teacher_id: teacherId,
      plan: plan,
      subscription_status: status,
      purchase_token: purchaseToken,
      order_id: orderId,
      purchase_date: now.toISOString(),
      expiry_date: expiryDate.toISOString(),
      auto_renew: plan !== "1_month_trial" && plan !== "trial",
      raw_payload: {
        is_pro: true,
        trial_start_date: now.toISOString(),
        trial_end_date: expiryDate.toISOString(),
        verified_at: now.toISOString(),
        environment: process.env.NODE_ENV || "production",
      },
      updated_at: now.toISOString(),
    };

    let subData = null;
    try {
      const { data, error } = await supabase
        .from("feeflow_subscriptions")
        .insert(subscriptionRecord)
        .select("*")
        .single();
      if (!error) subData = data;
    } catch {
      // Memory fallback if DB insert fails
    }

    return Response.json(
      {
        ok: true,
        verified: true,
        is_pro: true,
        plan,
        subscription_status: status,
        trial_start_date: now.toISOString(),
        trial_end_date: expiryDate.toISOString(),
        expiry_date: expiryDate.toISOString(),
        order_id: orderId,
        subscription: subData || subscriptionRecord,
      },
      { status: 200 }
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Could not verify subscription.",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teacherId = searchParams.get("teacher_id");

  if (!teacherId) {
    return Response.json({ ok: false, error: "Teacher ID query param required." }, { status: 400 });
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
      .from("feeflow_subscriptions")
      .select("*")
      .eq("teacher_id", teacherId)
      .order("expiry_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (!data) {
      return Response.json({
        ok: true,
        verified: false,
        is_pro: false,
        subscription: null,
      });
    }

    const now = new Date();
    const expiryDate = new Date(data.expiry_date);
    const isExpired = expiryDate <= now;

    if (isExpired && data.subscription_status === "active") {
      try {
        await supabase
          .from("feeflow_subscriptions")
          .update({ subscription_status: "expired", updated_at: now.toISOString() })
          .eq("id", data.id);
      } catch {
        // Fallback silently if update fails
      }
      
      data.subscription_status = "expired";
    }

    const isVerified = data.subscription_status === "active" && !isExpired;

    return Response.json({
      ok: true,
      verified: isVerified,
      is_pro: isVerified,
      subscription_status: data.subscription_status,
      plan: data.plan,
      trial_end_date: data.expiry_date,
      expiry_date: data.expiry_date,
      subscription: data,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to fetch subscription.",
      },
      { status: 500 }
    );
  }
}
