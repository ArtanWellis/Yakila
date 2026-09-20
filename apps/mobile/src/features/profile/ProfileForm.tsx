import { useRef, useState } from "react";
import { StyleSheet, View, type TextInput } from "react-native";
import { updateOwnProfile } from "@yakila/api";
import type { Profile } from "@yakila/types";
import { updateProfileSchema } from "@yakila/validation";
import { Button } from "@/components/Button";
import { StatusMessage } from "@/components/StatusMessage";
import { TextField } from "@/components/TextField";
import { spacing } from "@/components/theme";
import { fieldErrorsFromIssues, type FieldErrors } from "@/lib/form";
import { supabase } from "@/lib/supabase";

const FIELDS = ["displayName", "bio", "city"] as const;

interface ProfileFormProps {
  userId: string;
  /** Valeurs de départ. Le formulaire garde ensuite son propre état : un changement d'avatar ou de position ne le réinitialise pas. */
  initial: Pick<Profile, "display_name" | "bio" | "city">;
  onSaved: (profile: Profile) => void;
}

type Message = { kind: "error" | "success"; text: string };

export function ProfileForm({ userId, initial, onSaved }: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(initial.display_name ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [city, setCity] = useState(initial.city ?? "");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<(typeof FIELDS)[number]>>({});
  const [message, setMessage] = useState<Message | null>(null);
  const [saving, setSaving] = useState(false);
  const bioInput = useRef<TextInput>(null);

  const save = async () => {
    if (saving) return;
    const parsed = updateProfileSchema.safeParse({ displayName, bio, city });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromIssues(parsed.error.issues, FIELDS));
      setMessage(null);
      return;
    }

    setFieldErrors({});
    setMessage(null);
    setSaving(true);
    try {
      const { data, error } = await updateOwnProfile(supabase, userId, parsed.data);
      if (error || !data) {
        setMessage({
          kind: "error",
          text: "Impossible d'enregistrer. Vérifie ta connexion et réessaie.",
        });
        return;
      }
      // On réaffiche les valeurs telles qu'enregistrées (espaces retirés, champs vides devenus null).
      setDisplayName(data.display_name ?? "");
      setBio(data.bio ?? "");
      setCity(data.city ?? "");
      onSaved(data);
      setMessage({ kind: "success", text: "Profil enregistré." });
    } catch {
      setMessage({
        kind: "error",
        text: "Impossible d'enregistrer. Vérifie ta connexion et réessaie.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextField
        label="Nom affiché"
        value={displayName}
        onChangeText={setDisplayName}
        error={fieldErrors.displayName}
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        onSubmitEditing={() => bioInput.current?.focus()}
      />
      <TextField
        ref={bioInput}
        label="Bio"
        hint="Présente-toi en quelques mots."
        value={bio}
        onChangeText={setBio}
        error={fieldErrors.bio}
        multiline
      />
      <TextField
        label="Ville"
        value={city}
        onChangeText={setCity}
        error={fieldErrors.city}
        autoComplete="postal-address-locality"
        returnKeyType="done"
        onSubmitEditing={() => void save()}
      />
      {message !== null && <StatusMessage kind={message.kind}>{message.text}</StatusMessage>}
      <Button title="Enregistrer" onPress={() => void save()} loading={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
});
