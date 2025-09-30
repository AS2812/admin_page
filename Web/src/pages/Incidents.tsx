﻿import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../hooks/useI18n";
import { useAuth } from "../hooks/useAuth";
import "./incidents.css";
import "./users.css"; // reuse form/button look
import { fetchReports } from "../utils/supabaseQueries";
import { updateReport, deleteReport, updateReportFields } from "../utils/api";

type MediaItem = { type: "image" | "video"; url: string; poster?: string };

type Row = {
  id: string;
  title: string;
  area: string;
  severity: "low" | "normal";
  status: "submitted" | "assigned" | "resolved";
  reportedDate: string;
  reporter?: string;
  reporterId?: string;  // 14-digit national ID
  category?: string;
  subcategory?: string;
  alerted?: "people" | "government" | "both";
  media?: MediaItem[];             // <-- optional media
};

// Supabase-only: no mock data

type DatePreset = "all" | "today" | "7" | "30";

/* ---------- small custom dropdown (unchanged) ---------- */
type Opt = { value: string; label: string };

function Dropdown({
  label, value, onChange, options, emptyIsHidden = true, ariaLabel,
}:{
  label:string; value:string; onChange:(v:string)=>void; options:Opt[]; emptyIsHidden?:boolean; ariaLabel?:string;
}){
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number>(() => Math.max(0, options.findIndex(o => o.value === value)));
  const selected = options.find(o => o.value === value);
  const showValue = !(emptyIsHidden && value === "all");

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!open) return;
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !listRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (open && e.key === "Escape") { setOpen(false); btnRef.current?.focus(); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const toggle = () => setOpen(o => !o);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault(); setOpen(true);
      setActive(Math.max(0, options.findIndex(o => o.value === value)));
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(i => Math.min(options.length - 1, i + 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActive(i => Math.max(0, i - 1)); }
    if (e.key === "Home")      { e.preventDefault(); setActive(0); }
    if (e.key === "End")       { e.preventDefault(); setActive(options.length - 1); }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const opt = options[active]; if (opt) { onChange(opt.value); setOpen(false); btnRef.current?.focus(); }
    }
  };

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLLIElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  return (
    <div className={`filter pill dd ${!showValue ? "dd--empty" : ""}`}>
      <span className="label">{label}</span>
      <button
        ref={btnRef}
        type="button"
        className="dd-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || label}
        onClick={toggle}
        onKeyDown={onKeyDown}
      >
        {showValue ? (selected?.label ?? "") : ""}
        <span className="caret" aria-hidden>▾</span>
      </button>

      {open && (
        <ul ref={listRef} className="dd-menu" role="listbox" tabIndex={-1} aria-label={label}>
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={`dd-item ${i === active ? "is-active" : ""} ${o.value === value ? "is-selected" : ""}`}
              data-index={i}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); onChange(o.value); setOpen(false); }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
/* ------------------------------------------------------------------------------ */

function tFallback(t:(k:string)=>string, lang:string, key:string, en:string, ar?:string) {
  const v = t(key);
  if (!v || v === key) return lang==="ar" && ar ? ar : en;
  return v;
}

/* input sanitizers */
const onlyLettersAndSpaces = (s: string) => (s || "").replace(/[^\p{L}\s]/gu, "").replace(/\s{2,}/g, " ").trimStart();
const onlyDigitsMax = (s: string, max: number) => (s || "").replace(/\D/g, "").slice(0, max);

export default function IncidentPage(){
  const { t, lang } = useI18n();
  const session = useAuth();
  const isAdmin = !!session?.isAdmin;

  useEffect(() => { document.documentElement.setAttribute("data-lang", lang || "en"); }, [lang]);

  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await fetchReports();
        if (mounted) setRows(data as any);
      } catch (e) {
        console.warn("load incidents failed", e);
      }
    })();
    return () => { mounted = false; };
  }, []);
  const [selected, setSelected] = useState<Row|null>(null);
  const [mode, setMode] = useState<"view"|"edit">("view");
  const [draft, setDraft] = useState<Partial<Row>|null>(null);

  // delete confirm + undo
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [lastDeleted, setLastDeleted] = useState<Row|null>(null);
  const [undoVisible, setUndoVisible] = useState(false);

  // filters
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState<"all"|"submitted"|"assigned"|"resolved">("all");
  const [fSeverity, setFSeverity] = useState<"all"|"low"|"normal">("all");
  const [dateRange, setDateRange] = useState<DatePreset>("all");

  const allLabel    = lang === "ar" ? "الكل" : "All";
  const todayLabel  = lang === "ar" ? "اليوم" : "Today";
  const last7Label  = lang === "ar" ? "آخر 7 أيام" : "Last 7 days";
  const last30Label = lang === "ar" ? "آخر 30 يوم" : "Last 30 days";

  const headers = useMemo(() => [
    tFallback(t, lang, "incident.columns.id",         "ID",          "المعرّف"),
    tFallback(t, lang, "incident.columns.title",      "Subject",     "الموضوع"),
    tFallback(t, lang, "incident.columns.area",       "Area",        "المنطقة"),
    tFallback(t, lang, "incident.columns.severity",   "Severity",    "الخطورة"),
    tFallback(t, lang, "incident.columns.status",     "Status",      "الحالة"),
    tFallback(t, lang, "incident.columns.reportedAt", "Reported at", "تاريخ البلاغ"),
    tFallback(t, lang, "incident.columns.action",     "Action",      "إجراء"),
  ], [t, lang]);

  const labelSearch   = tFallback(t, lang, "incident.search.placeholder", "Search by ID, title, or area", "ابحث بالمعرّف أو العنوان أو المنطقة");
  const labelStatus   = tFallback(t, lang, "incident.filters.status",     "Status", "الحالة");
  const labelSeverity = tFallback(t, lang, "incident.filters.severity",   "Severity", "الخطورة");
  const labelRange    = tFallback(t, lang, "incident.filters.dateRange",  "Date range", "المدى الزمني");

  const sevText = (s:Row["severity"]) =>
    s==="low" ? (lang==="ar"?"منخفضة":"Low") :
    (lang==="ar"?"عادية":"Normal");

  const stText = (s:Row["status"]) =>
    s==="submitted" ? (lang==="ar"?"مُرسلة":"Submitted") :
    s==="assigned" ? (lang==="ar"?"قيد المعالجة":"Assigned") :
    (lang==="ar"?"مغلقة":"Resolved");

  // date helpers
  const dateOnly = (iso: string) => iso.slice(0, 10);
  const daysAgoISO = (n:number) => { const dt=new Date(); dt.setHours(0,0,0,0); dt.setDate(dt.getDate()-n); return dt.toISOString().slice(0,10); };
  const todayISO   = () => { const dt=new Date(); dt.setHours(0,0,0,0); return dt.toISOString().slice(0,10); };

  const filtered = rows.filter(r => {
    const needle = q.trim().toLowerCase();
    const matchesQ = !needle || [r.id, r.title, r.area].some(v => v.toLowerCase().includes(needle));
    const matchesStatus = fStatus === "all" || r.status === fStatus;
    const matchesSeverity = fSeverity === "all" || r.severity === fSeverity;
    const dOnly = dateOnly(r.reportedDate);
    let matchesDate = true;
    if (dateRange === "today")  matchesDate = dOnly === todayISO();
    if (dateRange === "7")      matchesDate = dOnly >= daysAgoISO(7);
    if (dateRange === "30")     matchesDate = dOnly >= daysAgoISO(30);
    return matchesQ && matchesStatus && matchesSeverity && matchesDate;
  });

  const fmtDateTime = (iso:string) => {
    const d=new Date(iso);
    const ds=d.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"2-digit"});
    const ts=d.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"});
    return `${ds} ${ts}`;
  };

  const statusOpts: Opt[] = [
    { value:"all",      label: allLabel },
    { value:"submitted",label: tFallback(t, lang, "incident.status.submitted", "Submitted", "مُرسلة") },
    { value:"assigned", label: tFallback(t, lang, "incident.status.assigned", "Assigned", "قيد المعالجة") },
    { value:"resolved", label: tFallback(t, lang, "incident.status.resolved", "Resolved", "مغلقة") },
  ];
  const severityOpts: Opt[] = [
    { value:"all",     label: allLabel },
    { value:"low",     label: tFallback(t, lang, "incident.severity.low",     "Low", "منخفضة") },
    { value:"normal",  label: tFallback(t, lang, "incident.severity.normal",  "Normal", "عادية") },
  ];
  const rangeOpts: Opt[] = [
    { value:"all", label: allLabel },
    { value:"today", label: todayLabel },
    { value:"7", label: last7Label },
    { value:"30", label: last30Label },
  ];

  // modal actions
  const openDetails = (r:Row) => { setSelected(r); setMode("view"); setDraft(null); };

  const numericId = (idStr: string) => Number(String(idStr).replace(/\D/g, ""));

  const assignIncident = async () => {
    if (!isAdmin) { console.warn("assign blocked: non-admin"); return; }
    if (!selected) return;
    const idNum = numericId(selected.id);
    try {
      await updateReport(idNum, { status: "assigned" });
      setRows(p => p.map(x => x.id===selected.id ? { ...x, status:"assigned" } : x));
      setSelected(s => s ? { ...s, status:"assigned" } : s);
    } catch (e) {
      console.warn("assign failed", e);
    }
  };

  const resolveIncident = async () => {
    if (!isAdmin) { console.warn("resolve blocked: non-admin"); return; }
    if (!selected) return;
    const idNum = numericId(selected.id);
    try {
      await updateReport(idNum, { status: "resolved" });
      setRows(p => p.map(x => x.id===selected.id ? { ...x, status:"resolved" } : x));
      setSelected(s => s ? { ...s, status:"resolved" } : s);
    } catch (e) {
      console.warn("resolve failed", e);
    }
  };

  const requestDelete = () => setConfirmDeleteOpen(true);

  const doDelete = async () => {
    if (!isAdmin) { console.warn("delete blocked: non-admin"); return; }
    if (!selected) return;
    const idNum = numericId(selected.id);
    try {
      await deleteReport(idNum);
      setRows(prev => prev.filter(x => x.id !== selected.id));
      setSelected(null);
      setConfirmDeleteOpen(false);
      setUndoVisible(false);
    } catch (e) {
      console.warn("delete failed", e);
    }
  };

  const undoDelete = () => {
    if (!lastDeleted) return;
    setRows(prev => [lastDeleted, ...prev]); // put back on top
    setLastDeleted(null);
    setUndoVisible(false);
  };

  const enterEdit = () => {
    if (!isAdmin) { console.warn("edit blocked: non-admin"); return; }
    if (!selected) return;
    setMode("edit");
    setDraft({
      title:selected.title, area:selected.area, severity:selected.severity, status:selected.status,
      category:selected.category||"", subcategory:selected.subcategory||"", alerted:selected.alerted||"people",
      reporter:selected.reporter||"", reporterId:selected.reporterId||""
    });
  };

  const saveEdit = async () => {
    if (!isAdmin) { console.warn("save blocked: non-admin"); return; }
    if (!selected || !draft) return;
    const idNum = numericId(selected.id);
    // Map severity -> priority for API (only low/normal)
    const sevToPrio = (s: Row["severity"]) => (s === "normal" ? "normal" : "low");
    try {
      // Status/priority via server API
      if (draft.status || draft.severity) {
        await updateReport(idNum, {
          status: (draft.status as any) || undefined,
          priority: draft.severity ? (sevToPrio(draft.severity as any) as any) : undefined,
        });
      }
      // Title/area/notify_scope directly in Supabase
      await updateReportFields(idNum, {
        title: draft.title || undefined,
        location_name: draft.area || undefined,
        notify_scope: (draft.alerted as any) || undefined,
      });

      const patch: Partial<Row> = {
        title: draft.title, area: draft.area,
        severity: draft.severity as Row["severity"],
        status: draft.status as Row["status"],
        category: draft.category, subcategory: draft.subcategory,
        alerted: draft.alerted as Row["alerted"],
        reporter: draft.reporter, reporterId: draft.reporterId,
      };
      setRows(p=>p.map(x=>x.id===selected.id?{...x,...patch}:x));
      setSelected(s=>s?{...s,...patch}:s);
      setMode("view"); setDraft(null);
    } catch (e) {
      console.warn("edit failed", e);
    }
  };

  const cancelEdit = () => { setMode("view"); setDraft(null); };

  /* input rules */
  const onChangeReporter = (v: string) => setDraft(d => ({ ...(d||{}), reporter: onlyLettersAndSpaces(v) }));
  const onChangeReporterId = (v: string) => setDraft(d => ({ ...(d||{}), reporterId: onlyDigitsMax(v, 14) }));

  return (
    <div className="page users-page">
    <section>
      {/* FILTERS */}
      <div className="filters-row filters-row--tightline" data-dir={lang}>
        <label className="filter pill search" aria-label={labelSearch} title={labelSearch}>
          <span className="icon" aria-hidden>🔎</span>
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder={labelSearch}/>
        </label>
        <Dropdown label={labelStatus} value={fStatus} onChange={v=>setFStatus(v as any)} options={statusOpts} ariaLabel={labelStatus}/>
        <Dropdown label={labelSeverity} value={fSeverity} onChange={v=>setFSeverity(v as any)} options={severityOpts} ariaLabel={labelSeverity}/>
        <Dropdown label={labelRange} value={dateRange} onChange={v=>setDateRange(v as DatePreset)} options={rangeOpts} ariaLabel={labelRange}/>
      </div>

      {/* TABLE — match Users table layout */}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>{headers.map(h => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.title}</td>
                <td>{r.area}</td>
                <td><span className={`sev sev--${r.severity}`}>{sevText(r.severity)}</span></td>
                <td>{stText(r.status)}</td>
                <td className="numfont">{fmtDateTime(r.reportedDate)}</td>
                <td className="actions-cell">
                  <button className="btn btn--outline" onClick={() => openDetails(r)}>
                    {lang === "ar" ? "تفاصيل" : "Details"}
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={headers.length} style={{ textAlign: "center", padding: "24px 0", opacity: 0.7 }}>
                  {lang === "ar" ? "لا توجد بلاغات مطابقة" : "No reports match the current filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* DETAILS MODAL */}
      {selected && (
        <div className="users-modal__backdrop" onMouseDown={()=>setSelected(null)}>
          <div className="users-modal" role="dialog" aria-modal="true" onMouseDown={e=>e.stopPropagation()}>
            <div className="users-modal__header">
              <h3 className="users-modal__title">{lang==="ar"?"تفاصيل البلاغ":"Incident Details"}</h3>
              <button className="users-modal__close" onClick={()=>setSelected(null)} aria-label="Close">×</button>
            </div>

            {mode === "view" ? (
              <div className="users-modal__content">
                <Field label={lang==="ar"?"المعرّف":"ID"}         value={selected.id}/>
                <Field label={lang==="ar"?"العنوان":"Title"}       value={selected.title}/>
                <Field label={lang==="ar"?"المنطقة":"Area"}        value={selected.area}/>
                <Field label={lang==="ar"?"الخطورة":"Severity"}    value={sevText(selected.severity)}/>
                <Field label={lang==="ar"?"الحالة":"Status"}       value={stText(selected.status)}/>
                <Field label={lang==="ar"?"تاريخ الإبلاغ":"Reported at"} value={fmtDateTime(selected.reportedDate)}/>
                <Field label={lang==="ar"?"المبلّغ":"Reported by"} value={selected.reporter || "—"}/>
                <Field label={lang==="ar"?"الرقم القومي للمبلّغ":"Reporter National ID"} value={selected.reporterId || "—"}/>
                <Field label={lang==="ar"?"الفئة":"Category"}      value={selected.category || "—"}/>
                <Field label={lang==="ar"?"الفئة الفرعية":"Subcategory"} value={selected.subcategory || "—"}/>
                <Field label={lang==="ar"?"الجهة المُخطَرة":"Alerted Parties"} value={
                  selected.alerted==="people" ? (lang==="ar"?"المواطنون":"People")
                  : selected.alerted==="government" ? (lang==="ar"?"الحكومة":"Government")
                  : selected.alerted==="both" ? (lang==="ar"?"الكل":"Both")
                  : "—"
                }/>
                {/* Photos/Videos */}
                <div className="incident-field" style={{ gridColumn:"1 / -1" }}>
                  <span className="label">{lang==="ar" ? "صور/فيديوهات" : "Photos/Videos"}</span>
                  <MediaGrid items={selected.media}/>
                </div>
              </div>
            ) : (
              <div className="users-modal__content users-form">
                <div className="users-field">
                  <span className="label">{lang==="ar"?"العنوان":"Title"}</span>
                  <input value={draft?.title ?? ""} onChange={e=>setDraft({ ...(draft||{}), title:e.target.value })}/>
                </div>
                <div className="users-field">
                  <span className="label">{lang==="ar"?"المنطقة":"Area"}</span>
                  <input value={draft?.area ?? ""} onChange={e=>setDraft({ ...(draft||{}), area:e.target.value })}/>
                </div>
                <div className="users-field">
                  <span className="label">{lang==="ar"?"الخطورة":"Severity"}</span>
                  <select value={(draft?.severity as Row["severity"]) ?? "low"} onChange={e=>setDraft({ ...(draft||{}), severity: e.target.value as Row["severity"] })}>
                    <option value="low">{lang==="ar"?"منخفضة":"Low"}</option>
                    <option value="normal">{lang==="ar"?"عادية":"Normal"}</option>
                  </select>
                </div>
                <div className="users-field">
                  <span className="label">{lang==="ar"?"الحالة":"Status"}</span>
                  <select value={(draft?.status as Row["status"]) ?? "submitted"} onChange={e=>setDraft({ ...(draft||{}), status: e.target.value as Row["status"] })}>
                    <option value="submitted">{lang==="ar"?"مُرسلة":"Submitted"}</option>
                    <option value="assigned">{lang==="ar"?"قيد المعالجة":"Assigned"}</option>
                    <option value="resolved">{lang==="ar"?"مغلقة":"Resolved"}</option>
                  </select>
                </div>
                <div className="users-field">
                  <span className="label">{lang==="ar"?"المبلّغ":"Reported by"}</span>
                  <input
                    value={draft?.reporter ?? ""}
                    onChange={(e) => onChangeReporter(e.target.value)}  /* <-- use handler */
                    placeholder={lang==="ar"?"أحرف ومسافات فقط":"Letters and spaces only"}
                  />
                </div>
                <div className="users-field">
                  <span className="label">{lang==="ar"?"الرقم القومي للمبلّغ":"Reporter National ID"}</span>
                  <input
                    value={draft?.reporterId ?? ""}
                    onChange={(e) => onChangeReporterId(e.target.value)}  /* <-- use handler */
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={14}
                    placeholder={lang==="ar"?"14 رقمًا":"14 digits"}
                    onKeyDown={(ev) => {
                      const k = ev.key;
                      const allowed = ["Backspace","Delete","ArrowLeft","ArrowRight","Tab","Home","End"];
                      if (!allowed.includes(k) && !/^\d$/.test(k)) ev.preventDefault();
                    }}
                  />
                </div>
                <div className="users-field">
                  <span className="label">{lang==="ar"?"الفئة":"Category"}</span>
                  <input value={draft?.category ?? ""} onChange={e=>setDraft({ ...(draft||{}), category:e.target.value })}/>
                </div>
                <div className="users-field">
                  <span className="label">{lang==="ar"?"الفئة الفرعية":"Subcategory"}</span>
                  <input value={draft?.subcategory ?? ""} onChange={e=>setDraft({ ...(draft||{}), subcategory:e.target.value })}/>
                </div>
                <div className="users-field">
                  <span className="label">{lang==="ar"?"الجهة المُخطَرة":"Alerted Parties"}</span>
                  <select value={(draft?.alerted as Row["alerted"]) ?? "people"} onChange={e=>setDraft({ ...(draft||{}), alerted:e.target.value as Row["alerted"] })}>
                    <option value="people">{lang==="ar"?"المواطنون":"People"}</option>
                    <option value="government">{lang==="ar"?"الحكومة":"Government"}</option>
                    <option value="both">{lang==="ar"?"الكل":"Both"}</option>
                  </select>
                </div>
              </div>
            )}

            <div className="users-modal__footer">
              <div className="left" style={{ display:"flex", gap:8 }}>
                {mode === "view" && selected.status === "submitted" && (
                  <button className="btn btn--primary" onClick={assignIncident}>
                    {lang==="ar"?"إسناد":"Assign"}
                  </button>
                )}
                {mode === "view" && selected.status !== "resolved" && (
            <button className="btn btn--success" onClick={resolveIncident} disabled={!isAdmin}>
              {lang==="ar"?"حلّ":"Resolve"}
            </button>
                )}
              </div>

              <div className="right" style={{ display:"flex", gap:8 }}>
                {mode === "view" ? (
                  <>
            <button className="btn btn--outline" onClick={enterEdit} disabled={!isAdmin}>{lang==="ar"?"تعديل":"Edit"}</button>
                    <button className="btn btn--danger" onClick={requestDelete}>{lang==="ar"?"حذف":"Delete"}</button> {/* <-- use requestDelete */}
                  </>
                ) : (
                  <>
                    <button className="btn btn--outline" onClick={cancelEdit}>{lang==="ar"?"إلغاء":"Cancel"}</button>
            <button className="btn btn--primary" onClick={saveEdit} disabled={!isAdmin}>{lang==="ar"?"حفظ":"Save"}</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE (small modal) */}
      {confirmDeleteOpen && (
        <div className="confirm-modal__backdrop" onMouseDown={()=>setConfirmDeleteOpen(false)}>
          <div className="confirm-modal" role="dialog" aria-modal="true" onMouseDown={e=>e.stopPropagation()}>
            <div className="confirm-modal__header">
              <strong>{lang==="ar"?"تأكيد الحذف":"Confirm Delete"}</strong>
              {/* use same close style as details modal */}
              <button className="users-modal__close" onClick={()=>setConfirmDeleteOpen(false)} aria-label="Close">×</button>
            </div>
            <div className="confirm-modal__body">
              {lang==="ar"
                ? "هل أنت متأكد من حذف هذا البلاغ؟ هذا الإجراء لا يمكن التراجع عنه."
                : "Are you sure you want to delete this incident? This action cannot be undone."}
            </div>
            <div className="confirm-modal__footer" 
                style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              {/* Cancel on left */}
              <button className="btn btn--outline" onClick={()=>setConfirmDeleteOpen(false)}>
                {lang==="ar"?"إلغاء":"Cancel"}
              </button>
              {/* Delete on right */}
            <button className="btn btn--danger" onClick={doDelete} disabled={!isAdmin}>
              {lang==="ar"?"حذف":"Delete"}
            </button>
            </div>
          </div>
        </div>
      )}

      {/* UNDO toast removed: server-side deletes cannot be undone here */}
    </section>
    </div>
  );
}

/* tiny helper */
function Field({ label, value }: { label: string; value?: string }){
  return (
    <div className="incident-field">
      <span className="label">{label}</span>
      <span className="value">{value ?? "—"}</span>
    </div>
  );
}

function MediaGrid({ items }: { items?: MediaItem[] }){
  if (!items || items.length === 0) return <span className="value">—</span>;
  return (
    <div style={{
      display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(120px, 1fr))",
      gap:12, width:"100%"
    }}>
      {items.map((m, i) => (
        m.type === "image" ? (
          <a key={i} href={m.url} target="_blank" rel="noreferrer"
            style={{ display:"block", borderRadius:8, overflow:"hidden", border:"1px solid var(--line,#e5e7eb)" }}>
            <img src={m.url} alt={`media ${i+1}`} style={{ width:"100%", height:100, objectFit:"cover" }}/>
          </a>
        ) : (
          <video key={i} controls preload="metadata"
            style={{ width:"100%", height:120, borderRadius:8, border:"1px solid var(--line,#e5e7eb)", background:"#000" }}
            poster={m.poster}>
            <source src={m.url} />
          </video>
        )
      ))}
    </div>
  );
}
