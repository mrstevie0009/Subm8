// src/app/api/offers/[handle]/route.ts
import path from "node:path";
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";

export const dynamic = "force-dynamic";

type Params = { handle: string };
type Ctx = { params: Promise<Params> };

function sanitizeFileName(name: string) {
  const base = name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
  return base.length ? base : `upload_${Date.now()}`;
}
function isImg(type: string) {
  return /^image\//.test(type);
}

/** ---------- GET: public read ---------- */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { handle: rawHandle } = await params;
    const handle = decodeURIComponent(String(rawHandle ?? "")).trim();

    const u = await prisma.user.findFirst({
      where: { handle: { equals: handle, mode: "insensitive" } },
      select: {
        handle: true,
        displayName: true,
        avatarUrl: true,
        offerTitle: true,
        offerText: true,
        offerBgUrl: true,
        offerBgDim: true,
      },
    });

    if (!u) return Response.json({ ok: false, error: "Not found" }, { status: 404 });

    return Response.json({
      ok: true,
      user: {
        handle: u.handle,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
      },
      offer: {
        title: u.offerTitle ?? "",
        text: u.offerText ?? "",
        bgUrl: u.offerBgUrl ?? "",
        bgDim: typeof u.offerBgDim === "number" ? u.offerBgDim : 0.35,
      },
    });
  } catch (e) {
    console.error("GET /api/offers/[handle] failed:", e);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

/** ---------- POST: owner write ---------- */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const me = await getCurrentUser();
    if (!me) return Response.json({ ok: false, error: "Not authenticated" }, { status: 401 });

    const { handle: rawHandle } = await params;
    const handle = decodeURIComponent(String(rawHandle ?? "")).trim();

    const owner = await prisma.user.findFirst({
      where: { handle: { equals: handle, mode: "insensitive" } },
      select: { id: true, offerBgUrl: true },
    });
    if (!owner) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
    if (owner.id !== me.id) {
      return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
      return Response.json({ ok: false, error: "Expected multipart/form-data" }, { status: 400 });
    }

    const form = await req.formData();
    const title = String(form.get("title") ?? "").slice(0, 120);
    const text = String(form.get("text") ?? "").slice(0, 4000);
    const dimRaw = String(form.get("dim") ?? "");
    const removeBg = String(form.get("removeBg") ?? "") === "1";

    let dim = Number.isFinite(Number(dimRaw)) ? Number(dimRaw) : 0.35;
    if (dim < 0) dim = 0;
    if (dim > 1) dim = 1;

    let bgUrl: string | null | undefined = undefined; // undefined = nicht ändern
    const fileEntry = form.get("bg");
    const file = fileEntry && typeof fileEntry !== "string" ? (fileEntry as File) : null;

    if (removeBg && !file) {
      bgUrl = null; // explizit löschen
    }

    if (file) {
      const type = file.type || "application/octet-stream";
      if (!isImg(type)) {
        return Response.json({ ok: false, error: "Unsupported file type" }, { status: 400 });
      }
      if (file.size > 25 * 1024 * 1024) {
        return Response.json({ ok: false, error: "File too large" }, { status: 413 });
      }

      const uploadsDir = path.join(process.cwd(), "public", "uploads", "offers");
      await fs.mkdir(uploadsDir, { recursive: true });
      const safe = sanitizeFileName(file.name);
      const filename = `${randomUUID()}_${safe}`;
      const absPath = path.join(uploadsDir, filename);
      const buf = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(absPath, buf);
      bgUrl = `/uploads/offers/${encodeURIComponent(filename)}`;
    }

    const updated = await prisma.user.update({
      where: { id: owner.id },
      data: {
        offerTitle: title,
        offerText: text,
        offerBgDim: dim,
        ...(bgUrl !== undefined ? { offerBgUrl: bgUrl } : {}),
      },
      select: {
        offerTitle: true,
        offerText: true,
        offerBgUrl: true,
        offerBgDim: true,
      },
    });

    return Response.json({
      ok: true,
      offer: {
        title: updated.offerTitle ?? "",
        text: updated.offerText ?? "",
        bgUrl: updated.offerBgUrl ?? "",
        bgDim: typeof updated.offerBgDim === "number" ? updated.offerBgDim : 0.35,
      },
    });
  } catch (e) {
    console.error("POST /api/offers/[handle] failed:", e);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
