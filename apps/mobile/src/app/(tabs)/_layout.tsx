import { Tabs } from "expo-router/js-tabs";
import { colors } from "@/components/theme";

/**
 * Deux onglets en phase 1 : Accueil et Profil. Les autres (Explorer, +, Messages) arrivent avec
 * leurs fonctionnalités, pas avant.
 *
 * Pas d'icônes : sans `tabBarIcon`, React Navigation affiche un glyphe de remplacement, et
 * aucune bibliothèque d'icônes n'est installée. L'icône est donc masquée et le libellé centré.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Sur Android le clavier remonterait sinon la barre d'onglets au-dessus des champs.
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelPosition: "beside-icon",
        tabBarIcon: () => null,
        tabBarIconStyle: { display: "none" },
        tabBarLabelStyle: { fontSize: 15, marginStart: 0, marginEnd: 0 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Accueil" }} />
      <Tabs.Screen name="profile" options={{ title: "Profil" }} />
    </Tabs>
  );
}
