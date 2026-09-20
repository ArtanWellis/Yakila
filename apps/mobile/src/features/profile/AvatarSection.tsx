import { memo, useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Profile } from "@yakila/types";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { StatusMessage } from "@/components/StatusMessage";
import { colors, spacing } from "@/components/theme";
import { pickAndUploadAvatar } from "./avatar";

interface AvatarSectionProps {
  userId: string;
  profile: Pick<Profile, "username" | "display_name" | "avatar_url">;
  onAvatarChanged: (avatarUrl: string) => void;
}

type Message = { kind: "error" | "success"; text: string };

export const AvatarSection = memo(function AvatarSection({
  userId,
  profile,
  onAvatarChanged,
}: AvatarSectionProps) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const name = profile.display_name ?? profile.username;

  const changeAvatar = useCallback(async () => {
    setUploading(true);
    setMessage(null);
    const outcome = await pickAndUploadAvatar(userId);
    setUploading(false);
    if (outcome.status === "updated") {
      onAvatarChanged(outcome.avatarUrl);
      setMessage({ kind: "success", text: "Photo mise à jour." });
    } else if (outcome.status === "error") {
      setMessage({ kind: "error", text: outcome.message });
    }
  }, [userId, onAvatarChanged]);

  return (
    <View style={styles.container}>
      <Avatar uri={profile.avatar_url} name={name} />
      <Text style={styles.username}>@{profile.username}</Text>
      <Button
        title="Changer ma photo"
        variant="secondary"
        onPress={() => void changeAvatar()}
        loading={uploading}
      />
      {message !== null && <StatusMessage kind={message.kind}>{message.text}</StatusMessage>}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: spacing.sm },
  username: { fontSize: 16, color: colors.textMuted },
});
