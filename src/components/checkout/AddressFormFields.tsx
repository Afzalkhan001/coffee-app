/**
 * Building blocks of the address form (R3: a form is a white sheet of rows, not a stack of boxed
 * inputs). Each field is a 68px row: the label (13/500) over the value (16), hairlines between rows
 * inset to the text, no borders. While a field has focus its label turns ink and an ink line draws
 * across its hairline from the left; with an error the label and line turn danger and the message
 * sits under the value. Tapping anywhere on the row focuses its input.
 */
import { useState, type ReactNode, type RefObject } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Animated, { cubicBezier, FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { easeOutQuint } from '@/components/motion';
import { MAX_FONT_SCALE, Text, WEB_NO_FOCUS_RING } from '@/components/ui';
import { durations, fonts, makeStyles, radii, spacing, useColors, useTheme } from '@/theme';

const easeOut = cubicBezier(0.22, 1, 0.36, 1);
/** Horizontal padding of a form row inside its sheet: also where the hairlines start and end. */
export const FORM_ROW_PAD = spacing.md;
const CELL_GAP = spacing.sm;
const HAIRLINE = StyleSheet.hairlineWidth * 2;
const FOCUS_LINE = 1.5;
const errorIn = FadeIn.duration(durations.base).easing(easeOutQuint);
const errorOut = FadeOut.duration(durations.fast);

/** One white form sheet (r28, no border, no shadow). Rows draw the hairlines under themselves. */
export function FormSheet({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return <View style={[styles.sheet, style]}>{children}</View>;
}

/** The bits of a DOM node `revealOnWeb` touches (no DOM lib in this TS project). */
interface WebNode {
  parentElement: WebNode | null;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  getBoundingClientRect(): { top: number; height: number };
  /** DOM `scrollTo({ top, behavior })`, or react-native-web's own `scrollTo({ y, animated })` on a ScrollView node. */
  scrollTo?(options: { top: number; behavior: 'smooth'; y: number; animated: boolean }): void;
}

/**
 * Web only: centre the focused field in ITS scroll view, clear of the sticky bar. Only that scroll
 * view moves: `scrollIntoView` would also scroll every overflowing ancestor, the document included,
 * and a page that is a few px taller than the window (anything parked below the screen) then shifts
 * up and shows a white strip. Native screens get this from keyboard avoidance.
 */
function revealOnWeb(nativeEvent: unknown) {
  const input = (nativeEvent as { target?: WebNode } | null)?.target;
  const win = globalThis as unknown as { getComputedStyle?: (n: WebNode) => { overflowY: string } };
  if (!input || typeof input.getBoundingClientRect !== 'function' || typeof win.getComputedStyle !== 'function') return;
  // Called as a method: a detached `getComputedStyle` throws "Illegal invocation".
  const scrolls = (n: WebNode) => n.scrollHeight > n.clientHeight + 1 && /(auto|scroll)/.test(win.getComputedStyle!(n).overflowY);
  setTimeout(() => {
    let box = input.parentElement;
    while (box && !scrolls(box)) box = box.parentElement;
    if (!box || typeof box.scrollTo !== 'function') return;
    const field = input.getBoundingClientRect();
    const view = box.getBoundingClientRect();
    const top = Math.max(0, Math.round(box.scrollTop + (field.top - view.top) - (view.height * 0.4 - field.height / 2)));
    // react-native-web puts its own scrollTo({ x, y, animated }) on a ScrollView's node: give both shapes.
    box.scrollTo({ top, behavior: 'smooth', y: top, animated: true });
  }, 120);
}

export interface FieldRowProps extends Omit<TextInputProps, 'style' | 'ref'> {
  label: string;
  inputRef: RefObject<TextInput | null>;
  /** "Optional" on the right of the label. */
  optional?: boolean;
  error?: string;
  /** Show `error` under this row (default). A split row lists its cells' errors under itself. */
  showError?: boolean;
  /** Static text before the value ("+91"). */
  prefix?: string;
  /** Hairline under the row (every row but the last in its sheet). */
  separator?: boolean;
  /** Cell of a split row: tighter side padding on the side next to a neighbour. */
  cell?: 'first' | 'middle' | 'last';
  style?: StyleProp<ViewStyle>;
}

export function FieldRow({
  label,
  inputRef,
  optional = false,
  error,
  showError = true,
  prefix,
  separator = false,
  cell,
  onFocus,
  onBlur,
  style,
  ...input
}: FieldRowProps) {
  const { colors: c, keyboardAppearance } = useTheme();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  const reduced = useReducedMotion();
  const tone = error ? c.danger : focused ? c.ink : c.inkSoft;
  const inset = cell ? lineInset[cell] : lineInset.row;
  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      // The input is the accessible element; the row is only a bigger tap target (and no extra tab stop on web).
      accessible={false}
      focusable={false}
      style={[styles.row, cell ? cellPad[cell] : null, style]}
    >
      <View style={styles.labelRow}>
        <Animated.Text
          numberOfLines={1}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={[styles.label, { color: tone, transitionProperty: 'color', transitionDuration: 180, transitionTimingFunction: easeOut }]}
        >
          {label}
        </Animated.Text>
        {optional ? (
          <Text style={styles.optional} color={c.inkMuted} numberOfLines={1}>
            Optional
          </Text>
        ) : null}
      </View>
      <View style={styles.inputRow}>
        {prefix ? (
          <Text style={styles.prefix} color={c.ink}>
            {prefix}
          </Text>
        ) : null}
        <TextInput
          ref={inputRef}
          accessibilityLabel={label}
          placeholderTextColor={c.inkMuted}
          selectionColor={c.ember}
          keyboardAppearance={keyboardAppearance}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          {...input}
          aria-invalid={error ? true : undefined}
          onFocus={(e) => {
            setFocused(true);
            if (Platform.OS === 'web') revealOnWeb(e.nativeEvent);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, WEB_NO_FOCUS_RING]}
        />
      </View>
      {error && showError ? (
        <Animated.View entering={errorIn} exiting={errorOut} accessibilityLiveRegion="polite">
          <Text variant="caption" color={c.danger} style={styles.error}>
            {error}
          </Text>
        </Animated.View>
      ) : null}
      {separator ? <View style={[styles.hairline, inset]} /> : null}
      {/* The focus line draws over the hairline from the left (UI-thread CSS transition). */}
      <Animated.View
        style={[
          styles.focusLine,
          inset,
          {
            backgroundColor: error ? c.danger : c.ink,
            transform: [{ scaleX: focused ? 1 : 0 }],
            transitionProperty: 'transform',
            transitionDuration: reduced ? 0 : 260,
            transitionTimingFunction: easeOut,
          },
        ]}
      />
    </Pressable>
  );
}

/**
 * Two or three fields side by side ("PIN code | City | State") with vertical hairlines between
 * them. The first error among the cells shows under the whole row.
 */
export function SplitRow({ children, error, separator = false }: { children: ReactNode; error?: string; separator?: boolean }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View>
      <View style={styles.splitCells}>{children}</View>
      {error ? (
        <Animated.View entering={errorIn} exiting={errorOut} style={styles.splitError} accessibilityLiveRegion="polite">
          <Text variant="caption" color={c.danger}>
            {error}
          </Text>
        </Animated.View>
      ) : null}
      {separator ? <View style={[styles.hairline, lineInset.row]} /> : null}
    </View>
  );
}

/** The vertical hairline between the cells of a `SplitRow`. */
export function CellDivider() {
  const styles = useStyles();
  return <View style={styles.cellDivider} />;
}

/** A hairline under a custom row inside a `FormSheet` (e.g. a toggle row followed by more fields). */
export function RowSeparator() {
  const styles = useStyles();
  return <View style={[styles.hairline, lineInset.row]} />;
}

const cellPad = StyleSheet.create({
  first: { paddingLeft: FORM_ROW_PAD, paddingRight: CELL_GAP },
  middle: { paddingHorizontal: CELL_GAP },
  last: { paddingLeft: CELL_GAP, paddingRight: FORM_ROW_PAD },
});

/** Hairline / focus line insets: where the row's (or cell's) text starts and ends. */
const lineInset = StyleSheet.create({
  row: { left: FORM_ROW_PAD, right: FORM_ROW_PAD },
  first: { left: FORM_ROW_PAD, right: CELL_GAP },
  middle: { left: CELL_GAP, right: CELL_GAP },
  last: { left: CELL_GAP, right: FORM_ROW_PAD },
});

const useStyles = makeStyles((c) => ({
  // 4px top and bottom keep a last row's focus line clear of the rounded corners.
  sheet: { backgroundColor: c.surface, borderRadius: radii.lg, paddingVertical: 4 },
  row: { minHeight: 68, paddingHorizontal: FORM_ROW_PAD, paddingTop: 11, paddingBottom: 10, justifyContent: 'center' },
  hairline: { position: 'absolute', bottom: 0, height: HAIRLINE, backgroundColor: c.line },
  focusLine: { position: 'absolute', bottom: 0, height: FOCUS_LINE, transformOrigin: 'left', pointerEvents: 'none' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { flex: 1, minWidth: 0, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  optional: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  prefix: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22 },
  input: {
    flex: 1,
    // Web: an <input> flex item won't shrink below its intrinsic width without this.
    minWidth: 0,
    height: 26,
    paddingVertical: 0,
    paddingHorizontal: 0,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: c.ink,
    includeFontPadding: false,
  },
  error: { marginTop: 2 },
  splitCells: { flexDirection: 'row', alignItems: 'stretch' },
  splitError: { paddingHorizontal: FORM_ROW_PAD, marginTop: -4, paddingBottom: 10 },
  cellDivider: { width: HAIRLINE, marginVertical: 14, backgroundColor: c.line },
}));
