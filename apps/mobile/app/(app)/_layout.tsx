import { useAuth } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { Redirect, Stack, useRouter } from "expo-router";
import { useEffect } from "react";

import { setAuthTokenGetter } from "@where2go/safety-api-client";

import colors from "@/constants/colors";
import { ActivePlanProvider } from "@/context/ActivePlanContext";
import { BatterySafetyProvider } from "@/context/BatterySafetyContext";
import { ChatProvider } from "@/context/ChatContext";
import { MapLayersProvider } from "@/context/MapLayersContext";
import { ProductModeProvider } from "@/context/ProductModeContext";
import { isTimerNotificationData } from "@/lib/notifications";

export default function AppLayout() {
  const { isSignedIn, getToken } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  // When the traveler taps a safety-timer expiry notification (app backgrounded
  // or killed), open the dashboard and refresh so the existing expiry
  // escalation prompt fires.
  useEffect(() => {
    let cancelled = false;

    const handleExpiry = () => {
      void queryClient.invalidateQueries();
      router.navigate("/safe");
    };

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (cancelled || !response) return;
      if (isTimerNotificationData(response.notification.request.content.data)) {
        handleExpiry();
        // Consume it so a later relaunch doesn't re-trigger the deep link.
        void Notifications.clearLastNotificationResponseAsync?.();
      }
    });

    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        if (
          isTimerNotificationData(response.notification.request.content.data)
        ) {
          handleExpiry();
        }
      },
    );

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [router, queryClient]);

  if (!isSignedIn) return <Redirect href="/sign-in" />;

  return (
    <ProductModeProvider>
      <BatterySafetyProvider>
        <ActivePlanProvider>
          <MapLayersProvider>
            <ChatProvider>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.dark.background },
                }}
              >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="profile" />
                <Stack.Screen name="journal" />
                <Stack.Screen name="trips" />
                <Stack.Screen name="timer" options={{ presentation: "modal" }} />
                <Stack.Screen name="scanner" options={{ presentation: "modal" }} />
              </Stack>
            </ChatProvider>
          </MapLayersProvider>
        </ActivePlanProvider>
      </BatterySafetyProvider>
    </ProductModeProvider>
  );
}
