import * as Battery from "expo-battery";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert, Platform } from "react-native";

import {
  useCreateBatteryEvent,
  useGetDashboardSummary,
  useGetMe,
  useListContacts,
} from "@where2go/safety-api-client";

import { getCurrentCoords } from "@/lib/location";
import { sendSafetyPackage } from "@/lib/safetyPackage";

type BatterySafetyValue = {
  level: number | null;
  isCharging: boolean;
  supported: boolean;
};

const BatterySafetyContext = createContext<BatterySafetyValue>({
  level: null,
  isCharging: false,
  supported: false,
});

export function useBatterySafety() {
  return useContext(BatterySafetyContext);
}

export function BatterySafetyProvider({ children }: { children: React.ReactNode }) {
  const supported = Platform.OS !== "web";
  const [level, setLevel] = useState<number | null>(null);
  const [isCharging, setIsCharging] = useState(false);
  const triggeredRef = useRef(false);
  const chargingRef = useRef(false);

  const { data: profile } = useGetMe();
  const { data: contacts } = useListContacts();
  const { data: summary } = useGetDashboardSummary();
  const createBatteryEvent = useCreateBatteryEvent();

  useEffect(() => {
    if (!supported) return;

    let levelSub: Battery.Subscription | undefined;
    let stateSub: Battery.Subscription | undefined;
    let cancelled = false;

    const onLowBattery = async (pct: number, charging: boolean) => {
      const coords = await getCurrentCoords();
      try {
        await createBatteryEvent.mutateAsync({
          data: {
            level: pct,
            isCharging: charging,
            ...(coords
              ? {
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                  ...(coords.locationName
                    ? { locationName: coords.locationName }
                    : {}),
                }
              : {}),
          },
        });
      } catch {
        // logging the event is best-effort
      }

      if (profile?.lowBatterySos) {
        Alert.alert(
          "Low battery",
          `Your battery is at ${pct}%. Send a safety package to your contacts while you still have power?`,
          [
            { text: "Not now", style: "cancel" },
            {
              text: "Send package",
              style: "destructive",
              onPress: () => {
                const phones = (contacts ?? []).map((ct) => ct.phone);
                void sendSafetyPackage(phones, {
                  name: profile?.displayName,
                  batteryLevel: pct / 100,
                  isCharging: charging,
                  destination: summary?.activeTrip?.destination ?? null,
                });
              },
            },
          ],
        );
      }
    };

    const evaluate = (lvl: number, charging: boolean) => {
      const threshold = (profile?.batteryThreshold ?? 20) / 100;
      const pct = Math.round(lvl * 100);
      if (lvl <= threshold && !charging) {
        if (!triggeredRef.current) {
          triggeredRef.current = true;
          void onLowBattery(pct, charging);
        }
      } else if (lvl > threshold + 0.05 || charging) {
        triggeredRef.current = false;
      }
    };

    (async () => {
      try {
        const [lvl, state] = await Promise.all([
          Battery.getBatteryLevelAsync(),
          Battery.getBatteryStateAsync(),
        ]);
        if (cancelled) return;
        const charging =
          state === Battery.BatteryState.CHARGING ||
          state === Battery.BatteryState.FULL;
        chargingRef.current = charging;
        setLevel(lvl);
        setIsCharging(charging);
        evaluate(lvl, charging);
      } catch {
        // battery API unavailable on this device
      }

      levelSub = Battery.addBatteryLevelListener(({ batteryLevel }) => {
        setLevel(batteryLevel);
        evaluate(batteryLevel, chargingRef.current);
      });
      stateSub = Battery.addBatteryStateListener(({ batteryState }) => {
        const charging =
          batteryState === Battery.BatteryState.CHARGING ||
          batteryState === Battery.BatteryState.FULL;
        chargingRef.current = charging;
        setIsCharging(charging);
      });
    })();

    return () => {
      cancelled = true;
      levelSub?.remove();
      stateSub?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    supported,
    profile?.batteryThreshold,
    profile?.lowBatterySos,
    contacts,
    summary?.activeTrip?.destination,
  ]);

  return (
    <BatterySafetyContext.Provider value={{ level, isCharging, supported }}>
      {children}
    </BatterySafetyContext.Provider>
  );
}
