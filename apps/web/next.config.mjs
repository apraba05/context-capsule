/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages are imported as source.
  transpilePackages: ["@capsule/core", "@capsule/db", "@capsule/redaction"],
  experimental: {
    // Slack signature verification needs the raw body.
    serverComponentsExternalPackages: ["postgres", "@slack/web-api"],
  },
};

export default nextConfig;
