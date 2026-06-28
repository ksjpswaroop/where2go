"use client";

import { MapChatApp } from "@/components/mapchat/mapchat-app";
import { MapChatMaintenanceBanner, MobileAppRedirect } from "@/components/mobile-app-redirect";
import { AppShell, SoloTravelDashboard } from "@/components/product-mode/app-shell";
import { useProductMode } from "@/components/product-mode/product-mode-provider";

export function HomeExperience() {
  const { mode } = useProductMode();

  return (
    <>
      <MobileAppRedirect />
      <AppShell>
        {mode === "solo_travel" ? (
          <SoloTravelDashboard />
        ) : (
          <>
            <MapChatMaintenanceBanner />
            <MapChatApp />
          </>
        )}
      </AppShell>
    </>
  );
}
