import { toast } from "sonner";

// Wires vite-plugin-pwa's autoUpdate registration into a "New version
// available" sonner toast with a Reload action. Returns early in preview /
// iframe contexts so the editor preview is never affected.
export async function setupPwaUpdate() {
  const isInIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();
  const isPreviewHost =
    window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com");
  if (isInIframe || isPreviewHost) return;
  if (!("serviceWorker" in navigator)) return;

  try {
    const { registerSW } = await import("virtual:pwa-register");
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        toast.message("New version available", {
          description: "Reload to get the latest update.",
          duration: Infinity,
          action: {
            label: "Reload",
            onClick: () => updateSW(true),
          },
        });
      },
      onOfflineReady() {
        toast.success("App ready to work offline");
      },
      onRegisterError(err) {
        console.warn("[pwa] register error", err);
      },
    });
  } catch (e) {
    console.warn("[pwa] update setup skipped", e);
  }
}