import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { usernameSchema } from "@yakila/validation";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { StatusMessage } from "@/components/StatusMessage";
import { colors, spacing } from "@/components/theme";
import { usePublicProfile } from "@/features/profile/usePublicProfile";

/**
 * Profil public d'un utilisateur, par pseudo. N'affiche que ce qui est public : photo, nom, ville
 * et bio. Ni e-mail, ni position (même approximative) : rien de plus que ce que l'on veut montrer.
 */
export default function PublicProfileScreen() {
  const params = useLocalSearchParams<{ username?: string | string[] }>();
  const rawUsername = Array.isArray(params.username) ? params.username[0] : params.username;
  const parsedUsername = usernameSchema.safeParse(rawUsername ?? "");
  const { state, retry } = usePublicProfile(parsedUsername.success ? parsedUsername.data : null);

  // Arrivée par lien profond : aucune page précédente vers laquelle revenir.
  const canGoBack = router.canGoBack();

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen
        options={{ title: state.status === "ready" ? `@${state.profile.username}` : "Profil" }}
      />

      {state.status === "loading" && (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      )}

      {state.status === "not-found" && (
        <View style={styles.center}>
          <Text style={styles.name}>Profil introuvable</Text>
          <Text style={styles.muted}>Ce pseudo n&apos;existe pas ou n&apos;existe plus.</Text>
        </View>
      )}

      {state.status === "error" && (
        <View style={styles.center}>
          <StatusMessage kind="error">
            Impossible de charger ce profil. Vérifie ta connexion et réessaie.
          </StatusMessage>
          <Button title="Réessayer" onPress={retry} />
        </View>
      )}

      {state.status === "ready" && (
        <View style={styles.center}>
          <Avatar
            uri={state.profile.avatar_url}
            name={state.profile.display_name ?? state.profile.username}
          />
          <Text style={styles.name}>{state.profile.display_name ?? state.profile.username}</Text>
          <Text style={styles.muted}>@{state.profile.username}</Text>
          {state.profile.city !== null && <Text style={styles.city}>{state.profile.city}</Text>}
          {state.profile.bio !== null && <Text style={styles.bio}>{state.profile.bio}</Text>}
        </View>
      )}

      {!canGoBack && (
        <Button
          title="Retour à l'accueil"
          variant="secondary"
          onPress={() => router.replace("/")}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xl * 2 },
  center: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  name: { fontSize: 24, fontWeight: "700", color: colors.text, textAlign: "center" },
  muted: { fontSize: 16, color: colors.textMuted, textAlign: "center" },
  city: { fontSize: 16, color: colors.text, textAlign: "center" },
  bio: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
