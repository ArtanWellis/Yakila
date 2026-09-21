import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "@/components/Button";
import { StatusMessage } from "@/components/StatusMessage";
import { spacing } from "@/components/theme";
import { asErrorLike, describeResendError, isRateLimited } from "@/lib/auth-errors";
import { TimeoutError } from "@/lib/timeout";
import { resendConfirmationEmail } from "./actions";
import { useCooldown } from "./useCooldown";

/** Délai minimal entre deux e-mails : c'est aussi la limite imposée par le serveur d'authentification. */
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Identique que l'adresse ait un compte à confirmer, un compte déjà confirmé ou aucun compte :
 * l'interface ne doit rien révéler sur l'existence d'un compte.
 */
const SUCCESS_MESSAGE =
  "Si cette adresse correspond à un compte à confirmer, un nouvel e-mail vient d'être envoyé. Pense à regarder tes courriers indésirables.";

interface ResendConfirmationEmailProps {
  /** Adresse déjà validée (`emailSchema`). */
  email: string;
  /** L'e-mail vient d'être envoyé (inscription) : le délai d'attente est déjà en cours. */
  startCoolingDown?: boolean;
}

type Message = { kind: "error" | "success"; text: string };

/** Bouton « Renvoyer l'e-mail » avec délai de 60 s entre deux envois, et son résultat. */
export function ResendConfirmationEmail({
  email,
  startCoolingDown = false,
}: ResendConfirmationEmailProps) {
  const cooldown = useCooldown(RESEND_COOLDOWN_SECONDS, startCoolingDown);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const resend = async () => {
    if (sending || cooldown.remaining > 0) return;
    setSending(true);
    setMessage(null);
    try {
      const { error } = await resendConfirmationEmail(email);
      if (error) {
        setMessage({ kind: "error", text: describeResendError(error) });
        if (isRateLimited(error)) cooldown.start();
        return;
      }
      setMessage({ kind: "success", text: SUCCESS_MESSAGE });
      cooldown.start();
    } catch (error) {
      setMessage({ kind: "error", text: describeResendError(asErrorLike(error)) });
      // Après un délai dépassé l'e-mail est peut-être parti : on laisse le temps de le recevoir.
      if (error instanceof TimeoutError) cooldown.start();
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      {message !== null && <StatusMessage kind={message.kind}>{message.text}</StatusMessage>}
      <Button
        title={
          cooldown.remaining > 0
            ? `Renvoyer l'e-mail (${cooldown.remaining} s)`
            : "Renvoyer l'e-mail"
        }
        variant="secondary"
        onPress={() => void resend()}
        loading={sending}
        disabled={cooldown.remaining > 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
});
