import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /** Profile photo uploads (see lib/avatar/constants.ts). */
      bodySizeLimit: "6mb",
    },
    // Client Router Cache: reuse a page's data on revisit within this window
    // instead of refetching on every navigation. Mutations already call
    // revalidatePath() throughout the app's server actions, which busts this
    // cache for the affected path, so edits still show up immediately.
    staleTimes: {
      dynamic: 60,
      static: 180,
    },
  },
};

export default nextConfig;
