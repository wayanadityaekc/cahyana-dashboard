// Deliberately NOT `output: 'export'`.
//
// The sister site (CUE) is a static export, and that forced the first version of
// this dashboard to be a public page whose DATA was gated server-side while its
// session token sat in localStorage. Running this as a real Next server buys two
// things that a static build cannot have: the page itself can be gated before it
// is ever sent, and the token can live in an httpOnly cookie the browser's own
// JavaScript cannot read.
const nextConfig = {};
export default nextConfig;
