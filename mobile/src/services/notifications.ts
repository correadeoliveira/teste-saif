import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

let handlerReady = false;

function ensureHandler(): void {
    if (handlerReady || Platform.OS === "web") return;
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
        }),
    });
    handlerReady = true;
}

export async function configureNotifications(): Promise<boolean> {
    if (Platform.OS === "web") return false;
    ensureHandler();
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return false;
    if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("zone-critical", {
            name: "Zonas críticas",
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#FF5454",
        });
    }
    return true;
}

export async function notifyCriticalZone(body: string): Promise<void> {
    if (Platform.OS === "web") return;
    ensureHandler();
    try {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: "SAIFEN · ZONA CRÍTICA",
                body,
                sound: true,
                ...(Platform.OS === "android" ? { channelId: "zone-critical" } : {}),
            },
            trigger: null,
        });
    } catch {
        /* Expo Go / permissão recusada */
    }
}
