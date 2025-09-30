import { getCategoryIcon } from "../utils/categoryIcons";

type Props = {
  id: string | number;
  title: string;
  area: string;
  status: "submitted" | "assigned" | "resolved";
  reportedDate: string;
  kind: "incident" | "complaint";
  severity?: "low" | "normal";
  category?: "infrastructure" | "road" | "electric" | "sanitation";
  onClick?: () => void;
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  const ds = d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  const ts = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${ds} ${ts}`;
};

const humanizeStatus: Record<Props["status"], string> = {
  submitted: "Submitted",
  assigned: "In Progress",
  resolved: "Resolved",
};

const humanizeSeverity: Record<NonNullable<Props["severity"]>, string> = {
  low: "Low",
  normal: "Normal",
};

const humanizeCategory: Record<NonNullable<Props["category"]>, string> = {
  infrastructure: "Infrastructure",
  road: "Road",
  electric: "Electric",
  sanitation: "Sanitation",
};

export default function ReportCard({ id, title, area, status, reportedDate, kind, severity, category, onClick }: Props) {
  const sevClass = severity ? `sev sev--${severity}` : "";
  const catIcon = category ? getCategoryIcon(category) : null;

  return (
    <div className="card report-card" role="button" tabIndex={0} onClick={onClick} onKeyDown={(e)=>{ if(e.key==="Enter") onClick?.(); }}>
      <div className="card__row">
        <div className="card__left">
          <div className="card__id">{id}</div>
          {catIcon && (
            <div className="card__icon" aria-hidden style={{ backgroundImage: `url(${catIcon})`, backgroundSize: "contain", backgroundRepeat: "no-repeat" }} />
          )}
          <div className="card__title">{title}</div>
          <div className="card__area">{area}</div>
        </div>
        <div className="card__right">
          <div className="card__status">{humanizeStatus[status] || status}</div>
          <div className="card__date numfont">{formatDateTime(reportedDate)}</div>
          {kind === "incident" && severity && (
            <div className={sevClass} data-sev={severity}>{humanizeSeverity[severity] || severity}</div>
          )}
          {kind === "complaint" && category && (
            <div className="card__category">{humanizeCategory[category] || category}</div>
          )}
        </div>
      </div>
    </div>
  );
}