import { useEffect, useMemo, useState } from "react";
import "./dashboard.css";
import { t, getLang } from "../i18n";
import { type IncidentRow, type ComplaintRow } from "../utils/dataBus";
import {
  fetchReports,
  fetchComplaints,
  fetchReportDetail,
  type ReportDetail,
} from "../utils/supabaseQueries";
import { updateReport, deleteReport, addReportNote } from "../utils/api";
import MapLibreMap from "../components/MapLibreMap";
import ReportCard from "../components/ReportCard";

const lastNDays = (count: number) => {
  const days: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d.toISOString());
  }
  return days;
};

const shortDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const formatDateTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

const mapSeverityClass: Record<IncidentRow["severity"], string> = {
  low: "sev sev--low",
  normal: "sev sev--normal",
};

const statusFromDetail = (value: string | null | undefined): IncidentRow["status"] => {
  switch ((value || "submitted").toLowerCase()) {
    case "resolved":
      return "resolved";
    case "assigned":
    case "reviewing":
    case "published":
      return "assigned";
    default:
      return "submitted";
  }
};

export default function Dashboard() {
  const [, forceLangRefresh] = useState(0);
  const [lang, setLangState] = useState(getLang());
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [complaints, setComplaints] = useState<ComplaintRow[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<ReportDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: CustomEvent<string>) => {
      forceLangRefresh((value) => value + 1);
      if (event.detail) setLangState(event.detail as "en" | "ar");
    };
    window.addEventListener("i18n:change", handler as EventListener);
    return () => window.removeEventListener("i18n:change", handler as EventListener);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchReports();
        if (data.length) {
          setIncidents(data);
          if (!selectedIncidentId) setSelectedIncidentId(data[0].id);
        }
      } catch (error) {
        console.warn("fetchReports", error);
      }
      try {
        const data = await fetchComplaints();
        if (data.length) {
          setComplaints(data);
        }
      } catch (error) {
        console.warn("fetchComplaints", error);
      }
    })();
  }, [selectedIncidentId]);

  useEffect(() => {
    const numericId = selectedIncidentId ? Number(String(selectedIncidentId).replace(/\D/g, "")) : null;
    if (!numericId) {
      setSelectedDetail(null);
      return;
    }
    setDetailLoading(true);
    setDetailError(null);
    (async () => {
      try {
        const detail = await fetchReportDetail(numericId);
        if (!detail) {
          setDetailError("Report details are not available.");
        }
        setSelectedDetail(detail);
      } catch (error) {
        console.warn("fetchReportDetail", error);
        setDetailError("Failed to load report details.");
      } finally {
        setDetailLoading(false);
      }
    })();
  }, [selectedIncidentId]);

  const today = new Date();
  const allRecords = useMemo(() => [...incidents, ...complaints], [incidents, complaints]);

  const reportsToday = useMemo(
    () => allRecords.filter((record) => {
      const created = new Date(record.reportedDate);
      return created.toDateString() === today.toDateString();
    }).length,
    [allRecords]
  );

  const openReports = useMemo(
    () => allRecords.filter((record) => record.status === "submitted").length,
    [allRecords]
  );

  const resolvedReports = useMemo(
    () => allRecords.filter((record) => record.status === "resolved").length,
    [allRecords]
  );

  const dailySeries = useMemo(() => {
    const days = lastNDays(7);
    return days.map((dayIso) => {
      const dayStart = new Date(dayIso);
      const nextDay = new Date(dayStart);
      nextDay.setDate(dayStart.getDate() + 1);
      const count = allRecords.filter((record) => {
        const created = new Date(record.reportedDate);
        return created >= dayStart && created < nextDay;
      }).length;
      return { iso: dayIso, count };
    });
  }, [allRecords]);

  const chartMax = Math.max(1, ...dailySeries.map((point) => point.count));
  const chartPoints = dailySeries
    .map((point, index) => {
      const x = 40 + (index / Math.max(1, dailySeries.length - 1)) * 640;
      const y = 180 - (chartMax === 0 ? 0 : (point.count / chartMax) * 160);
      return `${x},${y}`;
    })
    .join(" ");

  const updateIncidentsStatus = (status: IncidentRow["status"]) => {
    if (!selectedIncidentId) return;
    setIncidents((prev) => {
      return prev.map((row) => (row.id === selectedIncidentId ? { ...row, status } : row));
    });
    setSelectedDetail((prev) => (prev ? { ...prev, status } : prev));
  };

  const runAction = async (fn: () => Promise<void>, message: string) => {
    setActionError(null);
    setActionMessage(null);
    try {
      await fn();
      setActionMessage(message);
    } catch (error: any) {
      setActionError(error?.message || "Action failed");
    }
  };

  const numericSelectedId = selectedIncidentId ? Number(String(selectedIncidentId).replace(/\D/g, "")) : null;

  const handleAssign = () => {
    if (!numericSelectedId) return;
    runAction(async () => {
      await updateReport(numericSelectedId, { status: "assigned" });
      updateIncidentsStatus("assigned");
    }, lang === "ar" ? "تم إسناد البلاغ" : "Report assigned");
  };

  const handleResolve = () => {
    if (!numericSelectedId) return;
    runAction(async () => {
      await updateReport(numericSelectedId, { status: "resolved" });
      updateIncidentsStatus("resolved");
    }, lang === "ar" ? "تم إغلاق البلاغ" : "Report resolved");
  };

  const handleDelete = () => {
    if (!numericSelectedId) return;
    runAction(async () => {
      await deleteReport(numericSelectedId);
      const nextIncidents = incidents.filter((row) => row.id !== selectedIncidentId);
      setIncidents(nextIncidents);
      setSelectedIncidentId(nextIncidents[0]?.id ?? null);
      setSelectedDetail(null);
    }, lang === "ar" ? "تم حذف البلاغ" : "Report deleted");
  };

  const handleAddNote = () => {
    if (!numericSelectedId) return;
    const message = noteValue.trim();
    if (!message) return;
    runAction(async () => {
      await addReportNote(numericSelectedId, message);
      setNoteValue("");
    }, lang === "ar" ? "تم حفظ الملاحظة" : "Note saved");
  };

  return (
    <div className="page">
      <div className="kpis">
        <div className="card">
          <div className="strip" />
          <div className="kpi-title">{t("kpi.reportsToday")}</div>
          <div className="kpi-value numfont">{reportsToday}</div>
        </div>
        <div className="card">
          <div className="strip" />
          <div className="kpi-title">{t("kpi.openReports")}</div>
          <div className="kpi-value numfont">{openReports}</div>
        </div>
        <div className="card">
          <div className="strip" />
          <div className="kpi-title">{t("kpi.resolvedReports")}</div>
          <div className="kpi-value numfont">{resolvedReports}</div>
        </div>
        <div className="card">
          <div className="strip" />
          <div className="kpi-title">{t("kpi.avgResponse")}</div>
          <div className="kpi-value numfont">{Math.max(1, Math.round(openReports * 1.8))}m</div>
        </div>
      </div>

      <div className="card">
        <div className="title">{lang === "ar" ? "الإبلاغات على مدار الأسبوع" : "Reports over the last 7 days"}</div>
        <svg viewBox="0 0 720 220" role="img" aria-label="Reports per day">
          <polyline fill="none" stroke="#01a1e7" strokeWidth="4" points={chartPoints} />
          {dailySeries.map((point, index) => {
            const x = 40 + (index / Math.max(1, dailySeries.length - 1)) * 640;
            const y = 180 - (chartMax === 0 ? 0 : (point.count / chartMax) * 160);
            return <circle key={point.iso} cx={x} cy={y} r={4} fill="#01a1e7" />;
          })}
          {dailySeries.map((point, index) => {
            const x = 40 + (index / Math.max(1, dailySeries.length - 1)) * 640;
            return (
              <text key={`${point.iso}-label`} x={x} y={205} textAnchor="middle" fontSize="11" fill="#64748b" className="numfont">
                {shortDate(point.iso)}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="grid2b">
        <div className="card">
          <div className="title">{t("sections.recent")}</div>
          <table className="table">
            <thead>
              <tr>
                <th>{t("table.id")}</th>
                <th>{t("table.title")}</th>
                <th>{t("table.area")}</th>
                <th>{t("table.severity")}</th>
                <th>{t("table.status")}</th>
                <th className="numfont">{t("table.reportedAt")}</th>
              </tr>
            </thead>
            <tbody>
              {incidents.slice(0, 5).map((row) => (
                <tr key={row.id} className={row.id === selectedIncidentId ? "is-selected" : ""} onClick={() => setSelectedIncidentId(row.id)}>
                  <td>{row.id}</td>
                  <td>{row.title}</td>
                  <td>{row.area}</td>
                  <td><span className={mapSeverityClass[row.severity]}>{t(`incident.severity.${row.severity}`)}</span></td>
                  <td>{t(`incident.status.${row.status}`)}</td>
                  <td className="numfont">{formatDateTime(row.reportedDate)}</td>
                </tr>
              ))}
              {incidents.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "24px 0", opacity: 0.7 }}>
                    {lang === "ar" ? "لا توجد بلاغات" : "No incidents"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={`card details${lang === "ar" ? " rtl" : ""}`}>
          <div className="title">{t("sections.details")}</div>
          {detailLoading && <div style={{ padding: 16, opacity: 0.7 }}>{t("incident.loadingDetail")}</div>}
          {detailError && <div style={{ padding: 16, color: "#dc2626" }}>{detailError}</div>}
          {!detailLoading && !detailError && !selectedDetail && (
            <div style={{ padding: 16, opacity: 0.7 }}>{t("incident.noSelection")}</div>
          )}
          {selectedDetail && (
            <div className="fields">
              <div className="incident-field"><span className="label">{t("table.id")}</span><span className="value">R#{selectedDetail.id}</span></div>
              <div className="incident-field"><span className="label">{t("table.title")}</span><span className="value">{selectedDetail.title}</span></div>
              <div className="incident-field"><span className="label">{t("table.area")}</span><span className="value">{selectedDetail.locationName || selectedDetail.city || "—"}</span></div>
              <div className="incident-field"><span className="label">{t("details.severityCategory")}</span><span className="value">{[selectedDetail.priority, selectedDetail.category, selectedDetail.subcategory].filter(Boolean).join(" · ") || "—"}</span></div>
              <div className="incident-field"><span className="label">{t("table.status")}</span><span className="value">{t(`incident.status.${statusFromDetail(selectedDetail.status)}`)}</span></div>
              <div className="incident-field"><span className="label">{t("table.reportedAt")}</span><span className="value">{formatDateTime(selectedDetail.createdAt)}</span></div>
              <div className="incident-field"><span className="label">{lang === "ar" ? "الوصف" : "Description"}</span><span className="value">{selectedDetail.description || "—"}</span></div>
              <div className="incident-field"><span className="label">{lang === "ar" ? "المبلغ" : "Reporter"}</span><span className="value">{selectedDetail.reporterName || "—"}</span></div>
              <div className="incident-field"><span className="label">{lang === "ar" ? "هوية المبلغ" : "Reporter ID"}</span><span className="value">{selectedDetail.reporterId || "—"}</span></div>

              {actionError && <div className="form-error">{actionError}</div>}
              {actionMessage && <div className="form-success">{actionMessage}</div>}

              <div className="actions">
                {statusFromDetail(selectedDetail.status) !== "assigned" && (
                  <button className="btn btn--primary" onClick={handleAssign}>{t("actions.assign")}</button>
                )}
                {statusFromDetail(selectedDetail.status) !== "resolved" && (
                  <button className="btn btn--success" onClick={handleResolve}>{t("actions.resolve")}</button>
                )}
                <button className="btn btn--danger" onClick={handleDelete}>{t("actions.delete")}</button>
              </div>

              <div className="incident-note">
                <label htmlFor="dashboard-note-input">{lang === "ar" ? "إضافة ملاحظة" : "Add note"}</label>
                <textarea
                  id="dashboard-note-input"
                  rows={3}
                  value={noteValue}
                  onChange={(event) => setNoteValue(event.target.value)}
                  placeholder={lang === "ar" ? "اكتب ملاحظة للفريق" : "Write a note for the operations team"}
                />
                <button className="btn" onClick={handleAddNote} disabled={!noteValue.trim()}>
                  {t("actions.note")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid2b">
        <div className="card">
          <div className="title">{t("sections.mapPreview")}</div>
          <MapLibreMap height={320} />
        </div>

        <div className="card">
          <div className="title">{t("complaints.recent")}</div>
          <div className="list-wrap" style={{ display: "grid", gap: 12 }}>
            {complaints.slice(0, 5).map((row) => (
              <ReportCard
                key={row.id}
                id={row.id}
                title={row.title}
                area={row.area}
                status={row.status}
                reportedDate={row.reportedDate}
                kind="complaint"
                category={row.category}
              />
            ))}
            {complaints.length === 0 && (
              <div style={{ textAlign: "center", padding: "24px 0", opacity: 0.7 }}>
                {lang === "ar" ? "لا توجد شكاوى" : "No complaints"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

