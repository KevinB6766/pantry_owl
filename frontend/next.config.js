/** @type {import('next').NextConfig} */
module.exports = {
  async headers() {
    return [
      {
        // The service worker must always be re-checked so updates ship promptly.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};
