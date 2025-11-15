// src/app/api/me/offer/[handle]/route.ts
export const dynamic = 'force-dynamic';

type Params = { handle: string };
type Ctx = { params: Promise<Params> };

export async function GET(req: Request, { params }: Ctx) {
  const { handle } = await params;
  return Response.redirect(new URL(`/api/offers/${handle}`, req.url), 307);
}

export async function POST(req: Request, { params }: Ctx) {
  const { handle } = await params;
  return Response.redirect(new URL(`/api/offers/${handle}`, req.url), 307);
}
