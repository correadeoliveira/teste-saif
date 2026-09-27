import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Heatmap, PROVIDER_DEFAULT } from "react-native-maps";

import { PanicButton } from "../components/PanicButton";
import { colors } from "../theme/colors";
import { loadHeatmap, type HeatmapPayload } from "../services/heatmap";
import { getCurrent, type Coords } from "../services/location";
import { getMonitorMode, subscribeMonitorMode, type MonitorMode } from "../services/zoneMonitor";
import { subscribeZone } from "../services/zoneEngine";
import { ZONE_LABEL, type ZoneSnapshot } from "../services/zone";

const SP_CENTER = { latitude: -23.5505, longitude: -46.6333 };

export function MapScreen() {
    const insets = useSafeAreaInsets();
    const [heat, setHeat] = useState<HeatmapPayload | null>(null);
    const [me, setMe] = useState<Coords | null>(null);
    const [zone, setZone] = useState<ZoneSnapshot | null>(null);
    const [monitor, setMonitor] = useState<MonitorMode>(getMonitorMode());

    useEffect(() => {
        loadHeatmap("all").then(setHeat);
        getCurrent().then(setMe);
        const offZone = subscribeZone((s) => {
            setZone(s);
            setMe({ lat: s.lat, lng: s.lng, accuracy: null });
        });
        const offMode = subscribeMonitorMode(setMonitor);
        return () => {
            offZone();
            offMode();
        };
    }, []);

    const zoneColor = zone ? colors.threat[zone.level] : colors.textDim;

    return (
        <View style={styles.root}>
            <MapView
                style={StyleSheet.absoluteFill}
                provider={PROVIDER_DEFAULT}
                initialRegion={{
                    ...SP_CENTER,
                    latitudeDelta: 0.06,
                    longitudeDelta: 0.06,
                }}
                showsUserLocation
                customMapStyle={DARK_MAP_STYLE}
            >
                {heat && heat.points.length > 0 && (
                    <Heatmap
                        points={heat.points.map(([lat, lng, weight]) => ({
                            latitude: lat,
                            longitude: lng,
                            weight,
                        }))}
                        radius={40}
                        opacity={0.85}
                        gradient={{
                            colors: [
                                "rgba(0,255,159,0.0)",
                                "rgba(0,255,159,0.35)",
                                "rgba(57,255,20,0.75)",
                                "rgba(57,255,20,0.95)",
                            ],
                            startPoints: [0.0, 0.25, 0.6, 0.95],
                            colorMapSize: 256,
                        }}
                    />
                )}
            </MapView>

            <View style={[styles.hud, { top: insets.top + 8 }]}>
                <Text style={styles.hudTitle}>SAIFEN · MOBILE</Text>
                <Text style={styles.hudLine}>
                    Heatmap: {heat?.source ?? "…"} · {heat?.count ?? 0} pts
                </Text>
                <Text style={styles.hudLine}>
                    GPS: {me ? `${me.lat.toFixed(4)} | ${me.lng.toFixed(4)}` : "…"}
                </Text>
                <Text style={[styles.hudLine, { color: zoneColor }]}>
                    Zona: {zone ? ZONE_LABEL[zone.level] : "…"} · alertas {monitor}
                </Text>
            </View>

            <PanicButton coords={me} />
        </View>
    );
}

const DARK_MAP_STYLE = [
    { elementType: "geometry", stylers: [{ color: "#0A0F0A" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#000000" }] },
    { elementType: "labels.text.fill",   stylers: [{ color: "#00FF9F" }] },
    { featureType: "road",   stylers: [{ color: "#0F1A0F" }] },
    { featureType: "water",  stylers: [{ color: "#000000" }] },
    { featureType: "poi",    stylers: [{ visibility: "off" }] },
    { featureType: "transit",stylers: [{ visibility: "off" }] },
];

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    hud: {
        position: "absolute",
        left: 16,
        right: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: colors.accentDim,
        backgroundColor: "rgba(0,0,0,0.7)",
    },
    hudTitle: {
        color: colors.crtGreen,
        fontFamily: "monospace",
        fontSize: 12,
        letterSpacing: 2,
        marginBottom: 4,
    },
    hudLine: {
        color: colors.textPrimary,
        fontFamily: "monospace",
        fontSize: 11,
    },
});
