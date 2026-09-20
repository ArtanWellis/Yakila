import { useRef, useState } from "react";
import { StyleSheet, Text, type TextInput } from "react-native";
import { router } from "expo-router";
import { signInSchema } from "@yakila/validation";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { StatusMessage } from "@/components/StatusMessage";
import { TextField } from "@/components/TextField";
import { colors, spacing } from "@/components/theme";
import { signInWithPassword } from "@/features/auth/actions";
import { describeSignInError } from "@/lib/auth-errors";
import { fieldErrorsFromIssues, type FieldErrors } from "@/lib/form";

const FIELDS = ["email", "password"] as const;

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<(typeof FIELDS)[number]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordInput = useRef<TextInput>(null);

  const submit = async () => {
    if (submitting) return;
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromIssues(parsed.error.issues, FIELDS));
      setFormError(null);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setSubmitting(true);
    try {
      // En cas de succès, SessionProvider reçoit SIGNED_IN et la navigation protégée envoie
      // l'utilisateur vers les onglets : aucune redirection à faire ici.
      const { error } = await signInWithPassword(parsed.data);
      if (error) setFormError(describeSignInError(error));
    } catch {
      setFormError(describeSignInError({ message: "" }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.title} accessibilityRole="header">
        Connexion
      </Text>
      <Text style={styles.subtitle}>Content de te revoir sur YaKiLa.</Text>

      <TextField
        label="Adresse e-mail"
        value={email}
        onChangeText={setEmail}
        error={fieldErrors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordInput.current?.focus()}
      />
      <TextField
        ref={passwordInput}
        label="Mot de passe"
        value={password}
        onChangeText={setPassword}
        error={fieldErrors.password}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />

      {formError !== null && <StatusMessage kind="error">{formError}</StatusMessage>}

      <Button title="Se connecter" onPress={() => void submit()} loading={submitting} />
      <Button
        title="Créer un compte"
        variant="secondary"
        onPress={() => router.replace("/sign-up")}
        disabled={submitting}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: "700", color: colors.text, marginTop: spacing.lg },
  subtitle: { fontSize: 16, color: colors.textMuted, marginBottom: spacing.sm },
});
