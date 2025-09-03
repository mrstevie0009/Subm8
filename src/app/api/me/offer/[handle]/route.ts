// src/app/api/me/offer/[handle]/route.ts
export const dynamic = "force-dynamic";

type Ctx = { params: { handle: string } };

export async function GET(req: Request, { params }: Ctx) {
  return Response.redirect(new URL(`/api/offers/${params.handle}`, req.url), 307);
}
export async function POST(req: Request, { params }: Ctx) {
  return Response.redirect(new URL(`/api/offers/${params.handle}`, req.url), 307);
}
