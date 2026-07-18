/** React Query hooks for team management with realtime sync. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { listMembers, setMemberActive, type StaffRole } from "@/lib/services/staff.service";
import {
  createStaffMember,
  deleteStaffMember,
  resetStaffPassword,
} from "@/lib/staff.functions";

export const staffKeys = { all: (bid: string) => ["staff", bid] as const };

export function useMembers() {
  const { business } = useAuth();
  const qc = useQueryClient();
  const bid = business?.id ?? "";
  const query = useQuery({
    queryKey: staffKeys.all(bid),
    queryFn: listMembers,
    enabled: !!bid,
    staleTime: 10_000,
  });
  useEffect(() => {
    if (!bid) return;
    const channel = supabase
      .channel(`staff:${bid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        qc.invalidateQueries({ queryKey: staffKeys.all(bid) });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => {
        qc.invalidateQueries({ queryKey: staffKeys.all(bid) });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [bid, qc]);
  return query;
}

export function useCreateMember() {
  const { business } = useAuth();
  const qc = useQueryClient();
  const fn = useServerFn(createStaffMember);
  return useMutation({
    mutationFn: (input: { name: string; email: string; password: string; role: StaffRole }) =>
      fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: staffKeys.all(business?.id ?? "") }),
  });
}

export function useResetMemberPassword() {
  const fn = useServerFn(resetStaffPassword);
  return useMutation({
    mutationFn: (input: { userId: string; password: string }) => fn({ data: input }),
  });
}

export function useDeleteMember() {
  const { business } = useAuth();
  const qc = useQueryClient();
  const fn = useServerFn(deleteStaffMember);
  return useMutation({
    mutationFn: (userId: string) => fn({ data: { userId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: staffKeys.all(business?.id ?? "") }),
  });
}

export function useToggleMemberActive() {
  const { business } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, active }: { userId: string; active: boolean }) =>
      setMemberActive(userId, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: staffKeys.all(business?.id ?? "") }),
  });
}
