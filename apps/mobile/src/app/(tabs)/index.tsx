import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { colors, spacing } from "@/components/theme";

/** Les trois entrées produit. Rien derrière pour l'instant : ce ne sont pas des boutons. */
const ENTRIES = [
  {
    title: "J'ai besoin de quelqu'un",
    description: "Trouve près de chez toi la personne qui peut t'aider.",
  },
  {
    title: "Je veux gagner de l'argent",
    description: "Propose tes services ou réponds à des missions proches de toi.",
  },
  {
    title: "Je veux acheter ou vendre",
    description: "Trouve ou vends des objets entre particuliers, autour de toi.",
  },
] as const;

export default function HomeScreen() {
  return (
    <Screen edges={["top"]}>
      <Text style={styles.title} accessibilityRole="header">
        YaKiLa
      </Text>
      <Text style={styles.subtitle}>
        Trouve quelqu&apos;un, propose tes services et gagne de l&apos;argent autour de toi.
      </Text>

      {ENTRIES.map((entry) => (
        <View key={entry.title} style={styles.card} accessible>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{entry.title}</Text>
            <Text style={styles.badge}>Bientôt</Text>
          </View>
          <Text style={styles.cardDescription}>{entry.description}</Text>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 32, fontWeight: "700", color: colors.text, marginTop: spacing.md },
  subtitle: { fontSize: 16, lineHeight: 24, color: colors.textMuted, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  cardTitle: { flexShrink: 1, fontSize: 18, fontWeight: "600", color: colors.text },
  badge: { fontSize: 12, fontWeight: "600", color: colors.primary },
  cardDescription: { fontSize: 15, lineHeight: 22, color: colors.textMuted },
});
