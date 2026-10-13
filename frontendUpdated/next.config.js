/** @type {import('next').NextConfig} */
const backendUrl = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://prep2place-backend.onrender.com"
).replace(/\/+$/, "");

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/actuator/:path*",
        destination: `${backendUrl}/actuator/:path*`,
      },
    ];
  },
};
module.exports = nextConfig;
