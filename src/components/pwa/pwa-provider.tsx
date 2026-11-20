"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import styles from "./pwa.module.css";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // Register Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(reg => {
          if (process.env.NODE_ENV !== "production") {
            console.info("PWA: Service Worker registered with scope:", reg.scope);
          }
        })
        .catch(err => {
          console.warn("PWA: Service Worker registration failed:", err);
        });
    }

    // Check if running in standalone mode (already installed)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      return;
    }

    // Check if dismissed in this session
    const dismissed = sessionStorage.getItem("pwa_prompt_dismissed");
    if (dismissed === "1") {
      return;
    }

    // Check if iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua);

    // Listen for Chromium install prompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // If on iOS and not dismissed, show friendly iOS install banner after 2 seconds
    let iosTimer: NodeJS.Timeout;
    if (isIosDevice) {
      iosTimer = setTimeout(() => {
        setIsIos(true);
        if (!sessionStorage.getItem("pwa_prompt_dismissed")) {
          setShowPrompt(true);
        }
      }, 2000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setShowPrompt(false);
        setDeferredPrompt(null);
      }
    } else if (isIos) {
      setShowIosGuide(!showIosGuide);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem("pwa_prompt_dismissed", "1");
  };

  return (
    <>
      {children}
      {showPrompt && (
        <aside
          className={styles.pwaBanner}
          role="region"
          aria-label="Install iTech Care Application"
        >
          <div className={styles.pwaIcon}>
            <Image
              src="/icons/icon-192.png"
              alt="iTech Care Logo"
              width={44}
              height={44}
            />
          </div>
          <div className={styles.pwaContent}>
            <h2 className={styles.pwaTitle}>Install iTech Care</h2>
            <p className={styles.pwaDesc}>
              Instant access to appliance service booking & live tracking.
            </p>
            {showIosGuide && (
              <div className={styles.iosGuide}>
                Tap the <strong>Share</strong> button (⎋) below, then select{" "}
                <strong>Add to Home Screen</strong> (⊕).
              </div>
            )}
          </div>
          <div className={styles.pwaActions}>
            <button
              type="button"
              className={styles.installBtn}
              onClick={handleInstallClick}
            >
              {isIos ? (showIosGuide ? "Got it" : "How to Add") : "Install"}
            </button>
            <button
              type="button"
              className={styles.dismissBtn}
              onClick={handleDismiss}
              aria-label="Dismiss install banner"
            >
              ✕
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
