import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CarePland",
    short_name: "CarePland",
    description:
      "CarePland helps patients and caregivers bring forward the context that matters for the next medical appointment.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7fbff",
    theme_color: "#254a6d",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
