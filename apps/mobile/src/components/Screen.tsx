import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { colors, spacing } from "./theme";

interface ScreenProps {
  children: ReactNode;
  /**
   * Bords protégés par la zone sûre. Écrans de pile : haut et bas. Écrans d'onglets : haut seulement,
   * la barre d'onglets gère déjà le bas.
   */
  edges?: readonly Edge[];
}

/**
 * Conteneur d'écran défilant, prévu pour les formulaires : le clavier ne masque pas les champs
 * (KeyboardAvoidingView sur iOS, redimensionnement de la fenêtre sur Android) et un tap sur un
 * bouton fonctionne même clavier ouvert (`keyboardShouldPersistTaps`).
 */
export function Screen({ children, edges = ["top", "bottom"] }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={edges}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
});
