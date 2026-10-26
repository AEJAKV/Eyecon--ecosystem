const nextConfig = {
  poweredByHeader: false,
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
