import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { StatusMessage } from "@/components/StatusMessage";
import { colors, spacing } from "@/components/theme";
import { signOutFromThisDevice } from "@/features/auth/actions";
import { AvatarSection } from "@/features/profile/AvatarSection";
import { LocationSection } from "@/features/profile/LocationSection";
import { ProfileForm } from "@/features/profile/ProfileForm";
import { useOwnProfile } from "@/features/profile/useOwnProfile";
import { useSignedInUser } from "@/session/SessionProvider";

export default function ProfileScreen() {
  const user = useSignedInUser();
  // Pendant une déconnexion cet écran peut se rendre une dernière fois sans utilisateur.
  if (user === null) return null;
  return <OwnProfile userId={user.userId} email={user.email} />;
}

function OwnProfile({ userId, email }: { userId: string; email: string | null }) {
  const { state, retry, refresh, patch } = useOwnProfile(userId);
  const [signingOut, setSigningOut] = useState(false);

  const handleAvatarChanged = useCallback(
    (avatarUrl: string) => patch({ avatar_url: avatarUrl }),
    [patch],
  );

  const signOut = async () => {
    setSigningOut(true);
    // Succès : SessionProvider passe à « déconnecté » et la navigation protégée renvoie vers la
    // connexion, cet écran disparaît. L'alerte n'apparaît que si l'appareil est resté connecté.
    if (!(await signOutFromThisDevice())) {
      setSigningOut(false);
      Alert.alert("Déconnexion impossible", "Vérifie ta connexion internet et réessaie.");
    }
  };

  if (state.status === "loading") {
    return (
      <Screen edges={["top"]}>
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      </Screen>
    );
  }

  if (state.status === "error") {
    return (
      <Screen edges={["top"]}>
        <Text style={styles.title} accessibilityRole="header">
          Profil
        </Text>
        <StatusMessage kind="error">
          Impossible de charger ton profil. Vérifie ta connexion et réessaie.
        </StatusMessage>
        <Button title="Réessayer" onPress={retry} />
        <Button
          title="Se déconnecter"
          variant="secondary"
          onPress={() => void signOut()}
          loading={signingOut}
        />
      </Screen>
    );
  }

  const { profile } = state;

  return (
    <Screen edges={["top"]}>
      <Text style={styles.title} accessibilityRole="header">
        Mon profil
      </Text>

      <AvatarSection userId={userId} profile={profile} onAvatarChanged={handleAvatarChanged} />
      {email !== null && <Text style={styles.email}>{email}</Text>}

      <ProfileForm userId={userId} initial={profile} onSaved={patch} />

      <View style={styles.separator} />
      <LocationSection
        hasLocation={profile.approx_lat !== null && profile.approx_lng !== null}
        onChanged={refresh}
      />

      <View style={styles.separator} />
      <Button
        title="Voir mon profil public"
        variant="secondary"
        onPress={() =>
          router.push({ pathname: "/u/[username]", params: { username: profile.username } })
        }
      />
      <Button
        title="Se déconnecter"
        variant="danger"
        onPress={() => void signOut()}
        loading={signingOut}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xl * 2 },
  title: { fontSize: 28, fontWeight: "700", color: colors.text, marginTop: spacing.md },
  email: { fontSize: 14, color: colors.textMuted, textAlign: "center" },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
});
