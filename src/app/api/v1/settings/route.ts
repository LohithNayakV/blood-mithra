import { NextRequest } from "next/server";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  json, errorResponse, parseBody, ApiError,
  requireStaff, getAuthContext, writeAuditLog, getClientIp, parseJsonField,
} from "@/lib/api";
import {
  normalizeSiteSettings, type SiteSettings, type EditablePage,
  type EditablePageId, EDITABLE_PAGE_IDS,
} from "@/lib/site";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function readSiteSettings(): Promise<SiteSettings> {
  try {
    const [row] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "app"))
      .limit(1);
    return normalizeSiteSettings(parseJsonField(row?.value, null));
  } catch {
    return normalizeSiteSettings(null);
  }
}

// GET /api/v1/settings — public site content (logo, contact details, pages).
// Never fails: the navbar/footer depend on it, so fall back to defaults.
export async function GET() {
  return json({ settings: await readSiteSettings() });
}

// PATCH /api/v1/settings — update site content (staff only).
// Body may include any subset of: name, tagline, logoUrl, contactEmail,
// contactPhone, address, and pages.<pageId>.<field>. Unknown page ids and
// unknown page fields are ignored so older clients keep working.
export async function PATCH(req: NextRequest) {
  try {
    return await updateSiteSettings(req);
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err.message, err.status);
    console.error("[api] settings update failed:", err);
    return errorResponse("Failed to save site settings. Please try again.", 500);
  }
}

function isPageId(value: unknown): value is EditablePageId {
  return typeof value === "string" && EDITABLE_PAGE_IDS.includes(value as EditablePageId);
}

function pageFieldSchema(field: string): { maxLength: number } | null {
  switch (field) {
    case "heroHeadline":
      return { maxLength: 160 };
    case "heroSubcopy":
      return { maxLength: 600 };
    case "ctaLabel":
      return { maxLength: 80 };
    case "ctaHref":
      return { maxLength: 500 };
    case "card1Title":
    case "card2Title":
    case "card3Title":
    case "contactHeading":
      return { maxLength: 80 };
    case "card1Text":
    case "card2Text":
    case "card3Text":
      return { maxLength: 300 };
    case "officeHours":
      return { maxLength: 500 };
    case "partnerEmail":
      return { maxLength: 190 };
    default:
      return null;
  }
}

function validatePageField(field: string, value: unknown): string | null {
  // Legacy SEO fields were removed from the admin UI — ignore silently so
  // older clients don't break.
  if (field === "title" || field === "description") return null;
  if (field === "ctaHref") {
    const s = String(value ?? "").trim();
    if (s !== "" && !s.startsWith("/") && !s.startsWith("#") && !/^https?:\/\//i.test(s)) {
      throw new ApiError(400, `Page CTA href must be a site path (e.g. /become-donor) or an http(s) URL`);
    }
    return s;
  }
  if (field === "partnerEmail") {
    const s = String(value ?? "").trim();
    if (s !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new ApiError(400, "Invalid partner email address");
    return s;
  }
  const schema = pageFieldSchema(field);
  if (!schema) return null;
  const s = String(value ?? "").trim();
  if (s.length > schema.maxLength) {
    throw new ApiError(400, `Page field "${field}" must be ${schema.maxLength} characters or less`);
  }
  return s;
}

function validateAndNormalizeFaqs(raw: unknown): EditablePage["faqs"] {
  if (!Array.isArray(raw)) {
    if (raw !== undefined) throw new ApiError(400, "Page faqs must be an array");
    return [];
  }
  const out: EditablePage["faqs"] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new ApiError(400, `faqs[${i}] must be an object`);
    }
    const quoted = item as Record<string, unknown>;
    const q = String(quoted.q ?? "").trim();
    const a = String(quoted.a ?? "").trim();
    if (q.length === 0) throw new ApiError(400, `faqs[${i}].q is required`);
    if (q.length > 240) throw new ApiError(400, `faqs[${i}].q must be 240 characters or less`);
    if (a.length === 0) throw new ApiError(400, `faqs[${i}].a is required`);
    if (a.length > 2000) throw new ApiError(400, `faqs[${i}].a must be 2000 characters or less`);
    out.push({ q, a });
  }
  return out;
}

async function updateSiteSettings(req: NextRequest) {
  const auth = requireStaff(await getAuthContext(req));
  const body = await parseBody(req);

  const current = await readSiteSettings();
  const merged: SiteSettings = { ...current };

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (name.length < 2 || name.length > 80) throw new ApiError(400, "Site name must be 2–80 characters");
    merged.name = name;
  }
  if (body.tagline !== undefined) {
    const tagline = String(body.tagline).trim();
    if (tagline.length > 160) throw new ApiError(400, "Tagline must be 160 characters or less");
    merged.tagline = tagline || current.tagline;
  }
  if (body.logoUrl !== undefined) {
    const logoUrl = String(body.logoUrl).trim();
    if (logoUrl.length > 500) throw new ApiError(400, "Logo URL is too long (max 500 characters)");
    if (logoUrl !== "" && !logoUrl.startsWith("/") && !/^https?:\/\//i.test(logoUrl)) {
      throw new ApiError(400, "Logo must be a site path (e.g. /logo.png) or an http(s) URL — or empty to use the default mark");
    }
    merged.logoUrl = logoUrl;
  }
  if (body.contactEmail !== undefined) {
    const contactEmail = String(body.contactEmail).trim();
    if (contactEmail !== "" && !EMAIL_RE.test(contactEmail)) throw new ApiError(400, "Invalid contact email address");
    if (contactEmail !== "") merged.contactEmail = contactEmail;
  }
  if (body.contactPhone !== undefined) {
    const contactPhone = String(body.contactPhone).trim();
    if (contactPhone.length > 40) throw new ApiError(400, "Contact phone must be 40 characters or less");
    if (contactPhone !== "") merged.contactPhone = contactPhone;
  }
  if (body.address !== undefined) {
    const address = String(body.address).trim();
    if (address.length > 255) throw new ApiError(400, "Address must be 255 characters or less");
    if (address !== "") merged.address = address;
  }

  // Per-page content is nested under `pages.<pageId>.<field>` so one PATCH
  // request can touch many pages at once, while still being partial.
  if (body.pages !== undefined) {
    const pagesInput = body.pages;
    if (pagesInput && typeof pagesInput === "object" && !Array.isArray(pagesInput)) {
      const pagesRaw = pagesInput as Record<string, unknown>;
      for (const [pageId, pageFields] of Object.entries(pagesRaw)) {
        if (!isPageId(pageId)) continue;
        if (!pageFields || typeof pageFields !== "object" || Array.isArray(pageFields)) {
          throw new ApiError(400, `pages.${pageId} must be an object`);
        }
        const fields = pageFields as Record<string, unknown>;
        const page = { ...merged.pages[pageId] } as Record<string, unknown>;

        if (fields.heroImage !== undefined) {
          const heroImage = String(fields.heroImage).trim();
          if (heroImage.length > 500) throw new ApiError(400, "Page hero image URL is too long (max 500 characters)");
          if (heroImage !== "" && !heroImage.startsWith("/") && !/^https?:\/\//i.test(heroImage)) {
            throw new ApiError(400, `pages.${pageId}.heroImage must be a site path or an http(s) URL`);
          }
          page.heroImage = heroImage;
        }

        if (fields.faqs !== undefined) {
          page.faqs = validateAndNormalizeFaqs(fields.faqs);
        }

        for (const [field, value] of Object.entries(fields)) {
          if (field === "heroImage" || field === "faqs") continue;
          const validated = validatePageField(field, value);
          if (validated === null) continue;
          page[field] = validated;
        }

        merged.pages[pageId] = normalizeSiteSettings({ pages: { [pageId]: page } }).pages[pageId];
      }
    }
  }

  await db
    .insert(systemSettings)
    .values({
      key: "app",
      value: merged,
      description: "Public site configuration (editable from Admin → Site Content)",
      category: "general",
    })
    .onDuplicateKeyUpdate({ set: { value: merged, updatedAt: new Date() } });

  const changed: string[] = [];
  if (body.name !== undefined) changed.push("name");
  if (body.tagline !== undefined) changed.push("tagline");
  if (body.logoUrl !== undefined) changed.push("logoUrl");
  if (body.contactEmail !== undefined) changed.push("contactEmail");
  if (body.contactPhone !== undefined) changed.push("contactPhone");
  if (body.address !== undefined) changed.push("address");
  if (body.pages !== undefined) {
    const pagesInput = body.pages;
    if (pagesInput && typeof pagesInput === "object" && !Array.isArray(pagesInput)) {
      for (const pageId of EDITABLE_PAGE_IDS) {
        if ((pagesInput as Record<string, unknown>)[pageId]) changed.push(`pages.${pageId}`);
      }
    }
  }

  await writeAuditLog({
    userId: auth.userId, action: "SITE_SETTINGS_UPDATED", entityType: "system_settings",
    details: { keys: changed }, ipAddress: getClientIp(req),
  });

  return json({ message: "Site content updated", settings: merged });
}
