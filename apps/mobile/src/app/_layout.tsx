import { useEffect } from "react";
import { SplashScreen, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SessionProvider, useAuth } from "@/session/SessionProvider";

// Garde l'écran de démarrage tant que la session n'a pas été lue dans le stockage sécurisé,
// pour ne pas afficher un instant l'écran de connexion à un utilisateur déjà connecté.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </SessionProvider>
  );
}

function RootNavigator() {
  const auth = useAuth();
  const signedIn = auth.status === "signed-in";

  useEffect(() => {
    if (auth.status !== "loading") SplashScreen.hide();
  }, [auth.status]);

  if (auth.status === "loading") return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Un groupe protégé sort de la navigation quand `guard` passe à false : l'utilisateur est
          redirigé vers le premier écran disponible. Déclarer (auth) en premier en fait la
          destination des utilisateurs déconnectés. */}
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      {/* Profil public : lisible sans compte, comme sur le web (les profils sont publics en base). */}
      <Stack.Screen name="u/[username]" options={{ headerShown: true, title: "Profil" }} />
    </Stack>
  );
}
