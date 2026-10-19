import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JoblyAI Career Space",
    short_name: "JoblyAI",
    description: "Your personal job search and career assistant.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8f4",
    theme_color: "#007aff",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}