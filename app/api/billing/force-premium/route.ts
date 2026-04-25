import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

export async function POST() {
  console.info("[billing][force-premium] request received");

  const user = await getCurrentUser();
  if (!user) {
    console.warn("[billing][force-premium] no authenticated user");
    return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 });
  }

  const nowIso = new Date().toISOString();
  const supabase = createServiceRoleClient();

  console.info("[billing][force-premium] upserting premium plan", {
    userId: user.id,
    email: user.email,
  });

  const upsert = await supabase
    .from("users")
    .upsert(
      {
        id: user.id,
        email: user.email,
        plan: "premium",
        updated_at: nowIso,
      },
      { onConflict: "id" },
    )
    .select("id, plan")
    .single();

  if (upsert.error) {
    console.error("[billing][force-premium] users upsert failed", {
      userId: user.id,
      error: upsert.error,
    });
    return NextResponse.json({ ok: false, code: "DB_ERROR" }, { status: 500 });
  }

  console.info("[billing][force-premium] success", {
    userId: upsert.data.id,
    plan: upsert.data.plan,
  });

  return NextResponse.json({
    ok: true,
    userId: upsert.data.id,
    plan: upsert.data.plan,
  });
}
