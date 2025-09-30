# Report Classification: Incidents vs Complaints

This document explains how SpotnSend’s admin dashboard divides reports into two sections — incidents and complaints — using logical rules driven by Supabase category and subcategory data.

## Overview

- Purpose: separate acute, safety‑critical events (incidents) from service/maintenance issues (complaints).
- Data sources: `reports`, `report_categories`, `report_subcategories`, `users` tables.
- Implementation: classification occurs in the data layer before mapping to UI rows.

## Decision Criteria

Classification uses a combination of category slug/name and subcategory keywords.

- Incidents (acute risk, emergencies, safety threats, transport accidents):
  - Transport accidents: `road_traffic`, rail/public transport, marine/waterway
  - Acute hazards: fire, explosion
  - Safety/crime: public safety, crime
  - Medical: medical emergencies
  - Environment: weather/environment hazards
  - Occupational/industrial incidents

- Complaints (infrastructure/utility faults, maintenance, sanitation):
  - Infrastructure/building issues
  - Utilities/outages: power, water, streetlights
  - Roadway maintenance hazards: potholes, roadway hazards
  - Sanitation: garbage, waste, sewage, trash, cleaning

- Fallbacks:
  - If subcategory contains maintenance keywords (e.g., `pothole`, `streetlight`, `garbage`, `sewage`), classify as complaint.
  - Default to incident if uncertain (prevents hiding potential emergencies).

## Data Layer (Supabase)

- Category and subcategory metadata are preloaded from Supabase to avoid view dependencies.
- Classification happens in code before mapping rows to UI.

Key functions and files:

- `src/utils/supabaseQueries.ts`
  - `classifyType(categoryKey?: string, subcategoryName?: string): "incident" | "complaint"`
    - Uses regex sets for incident vs complaint patterns against category slug or name and subcategory text.
  - `fetchReports(): IncidentRow[]`
    - Fetches `reports`, joins user identities, filters with `classifyType` to return only incidents.
  - `fetchComplaints(): ComplaintRow[]`
    - Fetches `reports`, joins user identities, filters with `classifyType` to return only complaints.
    - Buckets complaint category into one of: `road`, `electric`, `sanitation`, `infrastructure`.
  - `fetchReportDetail(reportId: number): ReportDetail | null`
    - Returns full detail for a single report (used by both sections).

## Category Buckets (Complaints)

To make complaints actionable, complaint categories are further bucketed:

- `road`: roadway hazard, pothole, traffic maintenance issues
- `electric`: power grid, streetlight/lamp, electrical utility faults
- `sanitation`: garbage, waste, sewage, trash, cleaning
- `infrastructure`: structural/building and general civic infrastructure issues

## Examples

- Car accident on highway → Incident (transport accident)
- Warehouse fire → Incident (acute hazard)
- Streetlight not working → Complaint (`electric` bucket)
- Pothole on 3rd Ave → Complaint (`road` bucket)
- Sewage overflow → Complaint (`sanitation` bucket)
- Water outage in district → Complaint (`electric` or utility; bucketed as `electric` in current scheme)

## Rationale

- Operations workflows: incidents need rapid triage and potentially dispatch; complaints route to maintenance/service teams.
- User clarity: separating improves filtering, reporting, and metrics for each workflow.

## Edge Cases

- Mixed labels: if category is ambiguous but subcategory clearly indicates maintenance (`pothole`, `streetlight`), classify as complaint.
- Unknown categories: default to incident to avoid under‑reacting to emergencies; these can be re‑tagged later.

## Maintenance

- As you add new categories/subcategories, extend `classifyType` pattern lists to maintain accuracy.
- If your taxonomy evolves, adjust complaint buckets and UI labels accordingly.

## Related UI

- `src/pages/Incidents.tsx`: shows only incident rows (status/severity from Supabase).
- `src/pages/Complaints.tsx`: shows only complaint rows with bucketed category labels.