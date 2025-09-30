import * as Sentry from "@sentry/react";

declare global {
  interface Window {
    dataLayer: unknown[];
  }
}

function initSentry() {
  const dsn = (import.meta.env.VITE_SENTRY_DSN || import.meta.env.NEXT_PUBLIC_SENTRY_DSN) as string | undefined;
  if (!dsn) return;
  const environment = (import.meta.env.VITE_SENTRY_ENV || import.meta.env.NODE_ENV || "development") as string;
  const release = (import.meta.env.VITE_SENTRY_RELEASE || undefined) as string | undefined;
  const tracesSampleRate = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.1);
  const replaySampleRate = Number(import.meta.env.VITE_SENTRY_REPLAY_SAMPLE_RATE ?? 0.05);

  Sentry.init({
    dsn,
    environment,
    release,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0.1,
    replaysSessionSampleRate: Number.isFinite(replaySampleRate) ? replaySampleRate : 0.05,
  });
}

function initAnalytics() {
  const plausibleDomain = (import.meta.env.VITE_PLAUSIBLE_DOMAIN || "") as string;
  const plausibleSrc = (import.meta.env.VITE_PLAUSIBLE_SCRIPT || "https://plausible.io/js/script.js") as string;
  if (plausibleDomain) {
    const script = document.createElement("script");
    script.defer = true;
    script.dataset.domain = plausibleDomain;
    script.src = plausibleSrc;
    document.head.appendChild(script);
  }

  const gaId = (import.meta.env.VITE_GA_MEASUREMENT_ID || "") as string;
  if (gaId) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    type GtagArgs = [string, ...unknown[]];
    const gtag = (...args: GtagArgs) => {
      window.dataLayer.push(args);
    };
    gtag("js", new Date());
    gtag("config", gaId);
  }
}

export function initMonitoring() {
  if (typeof window === "undefined") return;
  initSentry();
  initAnalytics();
}

export const captureException = Sentry.captureException;
