import { Stack } from "expo-router";

// Sans cela, la pile démarrerait sur le premier écran par ordre alphabétique (check-email).
export const unstable_settings = { anchor: "sign-in" };

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
