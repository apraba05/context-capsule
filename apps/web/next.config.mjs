/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages are imported as source.
  transpilePackages: ["@capsule/core", "@capsule/db", "@capsule/redaction"],
  serverExternalPackages: ["postgres", "@slack/web-api"],
};

export default nextConfig;
