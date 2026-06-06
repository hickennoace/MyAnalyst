"use client";

import { useLang } from "@/lib/i18n";

// Switches the site language (English ⇄ Hebrew). Hebrew also flips the page to
// RTL. The initial value is applied before paint by the inline script in layout.
export function LangToggle({ className = "" }: { className?: string }) {
  const [lang, setLang] = useLang();
  const next = lang === "he" ? "en" : "he";
  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      className={`theme-toggle !w-auto px-2.5 text-xs font-semibold ${className}`}
      aria-label={lang === "he" ? "Switch to English" : "החלפה לעברית"}
      title={lang === "he" ? "Switch to English" : "החלפה לעברית"}
    >
      {lang === "he" ? "EN" : "עב"}
    </button>
  );
}
