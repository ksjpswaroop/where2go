import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, View } from "react-native";

import {
  HotelScan,
  useCreateHotelScan,
  useListHotelScans,
} from "@where2go/safety-api-client";

import {
  Button,
  Card,
  EmptyState,
  Field,
  IconCircle,
  Screen,
  SectionTitle,
  Txt,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { formatScore, scoreBand, scoreBarWidth } from "@/lib/scannerScore";

function scoreColor(score: number, c: ReturnType<typeof useColors>) {
  return c[scoreBand(score)];
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const c = useColors();
  const col = scoreColor(value, c);
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Txt size={13} color={c.mutedForeground}>
          {label}
        </Txt>
        <Txt size={13} weight="semibold" color={col}>
          {formatScore(value)}
        </Txt>
      </View>
      <View
        style={{
          height: 8,
          borderRadius: 999,
          backgroundColor: c.secondary,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${scoreBarWidth(value)}%`,
            height: "100%",
            backgroundColor: col,
          }}
        />
      </View>
    </View>
  );
}

function ResultCard({ scan }: { scan: HotelScan }) {
  const c = useColors();
  const col = scoreColor(scan.overallScore, c);
  return (
    <Card style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            backgroundColor: c.secondary,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 2,
            borderColor: col,
          }}
        >
          <Txt weight="extrabold" size={22} color={col}>
            {scan.overallScore}
          </Txt>
        </View>
        <View style={{ flex: 1 }}>
          <Txt weight="bold" size={18}>
            {scan.hotelName || scan.query}
          </Txt>
          <Txt size={13} color={c.mutedForeground}>
            Overall safety score
          </Txt>
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <ScoreBar label="Neighborhood" value={scan.neighborhoodScore} />
        <ScoreBar label="Solo traveler friendliness" value={scan.soloFemaleScore} />
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: c.secondary,
          padding: 12,
          borderRadius: 12,
        }}
      >
        <Ionicons
          name={scan.deadboltMentioned ? "lock-closed" : "lock-open"}
          size={18}
          color={scan.deadboltMentioned ? c.success : c.warning}
        />
        <Txt size={13} color={c.mutedForeground} style={{ flex: 1 }}>
          {scan.deadboltMentioned
            ? "In-room deadbolt / secure locks reported"
            : "No mention of in-room deadbolts — ask the front desk"}
        </Txt>
      </View>

      <Txt size={14} style={{ lineHeight: 21 }}>
        {scan.summary}
      </Txt>

      {scan.tips && scan.tips.length > 0 ? (
        <View style={{ gap: 8 }}>
          {scan.tips.map((tip, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 8 }}>
              <Ionicons name="shield-checkmark" size={16} color={c.primaryLight} />
              <Txt size={13} color={c.mutedForeground} style={{ flex: 1, lineHeight: 19 }}>
                {tip}
              </Txt>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

export default function ScannerScreen() {
  const c = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: history } = useListHotelScans();
  const createScan = useCreateHotelScan();

  const [query, setQuery] = useState("");
  const [result, setResult] = useState<HotelScan | null>(null);

  const handleScan = async () => {
    if (query.trim().length < 2) {
      Alert.alert("Add a hotel", "Enter a hotel name or address to scan.");
      return;
    }
    try {
      const scan = await createScan.mutateAsync({ data: { query: query.trim() } });
      setResult(scan);
      queryClient.invalidateQueries();
    } catch {
      Alert.alert(
        "Scan failed",
        "We couldn't analyze that hotel right now. Please try again.",
      );
    }
  };

  const recent = (history ?? []).filter((h) => h.id !== result?.id).slice(0, 5);

  return (
    <Screen>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <Txt weight="extrabold" size={24}>
          Hotel Safety Scanner
        </Txt>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <IconCircle icon="close" color={c.foreground} bg={c.card} size={38} />
        </Pressable>
      </View>
      <Txt size={14} color={c.mutedForeground} style={{ marginBottom: 20 }}>
        AI-powered safety check for any hotel, hostel or address.
      </Txt>

      <Card style={{ gap: 14, marginBottom: 22 }}>
        <Field
          label="Hotel name or address"
          value={query}
          onChangeText={setQuery}
          placeholder="e.g. Hotel Sol, Barcelona"
        />
        <Button
          title={createScan.isPending ? "Analyzing…" : "Scan for safety"}
          icon="sparkles"
          onPress={handleScan}
          loading={createScan.isPending}
        />
      </Card>

      {result ? (
        <View style={{ marginBottom: 22 }}>
          <SectionTitle>Result</SectionTitle>
          <ResultCard scan={result} />
        </View>
      ) : null}

      <SectionTitle>Recent scans</SectionTitle>
      {recent.length === 0 ? (
        <EmptyState
          icon="time-outline"
          title="No scans yet"
          subtitle="Your past hotel safety checks will appear here."
        />
      ) : (
        <View style={{ gap: 10 }}>
          {recent.map((h) => (
            <Pressable key={h.id} onPress={() => setResult(h)}>
              <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: c.secondary,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1.5,
                    borderColor: scoreColor(h.overallScore, c),
                  }}
                >
                  <Txt weight="bold" size={16} color={scoreColor(h.overallScore, c)}>
                    {h.overallScore}
                  </Txt>
                </View>
                <View style={{ flex: 1 }}>
                  <Txt weight="semibold" size={15} numberOfLines={1}>
                    {h.hotelName || h.query}
                  </Txt>
                  <Txt size={12} color={c.mutedForeground}>
                    {new Date(h.createdAt).toLocaleDateString()}
                  </Txt>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.mutedForeground} />
              </Card>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}
