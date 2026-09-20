import { memo, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { colors } from "./theme";

interface AvatarProps {
  uri: string | null;
  /** Nom affiché : sert à l'initiale de remplacement et au libellé d'accessibilité. */
  name: string;
  size?: number;
}

/** Photo de profil, ou initiale sur fond neutre si absente ou impossible à charger. */
export const Avatar = memo(function Avatar({ uri, name, size = 96 }: AvatarProps) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const shape = { width: size, height: size, borderRadius: size / 2 };

  if (uri !== null && failedUri !== uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, shape]}
        accessibilityLabel={`Photo de profil de ${name}`}
        onError={() => setFailedUri(uri)}
      />
    );
  }

  return (
    <View
      style={[styles.placeholder, shape]}
      accessibilityLabel={`Pas de photo de profil pour ${name}`}
    >
      <Text style={[styles.initial, { fontSize: size / 2.5 }]}>
        {/* Array.from : `charAt(0)` couperait en deux un emoji (paire de substitution). */}
        {Array.from(name.trim())[0]?.toUpperCase() || "?"}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  image: { backgroundColor: colors.surface },
  placeholder: { backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  initial: { color: colors.textMuted, fontWeight: "600" },
});
