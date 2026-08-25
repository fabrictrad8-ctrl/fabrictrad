import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const RELEASE = 'fabrictrad-commerce-ux-2026-08-25-r2';

export async function GET() {
  return NextResponse?.json(
    {
      ok: true,
      service: 'fabrictrad',
      release: RELEASE,
      runtime: 'cloudflare-worker',
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
