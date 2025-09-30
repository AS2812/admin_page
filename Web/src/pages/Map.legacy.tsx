// src/pages/MapPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import MapLibreMap from "../components/MapLibreMap";
import { createPortal } from "react-dom";
import { useI18n } from "../hooks/useI18n";
import "./incidents.css";
import "./map.css";

type Sev = "low" | "medium" | "high" | "critical";
type Cat = "infrastructure" | "road" | "electric" | "sanitation";


// No demo map pins; map pulls live points in MapLibreMap

/* ---------- Portal dropdown: fixed position, no hover glitches ---------- */
type Opt = { value: string; label: string };
type Pos = { top: number; left: number; width: number };

function useOutsideClose(refs: React.RefObject<HTMLElement>[], onClose: () => void) {
  useEffect(() => {
    const onDoc = (e: Event) => {
      const t = e.target as Node;
      const inside = refs.some(r => r.current && r.current.contains(t));
      if (!inside) onClose();
    };
    document.addEventListener("pointerdown", onDoc, true);
    return () => document.removeEventListener("pointerdown", onDoc, true);
  }, [refs, onClose]);
}

function Dropdown({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Opt[];
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const localMenuRef = useRef<HTMLUListElement>(null);
  const [pos, setPos] = useState<Pos | null>(null);

  const positionMenu = () => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const width = Math.max(260, r.width);
    const padding = 8;
    const left = Math.min(Math.max(padding, r.left), vw - width - padding);
    const top = r.bottom + 8;
    setPos({ top, left, width });
  };

  const handlePress = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    positionMenu();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const on = () => positionMenu();
    window.addEventListener("resize", on);
    window.addEventListener("scroll", on, true);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("scroll", on, true);
    };
  }, [open]);

  const portalMenuRef = useRef<HTMLUListElement>(null);
  useOutsideClose([btnRef as any, portalMenuRef as any], () => setOpen(false));

  const selected = options.find(o => o.value === value);

  return (
    <div className="filter pill dd" style={{ marginLeft: "auto", position: "relative" }}>
      <span className="label">{label}</span>
      <button
        ref={btnRef}
        type="button"
        className="dd-btn"
        onMouseDown={handlePress}
        onClick={(e)=> e.preventDefault()}
        style={{ minWidth: 260, height: 42, padding: "0 16px", borderRadius: 12 }}
      >
        {selected?.label}
        <span className="caret" aria-hidden>â–¾</span>
      </button>

      {open && pos && createPortal(
        <ul
          ref={portalMenuRef}
          className="dd-menu"
          role="listbox"
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left - 68,
            minWidth: 330,
            zIndex: 9999,
            display: "block",
            pointerEvents: "auto",
          }}
          onMouseDown={(e) => { e.stopPropagation(); }}
        >
          {options.map(o => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={`dd-item ${o.value === value ? "is-selected" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </li>
          ))}
        </ul>,
        document.body
      )}

      <ul ref={localMenuRef} style={{ display: "none" }} />
    </div>
  );
}

/* ---------- helpers ---------- */
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const sevLabel = (t: (k: string) => string, s: Sev) => {
  const key = `incident.severity.${s}`;
  const value = t(key);
  return value === key ? cap(s) : value;
};
const catLabel = (t: (k: string) => string, c: Cat) => {
  const key = `categories.${c}`;
  const value = t(key);
  return value === key ? cap(c) : value;
};
/* ---------- detect dark mode from data-theme, no CSS override ---------- */
function useIsDarkTheme(){
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const check = () => setIsDark(root.getAttribute("data-theme") === "dark");
    check(); // initial
    const mo = new MutationObserver(check);
    mo.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return isDark;
}

export default function MapPage(){
  const { t, lang } = useI18n();
  const isDark = useIsDarkTheme();

  // Only these two controls:
  const [q, setQ] = useState("");
  const [fKind, setFKind] = useState<"all"|"incident"|"complaint">("all");

  const labelSearch = t("incident.search.placeholder");
  const labelType   = t("map.filters.type");

  const typeOpts: Opt[] = [
    { value: "all", label: t("map.filters.type_all") || "Incidents & Complaints" },
    { value: "incident", label: t("map.filters.type_incident") || "Incidents" },
    { value: "complaint", label: t("map.filters.type_complaint") || "Complaints" },
  ];



  // Legend updates with language & kind
  const legendItems = useMemo(() => {
    if (fKind === "complaint") {
      return [
        { key:"infrastructure", label: catLabel(t, "infrastructure"), className:"leg leg--infra" },
        { key:"road",           label: catLabel(t, "road"),           className:"leg leg--road"  },
        { key:"electric",       label: catLabel(t, "electric"),       className:"leg leg--electric" },
        { key:"sanitation",     label: catLabel(t, "sanitation"),     className:"leg leg--san"   },
      ];
    }
    return [
      { key:"critical", label: sevLabel(t, "critical"), className:"leg leg--critical" },
      { key:"high",     label: sevLabel(t, "high"),     className:"leg leg--high"     },
      { key:"medium",   label: sevLabel(t, "medium"),   className:"leg leg--medium"   },
      { key:"low",      label: sevLabel(t, "low"),      className:"leg leg--low"      },
    ];
  }, [fKind, t, lang]);

  return (
    <section>
      {/* FILTERS â€” Search left (half), Type far right. */}
      <div
        className="map-filters"
        style={{ display: "flex", alignItems: "center", margin: "10px 0 14px" }}
      >
        <div
          className="filter pill search"
          title={labelSearch}
          style={{ flex: "1 1 auto", maxWidth: "50vw", minWidth: 320 }}
        >
          <span className="icon" aria-hidden>🔎</span>
          <input
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            placeholder={labelSearch}
          />
        </div>

        <Dropdown
          label={labelType}
          value={fKind}
          onChange={(v)=> setFKind(v as any)}
          options={typeOpts}
        />
      </div>

      {/* MAP */}
      <div className="map-card">
        {((import.meta as any).env?.VITE_MAPTILER_KEY
          || (import.meta as any).env?.NEXT_PUBLIC_MAPTILER_KEY
          || (import.meta as any).env?.MAPTILER_KEY)
          ? <MapLibreMap height={560} />
          : <div style={{ padding:16, opacity:.8 }}>{lang === 'ar' ? t('map.no_key_ar') || 'Add MAPTILER_KEY to display the map.' : 'Add MAPTILER_KEY to display the map.'}</div>}

        {/* LEGEND â€” background set inline via theme, no global CSS overrides */}
        <div
          className="map-legend"
          style={isDark ? { background: "#0b1220" } : undefined}
        >
          <div className="legend-title">
            {fKind === "complaint" ? t("map.legend.category") : t("map.legend.severity")}
          </div>
          <ul>
            {legendItems.map(item => (
              <li key={item.key} className={item.className}>
                <span className="swatch"/> {item.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}














