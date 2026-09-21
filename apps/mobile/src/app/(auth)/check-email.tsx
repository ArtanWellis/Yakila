import { StyleSheet, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { emailSchema } from "@yakila/validation";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { colors, spacing } from "@/components/theme";
import { ResendConfirmationEmail } from "@/features/auth/ResendConfirmationEmail";

/** Affiché quand l'inscription n'a pas ouvert de session : la confirmation d'e-mail est active. */
export default function CheckEmailScreen() {
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  // Le paramètre peut venir d'un lien profond (yakila://check-email?email=…) : n'importe qui peut
  // l'écrire. On ne l'affiche que s'il s'agit bien d'une adresse e-mail, jamais comme texte libre.
  const parsedEmail = emailSchema.safeParse(
    Array.isArray(params.email) ? params.email[0] : params.email,
  );

  return (
    <Screen>
      <Text style={styles.title} accessibilityRole="header">
        Vérifie ta boîte mail
      </Text>
      <Text style={styles.body}>
        {parsedEmail.success
          ? `Nous t'avons envoyé un e-mail à ${parsedEmail.data}. `
          : "Nous t'avons envoyé un e-mail de confirmation. "}
        Ouvre le lien qu&apos;il contient pour confirmer ton adresse, puis reviens te connecter.
      </Text>
      <Text style={styles.hint}>
        Tu ne le vois pas ? Regarde dans tes courriers indésirables, ou demande un nouvel e-mail
        ci-dessous.
      </Text>
      {/* Sans adresse valide (lien profond sans paramètre) on ne sait pas à qui renvoyer. */}
      {parsedEmail.success && <ResendConfirmationEmail email={parsedEmail.data} startCoolingDown />}
      <Button title="Aller à la connexion" onPress={() => router.replace("/sign-in")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: "700", color: colors.text, marginTop: spacing.lg },
  body: { fontSize: 16, lineHeight: 24, color: colors.text },
  hint: { fontSize: 14, lineHeight: 20, color: colors.textMuted, marginBottom: spacing.sm },
});
