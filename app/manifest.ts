import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Coco App",
    short_name: "Coco",
    description: "Coco community dashboard for members.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#00475d",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
