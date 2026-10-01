// Deliberately NOT `output: 'export'`.
//
// The sister site (CUE) is a static export, and that forced the first version of
// this dashboard to be a public page whose DATA was gated server-side while its
// session token sat in localStorage. Running this as a real Next server buys two
// things that a static build cannot have: the page itself can be gated before it
// is ever sent, and the token can live in an httpOnly cookie the browser's own
// JavaScript cannot read.
//
// The two env values are only for Settings > About (DASHBOARD BRIEF #5): when
// this build was made, and which commit (Vercel sets VERCEL_GIT_COMMIT_SHA).
// One id per build, identical in the browser bundle and in /api/build.
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA || `local-${Date.now()}`;

const nextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    NEXT_PUBLIC_BUILD_SHA: process.env.VERCEL_GIT_COMMIT_SHA || '',
  },
};
export default nextConfig;
