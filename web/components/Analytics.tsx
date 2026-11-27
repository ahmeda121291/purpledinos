"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from "react";

const KEY = "phc_x3u9YJknqHoLwmVGz8dw9pqn2dxTuv2ZcHtniot8KgxU";
let ph: any = null;
const queue: [string, Record<string, unknown> | undefined][] = [];

// Loaded after the page so it never slows the first paint. Production domain only.
export default function Analytics() {
  useEffect(() => {
    if (ph || !/purpledinos\.ca$/.test(window.location.hostname)) return;
    import("posthog-js").then(({ default: posthog }) => {
      posthog.init(KEY, { api_host: "/ingest", ui_host: "https://us.posthog.com", defaults: "2025-05-24", person_profiles: "identified_only" });
      ph = posthog;
      queue.splice(0).forEach(([e, p]) => ph.capture(e, p));
    });
  }, []);
  return null;
}

export function track(event: string, props?: Record<string, unknown>) {
  try { if (ph) ph.capture(event, props); else if (queue.length < 20) queue.push([event, props]); } catch { /* ignore */ }
}
