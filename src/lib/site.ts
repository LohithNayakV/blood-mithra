// ---------------------------------------------------------------------------
// Site-wide content (logo, contact details, tagline) editable from the admin
// panel and stored in `system_settings` under the "app" key.
//
// NOTE: this module must stay dependency-free (no db / next imports) so it
// can be used from both server components and client components.
// ---------------------------------------------------------------------------

export type EditablePageId = "home" | "about";

/** Editable content for a single public page. Stored inside site settings
 * under `pages[id]` so Home and About can be customized from the admin panel.
 * Functional pages (find-donors, become-donor, emergency, camps,
 * organizations) are intentionally static — they render live data, not copy. */
export interface EditablePage {
  /** Optional hero image. Empty = no image. Admin-uploaded site asset path. */
  heroImage: string;
  /** Hero section headline. */
  heroHeadline: string;
  /** Hero section subcopy (plain text). */
  heroSubcopy: string;
  /** CTA button label. Empty = no CTA rendered. */
  ctaLabel: string;
  /** CTA target path (e.g. "/become-donor"). Only used when ctaLabel is set. */
  ctaHref: string;
  /** FAQ items shown in the page's editable FAQ block. */
  faqs: { q: string; a: string }[];
  /** About page only: three mission/impact cards. */
  card1Title: string;
  card1Text: string;
  card2Title: string;
  card2Text: string;
  card3Title: string;
  card3Text: string;
  /** About page only: contact section. */
  contactHeading: string;
  officeHours: string;
  partnerEmail: string;
}

// Only Home and About have editable copy. Everything else is functional UI.
export const EDITABLE_PAGE_IDS: EditablePageId[] = ["home", "about"];

export interface SiteSettings {
  name: string;
  tagline: string;
  /** Image URL for the logo. Empty string = default 🩸 mark. */
  logoUrl: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  /** Per-page editable content. Unknown keys are ignored by the normalizer. */
  pages: Record<EditablePageId, EditablePage>;
}

const DEFAULT_PAGE: EditablePage = {
  heroImage: "",
  heroHeadline: "",
  heroSubcopy: "",
  ctaLabel: "",
  ctaHref: "/",
  faqs: [],
  card1Title: "",
  card1Text: "",
  card2Title: "",
  card2Text: "",
  card3Title: "",
  card3Text: "",
  contactHeading: "",
  officeHours: "",
  partnerEmail: "",
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  name: "Blood Mithra",
  tagline: "Every drop counts. Every donor is a hero.",
  logoUrl: "",
  contactEmail: "help@bloodmithra.org",
  contactPhone: "1800-000-0000",
  address: "Bengaluru, Karnataka, India",
  pages: {
    home: {
      ...DEFAULT_PAGE,
      heroHeadline: "Every drop counts.",
      heroSubcopy:
        "Blood Mithra connects voluntary donors with patients, hospitals and blood banks — in minutes, not days.",
      ctaLabel: "🩸 Find Blood",
      ctaHref: "/find-donors",
      faqs: [
        {
          q: "Who can donate blood?",
          a: "Most people aged 18–65, weighing at least 50 kg, and in good health can donate. You must wait 90 days (male) / 120 days (female) between whole blood donations. Our system calculates your personal next eligible date automatically.",
        },
        {
          q: "How does Blood Mithra match donors to requests?",
          a: "When a request is created, our backend filters donors by blood-group compatibility, eligibility, availability and location (using GPS distance), then notifies them in waves — nearest and most responsive donors first.",
        },
        {
          q: "Is my health information private?",
          a: "Yes. Health declarations are stored separately and are visible only to authorized roles (admins, hospital coordinators, blood bank operators). Your phone number is masked from the public.",
        },
        {
          q: "How do I get my donation certificate?",
          a: "After each verified donation, a certificate is generated with a unique certificate number. You can track its status — Pending → Generated → Issued → Received — from your donor dashboard.",
        },
        {
          q: "Can organizations host blood camps?",
          a: "Absolutely. NGOs, corporates, hospitals and community groups can organize blood camps through Blood Mithra. Volunteers help with registration, verification and follow-ups.",
        },
      ],
    },
    about: {
      ...DEFAULT_PAGE,
      heroHeadline: "About Blood Mithra",
      heroSubcopy:
        "Blood Mithra — friends of blood — is a community-powered platform that connects voluntary blood donors with patients, hospitals and blood banks across India. Our mission is simple: no patient should wait for blood because donors couldn't be found.",
      ctaLabel: "❤️ Join the mission — Become a Donor",
      ctaHref: "/become-donor",
      card1Title: "Our mission",
      card1Text: "Build India's most responsive, transparent and privacy-first blood donor network.",
      card2Title: "How we help",
      card2Text: "GPS-matched donor search, emergency notification waves, donation tracking and certificates.",
      card3Title: "Who we serve",
      card3Text: "Patients, hospitals, blood banks, NGOs, corporates, volunteers and donors.",
      contactHeading: "Contact us",
      officeHours: "Monday – Saturday: 9:00 AM – 6:00 PM IST\nSunday: Emergency support only",
      partnerEmail: "partner@bloodmithra.org",
    },
  },
};

function ensureDefaults(pages: unknown): SiteSettings["pages"] {
  let raw: Record<string, unknown> = {};
  if (pages && typeof pages === "object" && !Array.isArray(pages)) {
    raw = pages as Record<string, unknown>;
  }
  const out: SiteSettings["pages"] = {} as SiteSettings["pages"];
  for (const id of EDITABLE_PAGE_IDS) {
    out[id] = normalizePage((raw[id] as Record<string, unknown>) ?? null, id);
  }
  return out;
}

function normalizePage(raw: unknown, id: EditablePageId): EditablePage {
  let obj: Record<string, unknown> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  }
  const str = (key: keyof EditablePage, fallback: string) =>
    typeof obj[key] === "string" && (obj[key] as string).trim() !== "" ? (obj[key] as string).trim() : fallback;
  const faqsRaw = obj.faqs;
  let faqs: EditablePage["faqs"] = [];
  if (Array.isArray(faqsRaw)) {
    faqs = faqsRaw
      .filter((item): item is Record<string, unknown> => item && typeof item === "object" && !Array.isArray(item))
      .map((item) => ({
        q: typeof item.q === "string" && item.q.trim() !== "" ? item.q.trim() : "",
        a: typeof item.a === "string" && item.a.trim() !== "" ? item.a.trim() : "",
      }))
      .filter((f) => f.q !== "" && f.a !== "");
  }
  const defaults = DEFAULT_SITE_SETTINGS.pages[id] ?? DEFAULT_PAGE;
  return {
    heroImage: typeof obj.heroImage === "string" ? obj.heroImage.trim() : "",
    heroHeadline: str("heroHeadline", defaults.heroHeadline),
    heroSubcopy: str("heroSubcopy", defaults.heroSubcopy),
    ctaLabel: str("ctaLabel", defaults.ctaLabel),
    ctaHref: typeof obj.ctaHref === "string" && obj.ctaHref.trim() !== "" ? obj.ctaHref.trim() : defaults.ctaHref,
    faqs: faqs.length > 0 ? faqs : (defaults.faqs ?? []),
    card1Title: str("card1Title", defaults.card1Title),
    card1Text: str("card1Text", defaults.card1Text),
    card2Title: str("card2Title", defaults.card2Title),
    card2Text: str("card2Text", defaults.card2Text),
    card3Title: str("card3Title", defaults.card3Title),
    card3Text: str("card3Text", defaults.card3Text),
    contactHeading: str("contactHeading", defaults.contactHeading),
    officeHours: typeof obj.officeHours === "string" && obj.officeHours.trim() !== "" ? (obj.officeHours as string) : defaults.officeHours,
    partnerEmail: str("partnerEmail", defaults.partnerEmail),
  };
}

/** Normalize a raw `system_settings.app` value (object, JSON string from
 * MySQL, partial, or null) into a complete SiteSettings object. */
export function normalizeSiteSettings(value: unknown): SiteSettings {
  let raw: Record<string, unknown> = {};
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value.trim());
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        raw = parsed as Record<string, unknown>;
      }
    } catch {
      raw = {};
    }
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    raw = value as Record<string, unknown>;
  }
  const str = (v: unknown, fallback: string) =>
    typeof v === "string" && v.trim() !== "" ? v : fallback;
  return {
    name: str(raw.name, DEFAULT_SITE_SETTINGS.name),
    tagline: str(raw.tagline, DEFAULT_SITE_SETTINGS.tagline),
    logoUrl: typeof raw.logoUrl === "string" ? raw.logoUrl.trim() : "",
    contactEmail: str(raw.contactEmail, DEFAULT_SITE_SETTINGS.contactEmail),
    contactPhone: str(raw.contactPhone, DEFAULT_SITE_SETTINGS.contactPhone),
    address: str(raw.address, DEFAULT_SITE_SETTINGS.address),
    pages: ensureDefaults(raw.pages),
  };
}
