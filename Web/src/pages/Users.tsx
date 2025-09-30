﻿// src/pages/UsersPage.tsx
import { useMemo, useRef, useState, useEffect } from "react";
import { useI18n } from "../hooks/useI18n";
import "./incidents.css";
import "./users.css";
import { fetchUsersBrief } from "../utils/supabaseQueries";
import { createUser as apiCreateUser, updateUser as apiUpdateUser, deleteUser as apiDeleteUser, suspendUser, activateUser } from "../utils/api";
import { useAuth } from "../hooks/useAuth";

type Role = "admin" | "user";
type Status = "verified" | "pending" | "banned";
type Active = "yes" | "no";

type UserRow = {
  id: string; // National ID (14 digits)
  name: string;
  role: Role;
  status: Status;
  active: Active;

  // details for dialog
  nationalIdNumber?: string;
  nationalIdImages?: string[];
  gender?: "female" | "male" | "other";
  phone?: string;               // 11 digits
  email?: string;               // new
  reportsSubmitted?: number | null; // new (null/undefined => show “—”)
  favoriteSpotsCount?: number;

  // NEW: optional avatar
  avatarUrl?: string;
};

// initial empty; will load from backend (Supabase)
const DATA: UserRow[] = [];

/* small dropdown identical behavior to other pages */
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

/* helpers for numeric-only inputs */
const DIGITS_ONLY = /[^0-9]/g;
function sanitizeDigits(s: string, max: number) {
  const only = s.replace(DIGITS_ONLY, "");
  return only.slice(0, max);
}
function allowDigitKey(e: React.KeyboardEvent<HTMLInputElement>) {
  const allowed = ["Backspace","Delete","Tab","ArrowLeft","ArrowRight","Home","End","Enter"];
  if (allowed.includes(e.key)) return;
  if (!/^[0-9]$/.test(e.key)) e.preventDefault();
}

/* tiny avatar helper */
function Avatar({ name, src }: { name: string; src?: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase() || "")
    .join("");
  const baseStyle: React.CSSProperties = {
    width: 36, height: 36, borderRadius: "50%", overflow: "hidden",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    background: "var(--bg-muted, #e5e7eb)", color: "#111", fontWeight: 700, fontSize: 14,
    flex: "0 0 auto"
  };
  if (src) {
    return (
      <img
        src={src}
        alt={`${name} avatar`}
        style={{ ...baseStyle, objectFit: "cover" }}
      />
    );
  }
  return <div style={baseStyle} aria-hidden>{initials || "?"}</div>;
}

export default function UsersPage(){
  const { t, lang } = useI18n(); // lang is used for gender labels below
  const session = useAuth();
  const isAdmin = !!session?.isAdmin;

  const [q, setQ] = useState("");
  const [fRole, setFRole] = useState<"all"|"admin"|"user">("all");
  const [fStatus, setFStatus] = useState<"all"|"verified"|"pending"|"banned">("all");
  const [fActive, setFActive] = useState<"all"|"yes"|"no">("all");

  const [rows, setRows] = useState<UserRow[]>(() => DATA);

  // Load users from backend
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await fetchUsersBrief();
        if (!mounted) return;
        setRows(list.map((u) => ({
          id: u.id,
          name: u.name,
          role: u.role,
          status: u.status,
          active: u.active,
          email: u.email,
        })));
      } catch (error) {
        console.warn("load users failed", error);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // View/Edit dialog
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<UserRow | null>(null);
  const [mode, setMode] = useState<"view"|"edit">("view");
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState<Partial<UserRow> | null>(null);

  // Add-user dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState<Partial<UserRow>>({
    name:"", role:"user", gender:"other", phone:"", email:"", nationalIdNumber:"", favoriteSpotsCount:0
  });

  const allLabel     = lang === "ar" ? "الكل" : "All";
  const labelSearch  = t("users.search.placeholder");
  const labelRole    = t("users.filters.role");
  const labelStatus  = t("users.filters.status");
  const labelActive  = t("users.filters.active");

  const roleOpts: Opt[] = [
    { value:"all",   label: allLabel },
    { value:"admin", label: lang === "ar" ? "مسؤول" : "Admin" },
    { value:"user",  label: lang === "ar" ? "مستخدم" : "User"  },
  ];
  const statusOpts: Opt[] = [
    { value:"all",      label: allLabel },
    { value:"verified", label: lang === "ar" ? "موثّق" : "Verified" },
    { value:"pending",  label: lang === "ar" ? "قيد المراجعة" : "Pending" },
    { value:"banned",   label: lang === "ar" ? "محظور" : "Banned" },
  ];
  const activeOpts: Opt[] = [
    { value:"all", label: allLabel },
    { value:"yes", label: lang === "ar" ? "نعم" : "Yes" },
    { value:"no",  label: lang === "ar" ? "لا"  : "No"  },
  ];

  const headers = useMemo(() => [
    t("users.columns.name"),
    t("users.columns.id"),
    t("users.columns.role"),
    t("users.columns.status"),
    t("users.columns.active"),
    t("users.columns.action"),
  ], [t, lang]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(r => {
      const matchesQ = !needle || [r.name, r.id].some(v => v.toLowerCase().includes(needle));
      const matchesRole = fRole === "all" || r.role === fRole;
      const matchesStatus = fStatus === "all" || r.status === fStatus;
      const matchesActive = fActive === "all" || r.active === fActive;
      return matchesQ && matchesRole && matchesStatus && matchesActive;
    });
  }, [q, fRole, fStatus, fActive, rows]);

  const openDetails = (u: UserRow) => {
    setCurrent(u);
    setMode("view");
    setDraft(null);
    setOpen(true);
  };

  // optimistic updates
  const setRow = (id: string, patch: Partial<UserRow>) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
    setCurrent(cur => cur && cur.id === id ? ({ ...cur, ...patch }) : cur);
  };

  const onVerifyToggle = async () => {
    if (!current) return;
    if (!isAdmin) { console.warn("verify toggle blocked: non-admin"); return; }
    setPending(true);
    try {
      const userId = Number(current.id);
      if (current.status === "verified") {
        await apiUpdateUser(userId, { account_status: "pending" });
        setRow(current.id, { status: "pending", active: "no" });
      } else {
        await activateUser(userId);
        setRow(current.id, { status: "verified", active: "yes" });
      }
    } catch (error) {
      console.warn("verify toggle failed", error);
    } finally {
      setPending(false);
    }
  };
  const onBanToggle = async () => {
    if (!current) return;
    if (!isAdmin) { console.warn("ban toggle blocked: non-admin"); return; }
    setPending(true);
    try {
      const userId = Number(current.id);
      const willUnban = current.status === "banned";
      if (willUnban) {
        await apiUpdateUser(userId, { account_status: "pending" });
        setRow(current.id, { status: "pending", active: "yes" });
      } else {
        await suspendUser(userId);
        setRow(current.id, { status: "banned", active: "no" });
      }
    } catch (error) {
      console.warn("ban toggle failed", error);
    } finally {
      setPending(false);
    }
  };

  const enterEdit = () => {
    if (!current) return;
    if (!isAdmin) { console.warn("edit blocked: non-admin"); return; }
    setDraft({
      name: current.name,
      role: current.role,
      gender: current.gender,
      phone: current.phone,
      email: current.email ?? "",
      // reportsSubmitted intentionally NOT editable anymore
    });
    setMode("edit");
  };

  const saveEdit = async () => {
    if (!current || !draft) return;
    if (!isAdmin) { console.warn("save blocked: non-admin"); return; }
    setPending(true);
    try {
      const userId = Number(current.id);
      await apiUpdateUser(userId, {
        name: draft.name || current.name,
        role: (draft.role as any) || current.role,
        email: draft.email ?? current.email,
        nationalIdNumber: draft.nationalIdNumber ?? current.nationalIdNumber,
      });
      setRow(current.id, draft);
      setMode("view");
      setDraft(null);
    } catch (error) {
      console.warn("save edit failed", error);
    } finally {
      setPending(false);
    }
  };

  const cancelEdit = () => {
    setMode("view");
    setDraft(null);
  };

  const onDelete = async () => {
    if (!current) return;
    if (!isAdmin) { console.warn("delete blocked: non-admin"); return; }
    setPending(true);
    try {
      const userId = Number(current.id);
      await apiDeleteUser(userId);
      setRows(prev => prev.filter(r => r.id !== current.id));
      setOpen(false);
    } catch (error) {
      console.warn("delete user failed", error);
    } finally {
      setPending(false);
    }
  };

  // Add user
  const openAdd = () => {
    if (!isAdmin) { console.warn("add blocked: non-admin"); return; }
    setAddDraft({ name:"", role:"user", gender:"other", phone:"", email:"", nationalIdNumber:"", favoriteSpotsCount:0 });
    setAddOpen(true);
  };
  const createUser = async () => {
    if (!isAdmin) { console.warn("create blocked: non-admin"); return; }
    const d = addDraft;
    if (!d.name || !d.nationalIdNumber) { return; }
    if ((d.nationalIdNumber ?? "").length !== 14) { return; }
    if ((d.phone ?? "").length > 0 && (d.phone ?? "").length !== 11) { return; }
    try {
      const created = await apiCreateUser({
        name: d.name!,
        role: (d.role as Role) || "user",
        email: d.email || undefined,
        nationalIdNumber: d.nationalIdNumber,
      });
      const status = String(created?.account_status || "pending").toLowerCase();
      const newStatus: Status = status === "verified" ? "verified" : status === "banned" ? "banned" : "pending";
      const newRow: UserRow = {
        id: String(created?.user_id ?? d.nationalIdNumber),
        name: d.name!,
        role: ((created?.role || d.role) as Role) || "user",
        status: newStatus,
        active: newStatus === "verified" ? "yes" : "no",
        nationalIdNumber: d.nationalIdNumber,
        gender: (d.gender as any) || "other",
        phone: d.phone || "",
        email: d.email || "",
        reportsSubmitted: null,
        favoriteSpotsCount: d.favoriteSpotsCount ?? 0,
      };
      setRows(prev => [newRow, ...prev]);
      setAddOpen(false);
    } catch (error) {
      console.warn("create user failed", error);
    }
  };

  // translated gender labels
  const G = {
    female: lang === "ar" ? "أنثى" : "female",
    male:   lang === "ar" ? "ذكر"  : "male",
    other:  lang === "ar" ? "أخرى" : "other",
  };

  const txt = {
    details: t("users.actions.details"),
    edit: t("users.actions.edit"),
    save: t("users.actions.save"),
    cancel: t("users.actions.cancel"),
    delete: t("users.actions.delete"),
    confirmDelete: t("users.actions.confirmDelete"),
    verify: t("users.actions.verify"),
    unverify: t("users.actions.unverify"),
    ban: t("users.actions.ban"),
    unban: t("users.actions.unban"),
    title: t("users.details.title"),
    fName: t("users.details.name"),
    fNatNum: t("users.details.nationalIdNumber"),
    fNatImgs: t("users.details.nationalIdImages"),
    fGender: t("users.details.gender"),
    fPhone: t("users.details.phone"),
    fEmail: t("users.details.email") || (lang==="ar" ? "البريد الإلكتروني" : "Email"),
    fReports: t("users.details.reports") || (lang==="ar" ? "عدد البلاغات" : "Reports Submitted"),
    fFavs: t("users.details.favourites"),
    addNew: t("users.actions.addNew") || (lang==="ar" ? "إضافة جديد" : "Add New"),
    roleLabel: t("users.filters.role"),
    roleAdmin: lang==="ar" ? "مسؤول" : "Admin",
    roleUser:  lang==="ar" ? "مستخدم" : "User",
    statusVerified: lang==="ar" ? "موثّق" : "Verified",
    statusPending:  lang==="ar" ? "قيد المراجعة" : "Pending",
    statusBanned:   lang==="ar" ? "محظور" : "Banned",
    activeYes: lang==="ar" ? "نعم" : "Yes",
    activeNo:  lang==="ar" ? "لا" : "No",
    create: t("users.actions.create") || (lang==="ar" ? "إنشاء" : "Create"),
  };

  return (
    <section>
      {/* filters row: Search longest, then filters smaller, then Add New same height */}
      <div className="filters-row filters-row--tightline">
        <label className="filter pill search search--long" aria-label={labelSearch} title={labelSearch}>
          <span className="icon" aria-hidden>🔎</span>
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder={labelSearch}/>
        </label>
        <div className="filters-group">
          <Dropdown label={labelRole}   value={fRole}   onChange={v=>setFRole(v as any)}   options={roleOpts}   ariaLabel={labelRole}/>
          <Dropdown label={labelStatus} value={fStatus} onChange={v=>setFStatus(v as any)} options={statusOpts} ariaLabel={labelStatus}/>
          <Dropdown label={labelActive} value={fActive} onChange={v=>setFActive(v as any)} options={activeOpts} ariaLabel={labelActive}/>
        </div>
        <button className="btn btn--primary add-new-fixed" onClick={openAdd}>
          <span aria-hidden>＋</span> {txt.addNew}
        </button>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>{headers.map(h => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={`${r.id}-${i}`}>
                <td>{r.name}</td>
                <td>{r.id}</td>
                <td>{r.role === "admin" ? txt.roleAdmin : txt.roleUser}</td>
                <td>
                  <span className={`tag tag--${r.status}`}>
                    {r.status === "verified" ? txt.statusVerified
                   : r.status === "pending"  ? txt.statusPending
                   : txt.statusBanned}
                  </span>
                </td>
                <td>
                  <span className={`tag tag--${r.active === "yes" ? "ok" : "no"}`}>
                    {r.active === "yes" ? txt.activeYes : txt.activeNo}
                  </span>
                </td>
                <td className="actions-cell">
                  <button className="btn btn--outline" onClick={() => openDetails(r)}>{txt.details}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* View/Edit Modal */}
      {open && current && (
        <div className="users-modal__backdrop" onMouseDown={() => setOpen(false)}>
          <div className="users-modal" role="dialog" aria-modal="true" onMouseDown={(e)=>e.stopPropagation()}>
            <div className="users-modal__header">
              <div className="users-modal__title" style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                <span>{txt.title} —</span>
                {/* Avatar + Name */}
                <span style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
                  <Avatar name={current.name} src={current.avatarUrl}/>
                  <span>{current.name}</span>
                </span>
                <div className="users-modal__badges" style={{ marginInlineStart:"auto" }}>
                  <span className={`tag tag--${current.status}`}>
                    {current.status === "verified" ? txt.statusVerified
                    : current.status === "pending" ? txt.statusPending
                    : txt.statusBanned}
                  </span>
                  <span className={`tag tag--${current.active === "yes" ? "ok" : "no"}`}>
                    {current.active === "yes" ? txt.activeYes : txt.activeNo}
                  </span>
                </div>
              </div>
              <button className="users-modal__close" aria-label="Close" onClick={() => setOpen(false)}>×</button>
            </div>

            {/* CONTENT */}
            {mode === "view" ? (
              <div className="users-modal__content">
                <Field label={txt.fName}   value={current.name}/>
                <Field label={txt.fNatNum} value={current.nationalIdNumber || current.id}/>
                <Field label={txt.roleLabel} value={current.role === "admin" ? txt.roleAdmin : txt.roleUser}/>
                <Field label={txt.fGender} value={current.gender ? (current.gender === "female" ? G.female : current.gender === "male" ? G.male : G.other) : "—"}/>
                <Field label={txt.fPhone}  value={current.phone || "—"}/>
                <Field label={txt.fEmail}  value={current.email || "—"}/>
                <Field label={txt.fReports} value={current.reportsSubmitted != null ? String(current.reportsSubmitted) : "—"}/>
                <Field label={txt.fFavs}   value={current.favoriteSpotsCount != null ? String(current.favoriteSpotsCount) : "0"}/>
                <div className="users-field" style={{ gridColumn: "1 / -1" }}>
                  <span className="label">{txt.fNatImgs}</span>
                  <div className="users-idgrid">
                    {(current.nationalIdImages?.length ? current.nationalIdImages : []).map((src, idx) => (
                      <a key={idx} href={src} target="_blank" rel="noreferrer">
                        <img className="users-idimg" src={src} alt={`ID ${idx+1}`} />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <EditForm
                G={G}
                draft={draft}
                setDraft={setDraft}
                labels={{
                  name:txt.fName, gender:txt.fGender, phone:txt.fPhone, email:txt.fEmail,
                  role:txt.roleLabel, roleAdmin:txt.roleAdmin, roleUser:txt.roleUser
                  // reports removed from edit labels
                }}
              />
            )}

            {/* FOOTER */}
            <div className="users-modal__footer">
              {mode === "view" ? (
                <>
                  <div className="left">
                    <button className="btn btn--success" onClick={onVerifyToggle} disabled={pending || !isAdmin}>
                      {current.status === "verified" ? txt.unverify : txt.verify}
                    </button>
                    <button className="btn btn--danger" onClick={onBanToggle} disabled={pending || !isAdmin} style={{ marginInlineStart: 8 }}>
                      {current.status === "banned" ? txt.unban : txt.ban}
                    </button>
                  </div>
                  <div className="right" style={{ display:"flex", gap:8 }}>
                    <button className="btn btn--outline" onClick={enterEdit} disabled={!isAdmin}>{txt.edit}</button>
                    <DeleteConfirm
                      triggerLabel={txt.delete}
                      confirmLabel={txt.confirmDelete}
                      onConfirm={onDelete}
                      disabled={pending || !isAdmin}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="left"></div>
                  <div className="right" style={{ display:"flex", gap:8 }}>
                    <button className="btn btn--outline" onClick={cancelEdit}>{txt.cancel}</button>
                    <button className="btn btn--primary" onClick={saveEdit} disabled={pending || !draft || !isAdmin}>{txt.save}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add User (Add New) Modal */}
      {addOpen && (
        <div className="users-modal__backdrop" onMouseDown={() => setAddOpen(false)}>
          <div className="users-modal" role="dialog" aria-modal="true" onMouseDown={(e)=>e.stopPropagation()}>
            <div className="users-modal__header">
              <div className="users-modal__title">
                <span>{txt.addNew}</span>
              </div>
              <button className="users-modal__close" aria-label="Close" onClick={() => setAddOpen(false)}>×</button>
            </div>

            <div className="users-modal__content users-form">
              <FormRow label={txt.fName}>
                <input value={addDraft.name ?? ""} onChange={(e)=>setAddDraft({ ...addDraft, name: e.target.value })} />
              </FormRow>

              <FormRow label={txt.fNatNum}>
                <input
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={14}
                  value={addDraft.nationalIdNumber ?? ""}
                  onKeyDown={allowDigitKey}
                  onChange={(e)=>setAddDraft({ ...addDraft, nationalIdNumber: sanitizeDigits(e.target.value, 14) })}
                  onPaste={(e) => {
                    e.preventDefault();
                    const text = (e.clipboardData.getData("text") || "");
                    setAddDraft({ ...addDraft, nationalIdNumber: sanitizeDigits(text, 14) });
                  }}
                />
              </FormRow>

              <FormRow label={txt.roleLabel}>
                <select value={(addDraft.role as Role) ?? "user"} onChange={(e)=>setAddDraft({ ...addDraft, role: e.target.value as Role })}>
                  <option value="user">{txt.roleUser}</option>
                  <option value="admin">{txt.roleAdmin}</option>
                </select>
              </FormRow>

              <FormRow label={txt.fGender}>
                <select value={(addDraft.gender as any) ?? "other"} onChange={(e)=>setAddDraft({ ...addDraft, gender: e.target.value as any })}>
                  <option value="female">{G.female}</option>
                  <option value="male">{G.male}</option>
                  <option value="other">{G.other}</option>
                </select>
              </FormRow>

              <FormRow label={txt.fPhone}>
                <input
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={11}
                  value={addDraft.phone ?? ""}
                  onKeyDown={allowDigitKey}
                  onChange={(e)=>setAddDraft({ ...addDraft, phone: sanitizeDigits(e.target.value, 11) })}
                  onPaste={(e) => {
                    e.preventDefault();
                    const text = (e.clipboardData.getData("text") || "");
                    setAddDraft({ ...addDraft, phone: sanitizeDigits(text, 11) });
                  }}
                />
              </FormRow>

              <FormRow label={txt.fEmail}>
                <input
                  type="email"
                  value={addDraft.email ?? ""}
                  onChange={(e)=>setAddDraft({ ...addDraft, email: e.target.value })}
                />
              </FormRow>

              {/* Radius field removed */}
            </div>

            <div className="users-modal__footer">
              <div className="left"></div>
              <div className="right" style={{ display:"flex", gap:8 }}>
                <button className="btn btn--outline" onClick={()=>setAddOpen(false)}>{txt.cancel}</button>
                <button
                  className="btn btn--primary"
                  onClick={createUser}
                  disabled={
                    !addDraft.name ||
                    (addDraft.nationalIdNumber ?? "").length !== 14 ||
                    ((addDraft.phone ?? "").length > 0 && (addDraft.phone ?? "").length !== 11)
                  }
                >
                  {txt.create}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({ label, value }: { label: string; value?: string }){
  return (
    <div className="users-field">
      <span className="label">{label}</span>
      <div className="value">{value ?? "—"}</div>
    </div>
  );
}

/* compact form rows */
function FormRow({ label, children }: { label: string; children: React.ReactNode }){
  return (
    <div className="users-field users-field--row">
      <span className="label">{label}</span>
      <div className="control">{children}</div>
    </div>
  );
}

function EditForm({
  draft, setDraft, labels, G
}:{
  draft: Partial<UserRow> | null;
  setDraft: (p: Partial<UserRow>) => void;
  labels: { name:string; gender:string; phone:string; email:string; radius:string; role:string; roleAdmin:string; roleUser:string; };
  G: { female:string; male:string; other:string };
}){
  const d = draft ?? {};
  const update = (patch: Partial<UserRow>) => setDraft({ ...(draft || {}), ...patch });

  return (
    <div className="users-modal__content users-form">
      <FormRow label={labels.name}>
        <input value={d.name ?? ""} onChange={(e)=>update({ name: e.target.value })} />
      </FormRow>
      <FormRow label={labels.role}>
        <select value={(d.role as Role) ?? "user"} onChange={(e)=>update({ role: e.target.value as Role })}>
          <option value="user">{labels.roleUser}</option>
          <option value="admin">{labels.roleAdmin}</option>
        </select>
      </FormRow>
      <FormRow label={labels.gender}>
        <select value={d.gender ?? "other"} onChange={(e)=>update({ gender: e.target.value as any })}>
          <option value="female">{G.female}</option>
          <option value="male">{G.male}</option>
          <option value="other">{G.other}</option>
        </select>
      </FormRow>
      <FormRow label={labels.phone}>
        <input
          inputMode="numeric"
          pattern="\d*"
          maxLength={11}
          value={d.phone ?? ""}
          onKeyDown={(e:any)=>allowDigitKey(e)}
          onChange={(e)=>update({ phone: sanitizeDigits(e.target.value, 11) })}
          onPaste={(e:any) => {
            e.preventDefault();
            const text = (e.clipboardData.getData("text") || "");
            update({ phone: sanitizeDigits(text, 11) });
          }}
        />
      </FormRow>
      <FormRow label={labels.email}>
        <input
          type="email"
          value={d.email ?? ""}
          onChange={(e)=>update({ email: e.target.value })}
        />
      </FormRow>
      {/* reportsSubmitted field REMOVED from edit mode */}
      <FormRow label={labels.radius}>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.5"
          value={d.notificationRadiusKm ?? 0}
          onChange={(e)=>update({ notificationRadiusKm: Number(e.target.value || 0) })}
        />
      </FormRow>
      {/* Save/Cancel are in the footer */}
    </div>
  );
}

function DeleteConfirm({
  triggerLabel, confirmLabel, onConfirm, disabled
}:{
  triggerLabel:string; confirmLabel:string; onConfirm:()=>void; disabled?:boolean;
}){
  const [ask, setAsk] = useState(false);
  if (!ask) {
    return <button className="btn btn--danger" onClick={()=>setAsk(true)} disabled={disabled}>{triggerLabel}</button>;
  }
  return (
    <div style={{ display:"flex", gap:8 }}>
      <button className="btn btn--outline" onClick={()=>setAsk(false)}>Cancel</button>
      <button className="btn btn--danger" onClick={onConfirm} disabled={disabled}>{confirmLabel}</button>
    </div>
  );
}
