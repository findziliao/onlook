"use client";

import { env } from "@/env";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";

// TelemetryProvider
// Unified initialization and identity management for analytics/feedback tools.
// - Initializes PostHog (analytics) and Gleap (feedback) when configured via env.
// - Keeps PostHog React context so existing `usePostHog()` calls continue to work.

let gleapSingleton: any | null = null;

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // Initialize SDKs once
    useEffect(() => {
        if (env.NEXT_PUBLIC_POSTHOG_KEY) {
            try {
                posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
                    api_host: env.NEXT_PUBLIC_POSTHOG_HOST,
                    capture_pageview: "history_change",
                    capture_pageleave: true,
                    capture_exceptions: true,
                });
            } catch (e) {
                console.warn("PostHog init failed", e);
            }
        } else {
            console.warn("PostHog key is not set, skipping initialization");
        }

        if (env.NEXT_PUBLIC_GLEAP_API_KEY) {
            (async () => {
                try {
                    // Dynamic import to avoid hard dependency when not installed
                    const mod = await import("gleap");
                    gleapSingleton = mod.default ?? mod;
                    gleapSingleton.initialize(env.NEXT_PUBLIC_GLEAP_API_KEY);
                } catch (e) {
                    console.warn("Gleap init failed (is dependency installed?)", e);
                }
            })();
        }
    }, []);

    // Soft re-initialize Gleap on path changes to guard against soft reloads/HMR
    useEffect(() => {
        if (!env.NEXT_PUBLIC_GLEAP_API_KEY) return;
        (async () => {
            try {
                const Gleap = gleapSingleton ?? (await import("gleap")).default;
                if (Gleap?.getInstance?.()?.softReInitialize) {
                    Gleap?.getInstance()?.softReInitialize();
                }
            } catch {
                // ignore
            }
        })();
    }, [pathname]);

    return <PHProvider client={posthog}>{children}</PHProvider>;
}
