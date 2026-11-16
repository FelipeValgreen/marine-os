/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/bridge",
        destination: "/?section=bridge",
        permanent: false,
      },
      {
        source: "/voyages",
        destination: "/?section=voyages",
        permanent: false,
      },
      {
        source: "/zarpe",
        destination: "/?section=voyages",
        permanent: false,
      },
      {
        source: "/gemelo",
        destination: "/?section=gemelo",
        permanent: false,
      },
      {
        source: "/digital-twin",
        destination: "/?section=gemelo",
        permanent: false,
      },
      {
        source: "/logbook",
        destination: "/?section=logbook",
        permanent: false,
      },
      {
        source: "/passport",
        destination: "/?section=logbook",
        permanent: false,
      },
      {
        source: "/inspections",
        destination: "/?section=inspections",
        permanent: false,
      },
      {
        source: "/academy",
        destination: "/?section=academy",
        permanent: false,
      },
      {
        source: "/trip",
        destination: "/trip/demo-trip-albatros-2026",
        permanent: false,
      },
      {
        source: "/handover",
        destination: "/vessels/22222222-2222-2222-2222-222222222222/handover",
        permanent: false,
      },
      {
        source: "/qr",
        destination: "/?section=gemelo",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
