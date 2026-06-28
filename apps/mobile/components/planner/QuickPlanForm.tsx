import React, { useState } from "react";
import { Pressable, View } from "react-native";

import type { PlanRequest } from "@where2go/schemas";

import { Button, Field, Txt } from "@/components/ui";
import { spacing } from "@/constants/spacing";
import { useProductMode } from "@/context/ProductModeContext";
import { useColors } from "@/hooks/useColors";

type Props = {
  onGenerate: (request: Partial<PlanRequest>) => void;
  isLoading: boolean;
};

export function QuickPlanForm({ onGenerate, isLoading }: Props) {
  const c = useColors();
  const { mode } = useProductMode();
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState(
    mode === "solo_travel"
      ? "Safe solo outing near my hotel tonight"
      : "Family-friendly afternoon within 25 mins under $100",
  );
  const [budget, setBudget] = useState("100");
  const [driveTime, setDriveTime] = useState("30");

  const handleGenerate = () => {
    onGenerate({
      queryText: query,
      budgetMax: Number(budget) || 100,
      driveTimeMaxMinutes: Number(driveTime) || 30,
    });
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Field
        label="What do you want to do?"
        value={query}
        onChangeText={setQuery}
        multiline
        placeholder="Describe your outing…"
      />
      <Button title={isLoading ? "Planning…" : "Generate plan"} onPress={handleGenerate} loading={isLoading} disabled={isLoading} />
      <Pressable onPress={() => setExpanded(!expanded)}>
        <Txt size={13} color={c.primaryLight}>
          {expanded ? "Hide options ▲" : "More options ▼"}
        </Txt>
      </Pressable>
      {expanded && (
        <View style={{ gap: spacing.sm }}>
          <Field label="Budget max ($)" value={budget} onChangeText={setBudget} keyboardType="numeric" />
          <Field label="Max drive (minutes)" value={driveTime} onChangeText={setDriveTime} keyboardType="numeric" />
        </View>
      )}
    </View>
  );
}
