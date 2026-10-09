"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client";
import { DEFAULT_SITE_SETTINGS, normalizeSiteSettings, type SiteSettings } from "@/lib/site";

let cached: SiteSettings | null = null;
let inflight: Promise<SiteSettings> | null = null;

/** Fetch the admin-editable site settings (logo, contact details). Falls
 * back to defaults while loading or if the request fails. */
export function useSiteSettings(): SiteSettings {
  const [settings, setSettings] = useState<SiteSettings>(cached ?? DEFAULT_SITE_SETTINGS);

  useEffect(() => {
    if (cached) {
      setSettings(cached);
      return;
    }
    if (!inflight) {
      inflight = apiFetch<{ settings: unknown }>("/api/v1/settings")
        .then((d) => {
          cached = normalizeSiteSettings(d.settings);
          return cached;
        })
        .catch(() => DEFAULT_SITE_SETTINGS)
        .finally(() => {
          inflight = null;
        });
    }
    inflight.then(setSettings);
  }, []);

  return settings;
}

/** Site brand: admin-uploaded logo image when set, otherwise the 🩸 mark. */
export function SiteBrand({ color = "inherit" }: { color?: string }) {
  const site = useSiteSettings();
  return (
    <Link href="/" className="bm-brand" style={{ color }}>
      {site.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={site.logoUrl} alt={site.name} style={{ height: 50, width: "auto", borderRadius: 6 }} />
      ) : (
        <span className="bm-brand-mark">🩸</span>
      )}
      {site.name.replace(/ /g, " ")}
    </Link>
  );
}

/** Contact details block driven by the admin-editable site settings. */
export function ContactLines({ light = false }: { light?: boolean }) {
  const site = useSiteSettings();
  return (
    <>
      <li>📧 {site.contactEmail}</li>
      <li>📞 {site.contactPhone}{light ? " (toll-free)" : ""}</li>
      <li>📍 {site.address}</li>
    </>
  );
}

/** Contact details as divs (for the About page contact card). */
export function ContactDetails() {
  const site = useSiteSettings();
  return (
    <>
      <div>📧 <strong>Email:</strong> {site.contactEmail}</div>
      <div>📞 <strong>Helpline:</strong> {site.contactPhone} (toll-free, 8am–8pm IST)</div>
      <div>📍 <strong>Address:</strong> {site.address}</div>
    </>
  );
}
