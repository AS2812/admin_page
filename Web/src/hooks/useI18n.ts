import { useSyncExternalStore } from "react";
import { getLang, t } from "../i18n";

export function useI18n() {
  const lang = useSyncExternalStore(
    (onStoreChange) => {
      const handler = () => onStoreChange();
      window.addEventListener("i18n:change", handler as EventListener);
      return () => window.removeEventListener("i18n:change", handler as EventListener);
    },
    () => getLang(),
    () => 'en'
  );
  return { lang, dir: lang === 'ar' ? 'rtl' : 'ltr', t };
}
