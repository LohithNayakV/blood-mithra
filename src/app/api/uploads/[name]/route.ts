import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

type Ctx = { params: Promise<{ name: string }> };

// GET /api/uploads/:name — serve an uploaded site asset.
// Files added to public/ at runtime are not picked up by the production
// server, so uploads live outside public/ and are streamed from here:
//   - logo-<ts>.<ext> live in uploads/logos (site logo)
//   - page-<ts>.<ext>  live in uploads/site-images (per-page hero banners)
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { name } = await ctx.params;
  const match = /^(logo|page)-(\d+)\.(png|jpg|webp|gif)$/.exec(name);
  if (!match) {
    return new Response("Not found", { status: 404 });
  }
  const dir = match[1] === "logo" ? "logos" : "site-images";
  try {
    const data = await readFile(join(process.cwd(), "uploads", dir, name));
    return new Response(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": CONTENT_TYPES[match[3]],
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
