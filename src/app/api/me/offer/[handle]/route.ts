// src/app/api/me/offer/[handle]/route.ts
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;
  return Response.redirect(new URL(`/api/offers/${handle}`, req.url), 307);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;
  return Response.redirect(new URL(`/api/offers/${handle}`, req.url), 307);
}
