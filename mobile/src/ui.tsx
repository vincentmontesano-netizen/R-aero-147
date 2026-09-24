import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "./theme";
import type { ReactNode } from "react";

export function Screen({
  children,
  scroll = true,
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  return (
    <SafeAreaView
      edges={["top", "bottom", "left", "right"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.screen, style]}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.screen, { flex: 1 }, style]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Heading({
  children,
  small = false,
}: {
  children: ReactNode;
  small?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={{
        color: colors.text,
        fontSize: small ? 21 : 30,
        fontWeight: "700",
        letterSpacing: -0.6,
        lineHeight: small ? 28 : 37,
      }}
    >
      {children}
    </Text>
  );
}
export function Copy({
  children,
  muted = false,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Text
      style={{
        color: muted ? colors.muted : colors.text,
        fontSize: 16,
        lineHeight: 24,
      }}
    >
      {children}
    </Text>
  );
}
export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.line },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Action({
  title,
  onPress,
  secondary = false,
  busy = false,
  disabled = false,
  testID,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  busy?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const blocked = disabled || busy;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: blocked, busy }}
      disabled={blocked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: secondary ? "transparent" : colors.gold,
          borderColor: secondary ? colors.line : colors.gold,
          opacity: blocked ? 0.45 : pressed ? 0.7 : 1,
        },
      ]}
    >
      {busy && (
        <ActivityIndicator
          color={secondary ? colors.text : colors.buttonText}
        />
      )}
      <Text
        style={{
          fontSize: 16,
          fontWeight: "600",
          color: secondary ? colors.text : colors.buttonText,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.text, fontWeight: "600", fontSize: 15 }}>
        {label}
      </Text>
      <TextInput
        testID={`field-${label}`}
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.card,
            borderColor: colors.line,
          },
          props.style,
        ]}
      />
    </View>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{
        borderLeftWidth: 3,
        borderColor: colors.gold,
        padding: 14,
        backgroundColor: colors.card,
      }}
    >
      <Copy>{children}</Copy>
    </View>
  );
}
export function Loading({ message = "Chargement…" }: { message?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ padding: 32, alignItems: "center", gap: 16 }}>
      <ActivityIndicator color={colors.gold} />
      <Copy muted>{message}</Copy>
    </View>
  );
}
export function Brand() {
  return (
    <Image
      source={require("../assets/raero-logo.png")}
      accessibilityLabel="R-AERO"
      resizeMode="contain"
      style={{
        width: 210,
        height: 87,
        backgroundColor: "#f7f5ee",
        borderRadius: 6,
        alignSelf: "flex-start",
      }}
    />
  );
}
export function Meter({ value }: { value: number }) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      style={{
        height: 7,
        backgroundColor: colors.line,
        borderRadius: 5,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${clamped}%`,
          height: "100%",
          backgroundColor: colors.gold,
        }}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { padding: 22, paddingBottom: 36, gap: 20 },
  card: { borderWidth: 1, borderRadius: 16, padding: 20, gap: 14 },
  action: {
    minHeight: 50,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    flexDirection: "row",
    gap: 10,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 9,
    padding: 14,
    fontSize: 16,
  },
});
