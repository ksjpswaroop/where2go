import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export const font = {
  regular: "Outfit_400Regular",
  medium: "Outfit_500Medium",
  semibold: "Outfit_600SemiBold",
  bold: "Outfit_700Bold",
  extrabold: "Outfit_800ExtraBold",
} as const;

type Weight = keyof typeof font;

export function Txt({
  weight = "regular",
  size = 15,
  color,
  style,
  children,
  numberOfLines,
}: {
  weight?: Weight;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: React.ReactNode;
  numberOfLines?: number;
}) {
  const c = useColors();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        { fontFamily: font[weight], fontSize: size, color: color ?? c.foreground },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Screen({
  children,
  scroll = true,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: insets.top + 8,
    paddingBottom: insets.bottom + 28,
    paddingHorizontal: 18,
  };
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <LinearGradient
        colors={["rgba(14,165,233,0.10)", "rgba(11,17,32,0)"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 320 }}
      />
      {scroll ? (
        <ScrollView
          contentContainerStyle={[padding, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padding, contentStyle]}>{children}</View>
      )}
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: c.card,
          borderRadius: c.radius,
          borderWidth: 1,
          borderColor: c.border,
          padding: 18,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return (
    <Txt
      weight="semibold"
      size={13}
      color={c.mutedForeground}
      style={{ textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 }}
    >
      {children}
    </Txt>
  );
}

type ButtonVariant = "primary" | "danger" | "success" | "ghost" | "secondary";

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const bg =
    variant === "danger"
      ? c.destructive
      : variant === "success"
        ? c.success
        : variant === "secondary"
          ? c.secondary
          : variant === "ghost"
            ? "transparent"
            : c.primary;
  const fg = variant === "ghost" || variant === "secondary" ? c.foreground : "#FFFFFF";
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: c.radius,
          paddingVertical: 15,
          paddingHorizontal: 18,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 9,
          borderWidth: variant === "ghost" ? 1 : 0,
          borderColor: c.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={19} color={fg} /> : null}
          <Txt weight="semibold" size={16} color={fg}>
            {title}
          </Txt>
        </>
      )}
    </Pressable>
  );
}

export function IconCircle({
  icon,
  color,
  bg,
  size = 44,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={icon} size={size * 0.5} color={color} />
    </View>
  );
}

export function Field({
  label,
  style,
  ...rest
}: TextInputProps & { label?: string; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <View style={[{ gap: 7 }, style]}>
      {label ? (
        <Txt weight="medium" size={13} color={c.mutedForeground}>
          {label}
        </Txt>
      ) : null}
      <TextInput
        placeholderTextColor={c.mutedForeground}
        style={{
          backgroundColor: c.background,
          borderWidth: 1,
          borderColor: c.input,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 13,
          color: c.foreground,
          fontFamily: font.regular,
          fontSize: 16,
        }}
        {...rest}
      />
    </View>
  );
}

export function Badge({
  label,
  color,
  bg,
}: {
  label: string;
  color: string;
  bg: string;
}) {
  return (
    <View
      style={{
        backgroundColor: bg,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        alignSelf: "flex-start",
      }}
    >
      <Txt weight="semibold" size={12} color={color}>
        {label}
      </Txt>
    </View>
  );
}

export function Divider() {
  const c = useColors();
  return <View style={{ height: 1, backgroundColor: c.border, marginVertical: 14 }} />;
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}) {
  const c = useColors();
  return (
    <View style={{ alignItems: "center", paddingVertical: 32, gap: 10 }}>
      <IconCircle icon={icon} color={c.mutedForeground} bg={c.secondary} size={56} />
      <Txt weight="semibold" size={16}>
        {title}
      </Txt>
      {subtitle ? (
        <Txt size={14} color={c.mutedForeground} style={{ textAlign: "center" }}>
          {subtitle}
        </Txt>
      ) : null}
    </View>
  );
}
