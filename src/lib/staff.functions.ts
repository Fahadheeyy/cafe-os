/**
 * Owner-only staff administration. All operations verify the caller's role
 * server-side via RLS before touching Supabase Auth via the admin client.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
const ALLOWED_ROLES: AppRole[] = ["staff", "manager", "chef"];

async function assertOwner(supabase: SupabaseClient<Database>, userId: string) {
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("business_id")
    .eq("id", userId)
    .maybeSingle();
  if (pErr) throw pErr;
  const businessId = profile?.business_id;
  if (!businessId) throw new Error("Caller is not part of a business");

  const { data: role, error: rErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (rErr) throw rErr;
  if (role?.role !== "owner") throw new Error("Only owners can manage staff");
  return businessId as string;
}

type CreateInput = { name: string; email: string; password: string; role: AppRole };

export const createStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const d = data as CreateInput;
    if (!d || typeof d !== "object") throw new Error("Invalid payload");
    const name = String(d.name ?? "").trim();
    const email = String(d.email ?? "").trim().toLowerCase();
    const password = String(d.password ?? "");
    const role = d.role;
    if (!name) throw new Error("Name is required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email");
    if (password.length < 6) throw new Error("Password must be at least 6 characters");
    if (!ALLOWED_ROLES.includes(role)) throw new Error("Invalid role");
    return { name, email, password, role };
  })
  .handler(async ({ data, context }) => {
    const businessId = await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name },
    });
    if (cErr || !created.user) throw new Error(cErr?.message ?? "Failed to create user");
    const newUserId = created.user.id;

    // The handle_new_user trigger created the profile row. Attach to business.
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({ business_id: businessId, name: data.name, email: data.email, active: true })
      .eq("id", newUserId);
    if (upErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw upErr;
    }

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, business_id: businessId, role: data.role });
    if (roleErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw roleErr;
    }

    return { id: newUserId };
  });

export const resetStaffPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const d = data as { userId: string; password: string };
    if (!d?.userId) throw new Error("userId required");
    if (!d?.password || d.password.length < 6) throw new Error("Password must be at least 6 characters");
    return { userId: d.userId, password: d.password };
  })
  .handler(async ({ data, context }) => {
    const businessId = await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verify target belongs to same business.
    const { data: target, error } = await supabaseAdmin
      .from("profiles")
      .select("id,business_id")
      .eq("id", data.userId)
      .maybeSingle();
    if (error) throw error;
    if (!target || target.business_id !== businessId) throw new Error("Not found");

    const { error: uErr } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (uErr) throw uErr;
    return { ok: true };
  });

export const deleteStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const d = data as { userId: string };
    if (!d?.userId) throw new Error("userId required");
    return { userId: d.userId };
  })
  .handler(async ({ data, context }) => {
    const businessId = await assertOwner(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("You cannot remove yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: target, error } = await supabaseAdmin
      .from("profiles")
      .select("id,business_id")
      .eq("id", data.userId)
      .maybeSingle();
    if (error) throw error;
    if (!target || target.business_id !== businessId) throw new Error("Not found");

    const { error: dErr } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (dErr) throw dErr;
    return { ok: true };
  });
