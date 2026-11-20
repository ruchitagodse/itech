import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "iTech Care — Home Appliance Services",
    short_name: "iTech Care",
    description: "Premium on-demand AC & water purifier service, routine maintenance, and AMC tracking.",
    start_url: "/",
    id: "/?source=pwa",
    display: "standalone",
    display_override: ["standalone", "minimal-ui", "window-controls-overlay"],
    background_color: "#f6f9fc",
    theme_color: "#07529b",
    orientation: "portrait",
    categories: ["lifestyle", "utilities", "business"],
    lang: "en-IN",
    dir: "ltr",
    scope: "/",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192-maskable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "My Appliances",
        short_name: "Appliances",
        description: "View and manage your registered appliances",
        url: "/customer/appliances",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Track Requests",
        short_name: "Requests",
        description: "Track active service visits and progress",
        url: "/customer/service-requests",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Book Home Service",
        short_name: "Book Service",
        description: "Schedule free maintenance or repair visit",
        url: "/customer/service-requests/new",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Technician Tasks",
        short_name: "Assignments",
        description: "View assigned service jobs for technicians",
        url: "/technician/assignments",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
    screenshots: [
      {
        src: "/screenshots/customer-mobile.png",
        sizes: "360x840",
        type: "image/png",
        form_factor: "narrow",
        label: "Customer Service Calendar and Maintenance Tracking",
      },
      {
        src: "/screenshots/customer-desktop.png",
        sizes: "1280x900",
        type: "image/png",
        form_factor: "wide",
        label: "Desktop Service Management & Overview",
      },
    ],
  };
}
