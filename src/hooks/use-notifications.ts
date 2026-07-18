/** React Query hooks for notifications, with realtime sync. */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Database } from "@/integrations/supabase/types";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

export const notificationKeys = {
  all: (businessId: string) => ["notifications", businessId] as const,
};

async function listNotifications(businessId: string): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export function useNotifications() {
  const { business } = useAuth();
  const qc = useQueryClient();
  const bid = business?.id ?? "";
  
  const query = useQuery({
    queryKey: notificationKeys.all(bid),
    queryFn: () => listNotifications(bid),
    enabled: !!bid,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!bid) return;
    const channelId = crypto.randomUUID();
    const channel = supabase
      .channel(`notifications:${bid}:${channelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        qc.invalidateQueries({ queryKey: notificationKeys.all(bid) });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [bid, qc]);

  return query;
}
