import { StyleSheet, Text } from "react-native";
import { colors } from "./theme";

interface StatusMessageProps {
  kind: "error" | "success";
  children: string;
}

/** Message de résultat d'une action, annoncé par les lecteurs d'écran. */
export function StatusMessage({ kind, children }: StatusMessageProps) {
  return (
    <Text
      role={kind === "error" ? "alert" : undefined}
      accessibilityLiveRegion="polite"
      style={[styles.text, kind === "error" ? styles.error : styles.success]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger },
  success: { color: colors.success },
});
