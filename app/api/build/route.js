import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Which build is being served right now. The installed app asks this when it
// comes back to the foreground (components/UpdatePrompt.jsx); if the answer is
// not the build the app is running, it offers a refresh. Public on purpose: it
// is one opaque id (a commit sha), and it has to answer before sign-in too.
export function GET() {
  return NextResponse.json(
    { id: process.env.NEXT_PUBLIC_BUILD_ID || '' },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
