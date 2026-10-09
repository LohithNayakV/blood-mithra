import { NextRequest } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { readSiteSettings } from "../route";
import {
  json, errorResponse, ApiError,
  requireStaff, getAuthContext, writeAuditLog, getClientIp,
} from "@/lib/api";

export const dynamic = "force-dynamic";

// Site images (logos, per-page hero banners) are stored on disk
// (uploads/site-images, outside public/) and served via /api/uploads/<file>.
const UPLOAD_DIR = join(process.cwd(), "uploads", "site-images");

// Allowed image types (SVG excluded: it can carry executable scripts).
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

const PREFIX = "/api/uploads/";
const NAME_RE = /^(logo|page)-(\d+)\.(png|jpg|webp|gif)$/;

async function deleteUploadedFile(url: string) {
  if (!url.startsWith(PREFIX)) return;
  const name = url.slice(PREFIX.length);
  if (!NAME_RE.test(name)) return;
  await unlink(join(UPLOAD_DIR, name)).catch(() => {});
}

async function saveImageUrl(imageUrl: string, settingsPatch: Record<string, unknown>) {
  const current = await readSiteSettings();
  const merged = { ...current } as typeof current;
  if (
    settingsPatch.pages &&
    typeof settingsPatch.pages === "object" &&
    !Array.isArray(settingsPatch.pages)
  ) {
    // Deep-merge per-page so uploading one hero image never wipes other pages.
    const pagesPatch = settingsPatch.pages as Record<string, Record<string, unknown>>;
    merged.pages = { ...current.pages } as typeof current.pages;
    for (const [pageId, fields] of Object.entries(pagesPatch)) {
      if (!fields || typeof fields !== "object" || Array.isArray(fields)) continue;
      const existing = (current.pages as unknown as Record<string, Record<string, unknown>>)[pageId] ?? {};
      (merged.pages as unknown as Record<string, Record<string, unknown>>)[pageId] = { ...existing, ...fields };
    }
  } else {
    Object.assign(merged, settingsPatch);
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
}

// POST /api/v1/settings/images — upload a site image (staff only).
// Accepts multipart form with a "file" field, plus optional "page" and "field"
// so the image can be linked directly to a page block (e.g. page=about,
// field=heroImage). When page/field are provided, the uploaded image is
// written into that page block automatically.
//
// Examples:
//   - new site logo:  POST { file }                          -> updates logoUrl
//   - page hero image: POST { file, page: "about", field: "heroImage" }
export async function POST(req: NextRequest) {
  try {
    const auth = requireStaff(await getAuthContext(req));

    const data = await req.formData();
    const file = data.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new ApiError(400, "Please choose an image file to upload");
    }
    const ext = ALLOWED_TYPES[file.type];
    if (!ext) throw new ApiError(400, "Only PNG, JPG, WebP or GIF images are allowed");
    if (file.size > MAX_BYTES) throw new ApiError(400, "Image must be 2MB or smaller");

    const page = data.get("page")?.toString() ?? "";
    const field = data.get("field")?.toString() ?? "";

    await mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `page-${Date.now()}.${ext}`;
    await writeFile(join(UPLOAD_DIR, filename), Buffer.from(await file.arrayBuffer()));
    const imageUrl = `${PREFIX}${filename}`;

    let settingsPatch: Record<string, unknown> = {};
    let auditAction = "SITE_IMAGE_UPLOADED";

    if (page && field) {
      if (field !== "heroImage") throw new ApiError(400, "Only the heroImage field can be set via image upload");
      if (page !== "home" && page !== "about") throw new ApiError(400, "Unknown editable page");
      settingsPatch = { pages: { [page]: { [field]: imageUrl } } };
      auditAction = "SITE_PAGE_IMAGE_UPLOADED";
    } else {
      settingsPatch = { logoUrl: imageUrl };
    }

    const previousLogo = (await readSiteSettings()).logoUrl;
    await saveImageUrl(imageUrl, settingsPatch);
    // Best-effort cleanup of the previous logo so orphaned files don't pile up.
    await deleteUploadedFile(previousLogo);

    await writeAuditLog({
      userId: auth.userId,
      action: auditAction,
      entityType: "system_settings",
      details: { imageUrl, page: page || undefined, field: field || undefined },
      ipAddress: getClientIp(req),
    });

    return json({ message: "Image uploaded", imageUrl });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err.message, err.status);
    console.error("[api] site image upload failed:", err);
    return errorResponse("Image upload failed. Please try again.", 500);
  }
}
