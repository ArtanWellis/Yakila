import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { SEARCH_RADII_KM } from "@yakila/types";
import { formatDistanceKm } from "@yakila/utils";

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>YaKiLa</Text>
      <Text style={styles.subtitle}>
        Trouve quelqu&apos;un, propose tes services et gagne de l&apos;argent autour de toi.
      </Text>
      <Text style={styles.radii}>{SEARCH_RADII_KM.map(formatDistanceKm).join(" · ")}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  title: { fontSize: 32, fontWeight: "700" },
  subtitle: { fontSize: 16, textAlign: "center", color: "#52525b" },
  radii: { fontSize: 13, color: "#71717a" },
});
