import { Text as RNText, type StyleProp, type TextStyle } from 'react-native';
import { Text } from '@/components/ui';
import { fonts, makeStyles, useColors } from '@/theme';

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Lower-cased, de-duplicated search terms, longest first (so "latte" wins over "la"). */
export function searchTerms(query: string): string[] {
  const unique = new Set(query.trim().toLowerCase().split(/\s+/).filter(Boolean));
  return [...unique].sort((a, b) => b.length - a.length);
}

/** Splits `text` into alternating plain / matched parts (matches at odd indices). */
export function splitMatches(text: string, terms: string[]): string[] {
  if (terms.length === 0) return [text];
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi');
  return text.split(pattern);
}

export interface HighlightTextProps {
  text: string;
  terms: string[];
  style?: StyleProp<TextStyle>;
  color?: string;
  numberOfLines?: number;
}

/** Text with every occurrence of the search terms set on a soft peach highlight (`peachTint`: peachSoft in light). */
export function HighlightText({ text, terms, style, color: colorProp, numberOfLines }: HighlightTextProps) {
  const c = useColors();
  const styles = useStyles();
  const color = colorProp ?? c.ink;
  const parts = splitMatches(text, terms);
  return (
    <Text style={style} color={color} numberOfLines={numberOfLines}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <RNText key={i} style={styles.highlight}>
            {part}
          </RNText>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

const useStyles = makeStyles((c) => ({
  highlight: {
    fontFamily: fonts.semibold,
    color: c.ink,
    backgroundColor: c.peachTint,
  },
}));
