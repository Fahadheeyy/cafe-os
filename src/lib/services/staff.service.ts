/** Staff/team member reads. Writes go through server functions in staff.functions.ts. */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type StaffRole = Database["public"]["Enums"]["app_role"];

export type Member = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  role: StaffRole;
};

export async function listMembers(): Promise<Member[]> {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id,name,email,active")
    .order("created_at", { ascending: true });
  if (error) throw error;
  const ids = (profiles ?? []).map((p) => p.id);
  if (ids.length === 0) return [];
  const { data: roles, error: rErr } = await supabase
    .from("user_roles")
    .select("user_id,role")
    .in("user_id", ids);
  if (rErr) throw rErr;
  const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role as StaffRole]));
  return (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    active: p.active,
    role: roleMap.get(p.id) ?? "staff",
  }));
}

export async function setMemberActive(userId: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("profiles").update({ active }).eq("id", userId);
  if (error) throw error;
}
