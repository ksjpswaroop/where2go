import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Local-notification scheduling for safety-timer expiry. A notification is
 * scheduled with the OS the moment a timer starts, so the traveler is alerted
 * when their timer runs out even if SafeTrip is backgrounded, the phone is
 * locked, or the app has been swiped away. Tapping it reopens the app on the
 * dashboard, where the existing escalation flow lets them confirm they're safe
 * or send their safety package to their contacts.
 */

const CHANNEL_ID = "safety-timers";
const ID_PREFIX = "safety-timer-";

export const SAFETY_TIMER_NOTIFICATION_KIND = "safety-timer-expiry";

export type ScheduleTimerArgs = {
  id: number;
  label?: string | null;
  /** ISO timestamp or Date when the timer runs out. */
  expiresAt: string | Date;
  notifyContacts: boolean;
  shareLocation: boolean;
};

export type TimerNotificationData = {
  kind: typeof SAFETY_TIMER_NOTIFICATION_KIND;
  timerId: number;
  notifyContacts: boolean;
  shareLocation: boolean;
};

function notificationIdForTimer(id: number) {
  return `${ID_PREFIX}${id}`;
}

const isMobile = Platform.OS !== "web";

let handlerConfigured = false;

/**
 * Installs the foreground notification handler. Safe to call multiple times;
 * only the first call takes effect. Should run once at app startup.
 */
export function configureNotifications() {
  if (!isMobile || handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Safety alerts",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

/**
 * Coarse permission state used by the settings screen. "unsupported" covers
 * web, where local notifications don't apply.
 */
export type PermissionState = "granted" | "denied" | "undetermined" | "unsupported";

/** Current notification permission state, without prompting. */
export async function getNotificationPermissionStatus(): Promise<PermissionState> {
  if (!isMobile) return "unsupported";
  const settings = await Notifications.getPermissionsAsync();
  const granted =
    settings.granted ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (granted) return "granted";
  if (settings.canAskAgain) return "undetermined";
  return "denied";
}

/** Whether the OS has already granted notification permission (no prompt). */
export async function hasNotificationPermission(): Promise<boolean> {
  if (!isMobile) return false;
  const settings = await Notifications.getPermissionsAsync();
  return (
    settings.granted ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

/**
 * Ensures notification permission, prompting the traveler if it hasn't been
 * decided yet. Returns whether notifications are allowed.
 */
export async function ensureNotificationPermissions(): Promise<boolean> {
  if (!isMobile) return false;
  const current = await Notifications.getPermissionsAsync();
  let granted =
    current.granted ||
    current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

  if (!granted && current.canAskAgain) {
    const req = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    granted =
      req.granted ||
      req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  }

  if (granted) await ensureChannel();
  return granted;
}

/**
 * Schedules (or re-schedules) the expiry notification for a timer. Any existing
 * schedule for the same timer is cancelled first, so this is safe to call when
 * a timer is extended. Returns true if a notification was scheduled.
 */
export async function scheduleTimerExpiryNotification(
  args: ScheduleTimerArgs,
): Promise<boolean> {
  if (!isMobile) return false;

  await cancelTimerExpiryNotification(args.id);

  const when = new Date(args.expiresAt).getTime();
  if (!Number.isFinite(when) || when - Date.now() <= 0) return false;

  const labelSuffix = args.label?.trim() ? ` — ${args.label.trim()}` : "";
  const body = args.notifyContacts
    ? "You didn't check in. Open SafeTrip to confirm you're safe, or send your safety package to your contacts."
    : "You didn't check in. Open SafeTrip to confirm you're safe.";

  const data: TimerNotificationData = {
    kind: SAFETY_TIMER_NOTIFICATION_KIND,
    timerId: args.id,
    notifyContacts: args.notifyContacts,
    shareLocation: args.shareLocation,
  };

  await Notifications.scheduleNotificationAsync({
    identifier: notificationIdForTimer(args.id),
    content: {
      title: `Safety timer expired${labelSuffix}`,
      body,
      sound: "default",
      priority: Notifications.AndroidNotificationPriority.MAX,
      interruptionLevel: "timeSensitive",
      data,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(when),
      channelId: CHANNEL_ID,
    },
  });

  return true;
}

/** Cancels a pending expiry notification for a timer, if one is scheduled. */
export async function cancelTimerExpiryNotification(id: number): Promise<void> {
  if (!isMobile) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(
      notificationIdForTimer(id),
    );
  } catch {
    // No schedule existed for this timer — nothing to cancel.
  }
}

/**
 * Re-arms a timer's expiry notification without prompting for permission. Used
 * on app open so an active timer keeps a scheduled alert even if it was created
 * before notifications were granted or on a different device. No-op when
 * permission hasn't been granted.
 */
export async function rearmTimerExpiryNotification(
  args: ScheduleTimerArgs,
): Promise<void> {
  if (!isMobile) return;
  if (!(await hasNotificationPermission())) return;
  await scheduleTimerExpiryNotification(args);
}

/** Type guard for a tapped safety-timer notification's data payload. */
export function isTimerNotificationData(
  data: unknown,
): data is TimerNotificationData {
  return (
    !!data &&
    typeof data === "object" &&
    (data as { kind?: unknown }).kind === SAFETY_TIMER_NOTIFICATION_KIND
  );
}
