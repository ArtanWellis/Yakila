import type { Ref } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors, MIN_TOUCH_SIZE, spacing } from "./theme";

interface TextFieldProps extends TextInputProps {
  label: string;
  /** Texte d'aide sous le champ, masqué quand une erreur est affichée. */
  hint?: string;
  error?: string;
  ref?: Ref<TextInput>;
}

export function TextField({
  label,
  hint,
  error,
  ref,
  style,
  multiline,
  ...inputProps
}: TextFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        style={[
          styles.input,
          multiline && styles.multiline,
          error !== undefined && styles.inputError,
          style,
        ]}
        {...inputProps}
      />
      {error !== undefined ? (
        <Text style={styles.error} role="alert">
          {error}
        </Text>
      ) : hint !== undefined ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { fontSize: 14, fontWeight: "600", color: colors.text },
  input: {
    minHeight: MIN_TOUCH_SIZE,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
  },
  multiline: { minHeight: 120, paddingTop: spacing.sm + 4, textAlignVertical: "top" },
  inputError: { borderColor: colors.danger, borderWidth: 1.5 },
  hint: { fontSize: 13, color: colors.textMuted },
  error: { fontSize: 13, color: colors.danger },
});
