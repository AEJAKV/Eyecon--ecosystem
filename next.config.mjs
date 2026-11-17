// Photos uploaded in the workspace (optometrists, affiliates, blog) live in this project's public Supabase Storage
// buckets. next/image only shows external photos from addresses listed here, so allow exactly that folder and nothing
// else. Without a Supabase URL (demo mode) the list stays empty.
export function storagePatterns(supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try { const u = new URL(supabaseUrl); return [{ protocol: 'https', hostname: u.hostname, port: '', pathname: '/storage/v1/object/public/**', search: '' }]; }
  catch { return []; }
}
const nextConfig = {
  poweredByHeader: false,
  images: { remotePatterns: storagePatterns() },
  // The gift card image (lib/gift-image.js) reads the site's fonts at run time.
  outputFileTracingIncludes: { '/api/**': ['./assets/fonts/**'] },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
    ] }];
  }
};
export default nextConfig;
