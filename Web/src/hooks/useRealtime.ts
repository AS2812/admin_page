import { useEffect } from "react";
import { useSupabase } from "../providers/SupabaseProvider";
import { sendIncidentsUpdate, type IncidentRow } from "../utils/dataBus";

export function useRealtimeDemoBridge(enabled = true) {
  const { client } = useSupabase();

  useEffect(() => {
    if (!enabled || !client) return;

    const reportsChannel = client
      .channel("reports_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, (payload) => {
        const next = payload.new as { report_id?: number; title?: string | null; location_name?: string | null; priority?: string | null; status?: string | null; created_at: string } | null;
        if (!next) return;
        const mapped: IncidentRow = {
          id: next.report_id ? `R#${next.report_id}` : `R#${Date.now()}`,
          title: next.title ?? "Report",
          area: next.location_name ?? "",
  severity: (next.priority ?? "low") as IncidentRow["severity"],
  status: (next.status ?? "submitted") as IncidentRow["status"],
          reportedDate: next.created_at,
        };
        try {
          const stored = JSON.parse(localStorage.getItem("dash:incidents") || "[]") as IncidentRow[];
          const idx = stored.findIndex((row) => row.id === mapped.id);
          if (idx >= 0) stored[idx] = mapped; else stored.unshift(mapped);
          sendIncidentsUpdate(stored);
        } catch (error) {
          console.warn("realtime merge failed", error);
        }
      })
      .subscribe();

    const alertsChannel = client
      .channel("alerts_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => {
        // placeholder for future UI updates
      })
      .subscribe();

    const dispatchesChannel = client
      .channel("dispatches_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "report_authority_dispatches" }, () => {
        // placeholder for dispatch updates
      })
      .subscribe();

    return () => {
      try { client.removeChannel(reportsChannel); } catch {}
      try { client.removeChannel(alertsChannel); } catch {}
      try { client.removeChannel(dispatchesChannel); } catch {}
    };
  }, [client, enabled]);
}
