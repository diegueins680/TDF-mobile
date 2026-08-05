import {
  forwardRef,
  useId,
  useState,
  type ReactNode,
} from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '../theme/ThemeProvider';

export interface FormFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  optional?: boolean;
  hint?: ReactNode;
  error?: string | null;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

const FormField = forwardRef<TextInput, FormFieldProps>(function FormField(
  {
    label,
    optional = false,
    hint,
    error,
    containerStyle,
    inputStyle,
    accessibilityLabel,
    accessibilityHint,
    accessibilityState,
    editable = true,
    onBlur,
    onFocus,
    placeholderTextColor,
    ...inputProps
  },
  ref,
) {
  const { colors } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const generatedId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const labelId = `field-label-${generatedId}`;
  const errorId = `field-error-${generatedId}`;
  const hintText = typeof hint === 'string' ? hint : undefined;

  return (
    <View style={[styles.container, containerStyle]}>
      <Text nativeID={labelId} style={[styles.label, { color: colors.textPrimary }]}>
        {label}
        {optional ? (
          <Text style={[styles.optional, { color: colors.textSecondary }]}> (opcional)</Text>
        ) : null}
      </Text>
      <TextInput
        {...inputProps}
        ref={ref}
        editable={editable}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityLabelledBy={labelId}
        accessibilityHint={accessibilityHint ?? error ?? hintText}
        accessibilityState={{ ...accessibilityState, disabled: !editable }}
        placeholderTextColor={placeholderTextColor ?? colors.textSecondary}
        selectionColor={colors.actionPrimary}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          {
            backgroundColor: colors.surfaceRaised,
            borderColor: error
              ? colors.danger
              : focused
                ? colors.actionPrimary
                : colors.border,
            color: colors.textPrimary,
          },
          !editable && styles.disabled,
          inputStyle,
        ]}
      />
      {error ? (
        <Text
          nativeID={errorId}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[styles.supportingText, { color: colors.danger }]}
        >
          {error}
        </Text>
      ) : hint ? (
        <Text style={[styles.supportingText, { color: colors.textSecondary }]}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: 7,
  },
  label: {
    fontWeight: '700',
  },
  optional: {
    fontSize: 12,
    fontWeight: '500',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  supportingText: {
    fontSize: 12,
    lineHeight: 18,
  },
  disabled: {
    opacity: 0.55,
  },
});

export default FormField;
