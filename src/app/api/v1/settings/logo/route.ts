import { NextRequest } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import {
  json, errorResponse, ApiError,
  requireStaff, getAuthContext, writeAuditLog, getClientIp,
} from "@/lib/api";
import { readSiteSettings } from "../route";

export const dynamic = "force-dynamic";

// Uploaded logos are stored on disk (uploads/logos, outside public/ so they
// work in both dev and production) and served via /api/uploads/<file>.
const UPLOAD_DIR = join(process.cwd(), "uploads", "logos");

// Allowed image types (SVG excluded: it can carry executable scripts).
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

async function saveLogoUrl(logoUrl: string) {
  const merged = { ...(await readSiteSettings()), logoUrl };
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

/** Delete a previously uploaded logo file (only inside the uploads dir). */
async function deleteUploadedFile(logoUrl: string) {
  const prefix = "/api/uploads/";
  if (!logoUrl.startsWith(prefix)) return;
  const name = logoUrl.slice(prefix.length);
  if (!/^logo-\d+\.(png|jpg|webp|gif)$/.test(name)) return;
  await unlink(join(UPLOAD_DIR, name)).catch(() => {});
}

// POST /api/v1/settings/logo — upload the site logo (staff only).
// Multipart form with a "logo" file field. Saves to public/uploads and
// points the site settings at it.
export async function POST(req: NextRequest) {
  try {
    const auth = requireStaff(await getAuthContext(req));

    const data = await req.formData();
    const file = data.get("logo");
    if (!(file instanceof File) || file.size === 0) {
      throw new ApiError(400, "Please choose an image file to upload");
    }
    const ext = ALLOWED_TYPES[file.type];
    if (!ext) throw new ApiError(400, "Only PNG, JPG, WebP or GIF images are allowed");
    if (file.size > MAX_BYTES) throw new ApiError(400, "Logo must be 2MB or smaller");

    await mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `logo-${Date.now()}.${ext}`;
    await writeFile(join(UPLOAD_DIR, filename), Buffer.from(await file.arrayBuffer()));
    const logoUrl = `/api/uploads/${filename}`;

    const previous = (await readSiteSettings()).logoUrl;
    await saveLogoUrl(logoUrl);
    await deleteUploadedFile(previous);

    await writeAuditLog({
      userId: auth.userId, action: "SITE_LOGO_UPLOADED", entityType: "system_settings",
      details: { logoUrl }, ipAddress: getClientIp(req),
    });

    return json({ message: "Logo uploaded", logoUrl });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err.message, err.status);
    console.error("[api] logo upload failed:", err);
    return errorResponse("Logo upload failed. Please try again.", 500);
  }
}

// DELETE /api/v1/settings/logo — remove the logo (staff only).
// Reverts to the default 🩸 mark.
export async function DELETE(req: NextRequest) {
  try {
    const auth = requireStaff(await getAuthContext(req));
    const previous = (await readSiteSettings()).logoUrl;
    await saveLogoUrl("");
    await deleteUploadedFile(previous);
    await writeAuditLog({
      userId: auth.userId, action: "SITE_LOGO_REMOVED", entityType: "system_settings",
      ipAddress: getClientIp(req),
    });
    return json({ message: "Logo removed", logoUrl: "" });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err.message, err.status);
    console.error("[api] logo removal failed:", err);
    return errorResponse("Failed to remove logo. Please try again.", 500);
  }
}
