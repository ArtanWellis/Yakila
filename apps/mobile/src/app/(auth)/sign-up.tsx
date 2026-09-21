import { useRef, useState } from "react";
import { StyleSheet, Text, type TextInput } from "react-native";
import { router } from "expo-router";
import { signUpSchema } from "@yakila/validation";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { StatusMessage } from "@/components/StatusMessage";
import { TextField } from "@/components/TextField";
import { colors, spacing } from "@/components/theme";
import { checkUsernameAvailable, signUpWithUsername } from "@/features/auth/actions";
import { asErrorLike, describeSignUpError } from "@/lib/auth-errors";
import { fieldErrorsFromIssues, type FieldErrors } from "@/lib/form";

const FIELDS = ["username", "email", "password"] as const;

export default function SignUpScreen() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<(typeof FIELDS)[number]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const emailInput = useRef<TextInput>(null);
  const passwordInput = useRef<TextInput>(null);

  const submit = async () => {
    if (submitting) return;
    const parsed = signUpSchema.safeParse({ username, email, password });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromIssues(parsed.error.issues, FIELDS));
      setFormError(null);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setSubmitting(true);
    try {
      // Confort : évite un aller-retour inutile quand le pseudo est visiblement pris. Si la
      // vérification échoue (null), on laisse la base trancher.
      if ((await checkUsernameAvailable(parsed.data.username)) === false) {
        setFieldErrors({ username: "Ce pseudo est déjà pris." });
        return;
      }

      const { data, error } = await signUpWithUsername(parsed.data);
      if (error) {
        const { message, field } = describeSignUpError(error);
        if (field === "username") setFieldErrors({ username: message });
        else setFormError(message);
        return;
      }

      // Deux cas : session immédiate (SessionProvider s'en charge, la navigation protégée fait le
      // reste), ou pas de session car la confirmation d'e-mail est active.
      if (data.session === null) {
        router.replace({ pathname: "/check-email", params: { email: parsed.data.email } });
      }
    } catch (error) {
      // Dont `TimeoutError` : le message précise que l'inscription a peut-être abouti.
      setFormError(describeSignUpError(asErrorLike(error)).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.title} accessibilityRole="header">
        Créer un compte
      </Text>
      <Text style={styles.subtitle}>
        Un seul compte pour trouver quelqu&apos;un, proposer tes services et gagner de l&apos;argent
        autour de toi.
      </Text>

      <TextField
        label="Pseudo"
        hint="3 à 30 caractères : lettres minuscules, chiffres et _. Il ne pourra pas être modifié."
        value={username}
        onChangeText={setUsername}
        error={fieldErrors.username}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => emailInput.current?.focus()}
      />
      <TextField
        ref={emailInput}
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
        hint="8 caractères minimum."
        value={password}
        onChangeText={setPassword}
        error={fieldErrors.password}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />

      {formError !== null && <StatusMessage kind="error">{formError}</StatusMessage>}

      <Button title="Créer mon compte" onPress={() => void submit()} loading={submitting} />
      <Button
        title="J'ai déjà un compte"
        variant="secondary"
        onPress={() => router.replace("/sign-in")}
        disabled={submitting}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: "700", color: colors.text, marginTop: spacing.lg },
  subtitle: { fontSize: 16, color: colors.textMuted, marginBottom: spacing.sm },
});
