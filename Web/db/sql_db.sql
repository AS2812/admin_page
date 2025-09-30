-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.account_verifications (
  verification_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id bigint NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::verification_status,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by bigint,
  rejection_reason text,
  notes text,
  CONSTRAINT account_verifications_pkey PRIMARY KEY (verification_id),
  CONSTRAINT account_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT account_verifications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.alert_types (
  category USER-DEFINED NOT NULL,
  subtype USER-DEFINED NOT NULL,
  label_en text NOT NULL,
  label_ar text NOT NULL,
  default_ttl_minutes integer NOT NULL CHECK (default_ttl_minutes > 0),
  ongoing_days integer CHECK (ongoing_days > 0),
  inserted_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT alert_types_pkey PRIMARY KEY (subtype, category)
);
CREATE TABLE public.alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category USER-DEFINED NOT NULL,
  subtype USER-DEFINED NOT NULL,
  title text,
  description text,
  geom USER-DEFINED,
  reported_by uuid NOT NULL DEFAULT auth.uid(),
  live_until timestamp with time zone NOT NULL,
  moved_to_ongoing_at timestamp with time zone,
  status text NOT NULL DEFAULT 'LIVE'::text CHECK (status = ANY (ARRAY['LIVE'::text, 'ONGOING'::text, 'EXPIRED'::text])),
  inserted_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  audience text NOT NULL DEFAULT 'people'::text CHECK (audience = ANY (ARRAY['people'::text, 'government'::text, 'both'::text])),
  people_gender text CHECK (people_gender = ANY (ARRAY['male'::text, 'female'::text, 'both'::text])),
  CONSTRAINT alerts_pkey PRIMARY KEY (id),
  CONSTRAINT alerts_category_fk FOREIGN KEY (category) REFERENCES public.alert_types(category),
  CONSTRAINT alerts_category_fk FOREIGN KEY (subtype) REFERENCES public.alert_types(category),
  CONSTRAINT alerts_category_fk FOREIGN KEY (category) REFERENCES public.alert_types(subtype),
  CONSTRAINT alerts_category_fk FOREIGN KEY (subtype) REFERENCES public.alert_types(subtype),
  CONSTRAINT alerts_reporter_fk FOREIGN KEY (reported_by) REFERENCES auth.users(id)
);
CREATE TABLE public.audit_events (
  audit_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  table_name text NOT NULL,
  record_id text NOT NULL,
  user_id bigint,
  action text NOT NULL,
  changes jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_events_pkey PRIMARY KEY (audit_id),
  CONSTRAINT audit_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.authorities (
  authority_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name character varying NOT NULL CHECK (btrim(name::text) <> ''::text),
  slug character varying NOT NULL CHECK (btrim(slug::text) <> ''::text),
  description text,
  level USER-DEFINED NOT NULL DEFAULT 'national'::authority_level,
  contact_person character varying,
  contact_email USER-DEFINED,
  contact_phone character varying,
  hotline_phone character varying,
  website_url text,
  service_radius_meters integer NOT NULL DEFAULT 20000 CHECK (service_radius_meters >= 100 AND service_radius_meters <= 500000),
  latitude double precision,
  longitude double precision,
  address text,
  city character varying,
  region character varying,
  country character varying,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  location_geog USER-DEFINED,
  CONSTRAINT authorities_pkey PRIMARY KEY (authority_id)
);
CREATE TABLE public.authority_categories (
  authority_id bigint NOT NULL,
  category_id smallint NOT NULL,
  CONSTRAINT authority_categories_pkey PRIMARY KEY (category_id, authority_id),
  CONSTRAINT authority_categories_authority_id_fkey FOREIGN KEY (authority_id) REFERENCES public.authorities(authority_id),
  CONSTRAINT authority_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.report_categories(category_id)
);
CREATE TABLE public.bug_reports (
  bug_report_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id bigint DEFAULT current_user_id(),
  title text NOT NULL CHECK (btrim(title) <> ''::text),
  description text NOT NULL CHECK (btrim(description) <> ''::text),
  status text NOT NULL DEFAULT 'open'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bug_reports_pkey PRIMARY KEY (bug_report_id),
  CONSTRAINT bug_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.favorite_spots (
  favorite_spot_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id bigint NOT NULL DEFAULT current_user_id(),
  name character varying NOT NULL CHECK (btrim(name::text) <> ''::text),
  latitude double precision NOT NULL CHECK (latitude >= '-90'::integer::double precision AND latitude <= 90::double precision),
  longitude double precision NOT NULL CHECK (longitude >= '-180'::integer::double precision AND longitude <= 180::double precision),
  radius_meters integer NOT NULL DEFAULT 250 CHECK (radius_meters >= 50 AND radius_meters <= 20000),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  location_geog USER-DEFINED DEFAULT (st_setsrid(st_makepoint(longitude, latitude), 4326))::geography,
  CONSTRAINT favorite_spots_pkey PRIMARY KEY (favorite_spot_id),
  CONSTRAINT favorite_spots_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.notification_deliveries (
  delivery_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  notification_id bigint NOT NULL,
  channel USER-DEFINED NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::notification_delivery_status,
  sent_at timestamp with time zone,
  delivered_at timestamp with time zone,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notification_deliveries_pkey PRIMARY KEY (delivery_id),
  CONSTRAINT notification_deliveries_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notifications(notification_id)
);
CREATE TABLE public.notifications (
  notification_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id bigint NOT NULL,
  notification_type USER-DEFINED NOT NULL DEFAULT 'system'::notification_type,
  title text NOT NULL CHECK (btrim(title) <> ''::text),
  body text NOT NULL CHECK (btrim(body) <> ''::text),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  related_report_id bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  seen_at timestamp with time zone,
  deleted_at timestamp with time zone,
  CONSTRAINT notifications_pkey PRIMARY KEY (notification_id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT notifications_related_report_id_fkey FOREIGN KEY (related_report_id) REFERENCES public.reports(report_id)
);
CREATE TABLE public.phone_verifications (
  phone_verification_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id bigint NOT NULL,
  phone_country_code character varying NOT NULL CHECK (btrim(phone_country_code::text) <> ''::text),
  phone_number character varying NOT NULL CHECK (btrim(phone_number::text) <> ''::text),
  channel USER-DEFINED NOT NULL DEFAULT 'sms'::notification_channel,
  code_hash text NOT NULL CHECK (btrim(code_hash) <> ''::text),
  expires_at timestamp with time zone NOT NULL,
  verified_at timestamp with time zone,
  attempt_count smallint NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT phone_verifications_pkey PRIMARY KEY (phone_verification_id),
  CONSTRAINT phone_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.report_authority_dispatches (
  dispatch_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  report_id bigint NOT NULL,
  authority_id bigint NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::report_dispatch_status,
  channel USER-DEFINED,
  notified_at timestamp with time zone,
  acknowledged_at timestamp with time zone,
  dismissed_at timestamp with time zone,
  notes text,
  created_by bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT report_authority_dispatches_pkey PRIMARY KEY (dispatch_id),
  CONSTRAINT report_authority_dispatches_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(report_id),
  CONSTRAINT report_authority_dispatches_authority_id_fkey FOREIGN KEY (authority_id) REFERENCES public.authorities(authority_id),
  CONSTRAINT report_authority_dispatches_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.report_categories (
  category_id smallint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name character varying NOT NULL CHECK (btrim(name::text) <> ''::text),
  slug character varying NOT NULL CHECK (btrim(slug::text) <> ''::text),
  description text,
  icon_name character varying,
  color_hex character varying,
  sort_order smallint NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  default_ttl_minutes integer NOT NULL DEFAULT 1440 CHECK (default_ttl_minutes >= 5 AND default_ttl_minutes <= 43200),
  CONSTRAINT report_categories_pkey PRIMARY KEY (category_id)
);
CREATE TABLE public.report_feedbacks (
  feedback_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  report_id bigint NOT NULL,
  user_id bigint NOT NULL,
  feedback_type USER-DEFINED NOT NULL DEFAULT 'comment'::feedback_kind,
  comment text NOT NULL CHECK (btrim(comment) <> ''::text),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT report_feedbacks_pkey PRIMARY KEY (feedback_id),
  CONSTRAINT report_feedbacks_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(report_id),
  CONSTRAINT report_feedbacks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.report_flags (
  flag_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  report_id bigint NOT NULL,
  user_id bigint NOT NULL,
  reason USER-DEFINED NOT NULL DEFAULT 'spam'::report_flag_reason,
  details text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT report_flags_pkey PRIMARY KEY (flag_id),
  CONSTRAINT report_flags_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(report_id),
  CONSTRAINT report_flags_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.report_media (
  media_id uuid NOT NULL DEFAULT gen_random_uuid(),
  report_id bigint NOT NULL,
  media_type text NOT NULL,
  storage_url text NOT NULL CHECK (btrim(storage_url) <> ''::text),
  thumbnail_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_cover boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT report_media_pkey PRIMARY KEY (media_id),
  CONSTRAINT report_media_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(report_id)
);
CREATE TABLE public.report_subcategories (
  subcategory_id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  category_id smallint NOT NULL,
  name character varying NOT NULL CHECK (btrim(name::text) <> ''::text),
  description text,
  sort_order smallint NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT report_subcategories_pkey PRIMARY KEY (subcategory_id),
  CONSTRAINT report_subcategories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.report_categories(category_id)
);
CREATE TABLE public.reports (
  report_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id bigint NOT NULL DEFAULT current_user_id(),
  category_id smallint NOT NULL,
  subcategory_id integer,
  status USER-DEFINED NOT NULL DEFAULT 'submitted'::report_state,
  priority USER-DEFINED NOT NULL DEFAULT 'normal'::report_priority,
  notify_scope USER-DEFINED NOT NULL DEFAULT 'people'::notify_scope,
  description text,
  latitude double precision NOT NULL CHECK (latitude >= '-90'::integer::double precision AND latitude <= 90::double precision),
  longitude double precision NOT NULL CHECK (longitude >= '-180'::integer::double precision AND longitude <= 180::double precision),
  location_name text,
  address text,
  city character varying,
  alert_radius_meters integer DEFAULT 500 CHECK (alert_radius_meters IS NULL OR alert_radius_meters >= 50 AND alert_radius_meters <= 20000),
  government_ticket_ref text,
  notified_people_at timestamp with time zone,
  notified_government_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone,
  title text,
  deleted_at timestamp with time zone,
  notify_people_gender text NOT NULL DEFAULT 'both'::text CHECK (notify_people_gender = ANY (ARRAY['male'::text, 'female'::text, 'both'::text])),
  location_geog USER-DEFINED DEFAULT (st_setsrid(st_makepoint(longitude, latitude), 4326))::geography,
  ttl_minutes_override integer CHECK (ttl_minutes_override IS NULL OR ttl_minutes_override >= 5 AND ttl_minutes_override <= 43200),
  CONSTRAINT reports_pkey PRIMARY KEY (report_id),
  CONSTRAINT reports_category_fk FOREIGN KEY (category_id) REFERENCES public.report_categories(category_id),
  CONSTRAINT reports_subcategory_fk FOREIGN KEY (subcategory_id) REFERENCES public.report_subcategories(subcategory_id),
  CONSTRAINT reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT reports_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.report_categories(category_id),
  CONSTRAINT reports_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.report_subcategories(subcategory_id)
);
CREATE TABLE public.spatial_ref_sys (
  srid integer NOT NULL CHECK (srid > 0 AND srid <= 998999),
  auth_name character varying,
  auth_srid integer,
  srtext character varying,
  proj4text character varying,
  CONSTRAINT spatial_ref_sys_pkey PRIMARY KEY (srid)
);
CREATE TABLE public.two_factor_methods (
  two_factor_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id bigint NOT NULL,
  method text NOT NULL,
  secret text NOT NULL CHECK (btrim(secret) <> ''::text),
  label text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_used_at timestamp with time zone,
  CONSTRAINT two_factor_methods_pkey PRIMARY KEY (two_factor_id),
  CONSTRAINT two_factor_methods_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.user_category_filters (
  user_id bigint NOT NULL,
  category_id smallint NOT NULL,
  is_selected boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_category_filters_pkey PRIMARY KEY (category_id, user_id),
  CONSTRAINT user_category_filters_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT user_category_filters_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.report_categories(category_id)
);
CREATE TABLE public.user_devices (
  device_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platform text NOT NULL CHECK (platform = ANY (ARRAY['android'::text, 'ios'::text])),
  fcm_token text NOT NULL,
  notifications_enabled boolean NOT NULL DEFAULT true,
  last_seen timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_devices_pkey PRIMARY KEY (device_id),
  CONSTRAINT user_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_identity_documents (
  document_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL,
  document_type text NOT NULL,
  file_url text NOT NULL CHECK (btrim(file_url) <> ''::text),
  file_hash text,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_identity_documents_pkey PRIMARY KEY (document_id),
  CONSTRAINT user_identity_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.user_map_preferences (
  user_id bigint NOT NULL,
  default_radius_meters integer NOT NULL DEFAULT 1000 CHECK (default_radius_meters >= 50 AND default_radius_meters <= 20000),
  default_view USER-DEFINED NOT NULL DEFAULT 'map'::map_view_mode,
  include_favorites_by_default boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_map_preferences_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_map_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.user_notification_preferences (
  user_id bigint NOT NULL,
  notifications_enabled boolean NOT NULL DEFAULT true,
  push_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT false,
  sms_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_notification_preferences_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.user_profiles (
  user_id uuid NOT NULL,
  gender USER-DEFINED NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_sessions (
  session_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL,
  refresh_token_hash text NOT NULL CHECK (btrim(refresh_token_hash) <> ''::text),
  client_ip inet,
  user_agent text,
  device_name character varying,
  remember_me boolean NOT NULL DEFAULT false,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_used_at timestamp with time zone,
  revoked_at timestamp with time zone,
  CONSTRAINT user_sessions_pkey PRIMARY KEY (session_id),
  CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.users (
  user_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  full_name character varying NOT NULL CHECK (btrim(full_name::text) <> ''::text),
  username USER-DEFINED NOT NULL UNIQUE CHECK (btrim(username::text) <> ''::text),
  email USER-DEFINED NOT NULL UNIQUE CHECK (btrim(email::text) <> ''::text),
  account_status USER-DEFINED NOT NULL DEFAULT 'pending'::account_status,
  role USER-DEFINED NOT NULL DEFAULT 'user'::user_role,
  auth_user_id uuid UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  phone_verified_at timestamp with time zone,
  contact_email text,
  phone_country_code character varying,
  phone_number character varying,
  id_number character varying,
  selfie_url text,
  id_front_url text,
  id_back_url text,
  contact_phone character varying,
  CONSTRAINT users_pkey PRIMARY KEY (user_id)
);