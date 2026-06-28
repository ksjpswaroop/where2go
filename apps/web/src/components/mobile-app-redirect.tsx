"use client";

import { useEffect, useState } from "react";

const APP_STORE_URL = "https://apps.apple.com/app/where2go";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.where2go.app";

function isMobileUserAgent() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export function MobileAppRedirect() {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    setMobile(isMobileUserAgent());
  }, []);

  if (!mobile) return null;

  return (
    <div className="bg-sky-600/90 text-white text-center py-2 px-4 text-sm z-50 relative">
      Where2Go is best on mobile.{" "}
      <a href={APP_STORE_URL} className="underline font-medium">
        App Store
      </a>
      {" · "}
      <a href={PLAY_STORE_URL} className="underline font-medium">
        Google Play
      </a>
    </div>
  );
}

export function MapChatMaintenanceBanner() {
  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-100 text-center py-2 px-4 text-xs">
      Web MapChat is in maintenance mode — use the Where2Go mobile app for the full experience.
    </div>
  );
}
