import { memo, useState } from "react";
import { Alert, Linking, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { StatusMessage } from "@/components/StatusMessage";
import { colors, spacing } from "@/components/theme";
import { removeMyLocation, saveMyApproximateLocation, type SaveLocationOutcome } from "./location";

interface LocationSectionProps {
  /** Une position approximative est-elle enregistrée ? (`approx_lat` / `approx_lng` non nuls) */
  hasLocation: boolean;
  /** Appelé après un enregistrement ou une suppression réussis, pour relire le profil. */
  onChanged: () => Promise<void>;
}

type Message = { kind: "error" | "success"; text: string };
type Busy = "saving" | "clearing" | null;

/** Explication montrée juste avant la demande d'autorisation du système. */
function confirmLocationRationale(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      "Utiliser ta position ?",
      "YaKiLa enregistre ta position pour te proposer des services et des missions près de chez toi. Les autres utilisateurs ne voient jamais ta position exacte, seulement une zone d'environ 1 km. Tu peux la supprimer à tout moment.",
      [
        { text: "Annuler", style: "cancel", onPress: () => resolve(false) },
        { text: "Continuer", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

function messageFor(outcome: SaveLocationOutcome): Message | null {
  switch (outcome.status) {
    case "saved":
      return {
        kind: "success",
        text: "Position enregistrée. Les autres ne voient qu'une zone d'environ 1 km.",
      };
    case "denied":
      return {
        kind: "error",
        text: "Sans ton autorisation, YaKiLa ne peut pas connaître ta position. Tu peux réessayer quand tu veux.",
      };
    case "services-disabled":
      return {
        kind: "error",
        text: "La localisation de ton téléphone est désactivée. Active-la dans les réglages, puis réessaie.",
      };
    case "unavailable":
      return {
        kind: "error",
        text: "Position introuvable. Réessaie à l'extérieur ou avec une meilleure connexion.",
      };
    case "error":
      return { kind: "error", text: "Impossible d'enregistrer ta position. Réessaie plus tard." };
    case "cancelled":
    case "blocked":
      return null;
  }
}

function offerToOpenSettings() {
  Alert.alert(
    "Localisation désactivée",
    "L'accès à ta position est refusé pour YaKiLa. Tu peux l'autoriser dans les réglages de ton téléphone.",
    [
      { text: "Plus tard", style: "cancel" },
      { text: "Ouvrir les réglages", onPress: () => void Linking.openSettings() },
    ],
  );
}

export const LocationSection = memo(function LocationSection({
  hasLocation,
  onChanged,
}: LocationSectionProps) {
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<Message | null>(null);

  const shareLocation = async () => {
    setBusy("saving");
    setMessage(null);
    const outcome = await saveMyApproximateLocation(confirmLocationRationale);
    if (outcome.status === "saved") await onChanged();
    setBusy(null);
    if (outcome.status === "blocked") offerToOpenSettings();
    else setMessage(messageFor(outcome));
  };

  const deleteLocation = async () => {
    setBusy("clearing");
    setMessage(null);
    const removed = await removeMyLocation();
    if (removed) await onChanged();
    setBusy(null);
    setMessage(
      removed
        ? { kind: "success", text: "Position supprimée." }
        : { kind: "error", text: "Impossible de supprimer ta position. Réessaie plus tard." },
    );
  };

  const confirmDelete = () => {
    Alert.alert(
      "Supprimer ta position ?",
      "Elle ne sera plus utilisée pour te proposer des résultats proches de toi.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: () => void deleteLocation() },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        Ma position
      </Text>
      <Text style={styles.explanation}>
        Ta position exacte reste privée. Les autres utilisateurs voient uniquement une position
        approximative (environ 1 km), jamais l&apos;endroit précis où tu te trouves.
      </Text>
      <Text style={styles.status}>
        {hasLocation
          ? "Une position approximative est enregistrée."
          : "Aucune position enregistrée."}
      </Text>

      <Button
        title="Utiliser ma position"
        variant="secondary"
        onPress={() => void shareLocation()}
        loading={busy === "saving"}
        disabled={busy === "clearing"}
      />
      {hasLocation && (
        <Button
          title="Supprimer ma position"
          variant="danger"
          onPress={confirmDelete}
          loading={busy === "clearing"}
          disabled={busy === "saving"}
        />
      )}
      {message !== null && <StatusMessage kind={message.kind}>{message.text}</StatusMessage>}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  title: { fontSize: 18, fontWeight: "600", color: colors.text },
  explanation: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  status: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: spacing.xs },
});
