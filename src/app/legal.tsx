import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeIn, scrollTo, useAnimatedRef } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isLegalDocId, LEGAL_DOCS, type LegalDoc, type LegalDocId } from '@/components/account/legalCopy';
import { HeaderScrollEdge, useHeaderScroll } from '@/components/account/HeaderScrollEdge';
import { SegmentedControl, useSegmentProgress } from '@/components/account/SegmentedControl';
import { easeOutQuint, enterUp } from '@/components/motion';
import { useLivePillSpace } from '@/components/order/livePillSpace';
import { Screen, ScreenHeader, Text } from '@/components/ui';
import { fonts, makeStyles, spacing, useColors } from '@/theme';

const DOCS: readonly LegalDocId[] = ['terms', 'privacy'];
const docIn = FadeIn.duration(260).easing(easeOutQuint);

/** Terms of service / Privacy policy (param `doc=terms|privacy`), switchable in place. R3: sentence-case title, no callout box. */
export default function LegalScreen() {
  const styles = useStyles();
  const params = useLocalSearchParams<{ doc?: string }>();
  const docId: LegalDocId = isLegalDocId(params.doc) ? params.doc : 'terms';
  const doc = LEGAL_DOCS[docId];
  const index = DOCS.indexOf(docId);
  const progress = useSegmentProgress(index);
  const insets = useSafeAreaInsets();
  // Room for the live order pill floating over the end of the list (0 when it isn't here).
  const pillSpace = useLivePillSpace();
  const { scrollY, onScroll } = useHeaderScroll();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  const select = (i: number) => {
    const next = DOCS[i];
    if (!next || next === docId) return;
    router.setParams({ doc: next });
    scheduleOnUI(() => {
      'worklet';
      scrollTo(scrollRef, 0, 0, false);
    });
  };

  return (
    <Screen>
      <ScreenHeader title={docId === 'terms' ? 'Terms' : 'Privacy'} />
      <View style={styles.segmentWrap}>
        <SegmentedControl
          segments={[
            { key: 'terms', label: 'Terms' },
            { key: 'privacy', label: 'Privacy' },
          ]}
          progress={progress}
          selectedIndex={index}
          onSelect={select}
        />
      </View>
      <View style={styles.fill}>
        <Animated.ScrollView
          onScroll={onScroll}
          ref={scrollRef}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl + pillSpace }]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View key={docId} entering={docIn}>
            <LegalBody doc={doc} />
          </Animated.View>
        </Animated.ScrollView>
        <HeaderScrollEdge scrollY={scrollY} />
      </View>
    </Screen>
  );
}

function LegalBody({ doc }: { doc: LegalDoc }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View>
      <Text style={styles.title} accessibilityRole="header">
        {doc.title}
      </Text>
      <Animated.View entering={enterUp(0)}>
        <Text style={styles.meta} color={c.inkMuted}>
          {`Updated ${doc.updated} · Placeholder text`}
        </Text>
      </Animated.View>
      <Text style={styles.intro}>{doc.intro}</Text>

      {doc.sections.map((section, i) => (
        <Animated.View key={section.heading} entering={enterUp(i + 1)} style={styles.section}>
          <View style={styles.headingRow}>
            <Text style={styles.number} color={c.roastText}>
              {String(i + 1).padStart(2, '0')}
            </Text>
            <Text style={styles.heading} accessibilityRole="header">
              {section.heading}
            </Text>
          </View>
          {section.paragraphs.map((p) => (
            <Text key={p} style={styles.paragraph}>
              {p}
            </Text>
          ))}
          {section.bullets?.map((b) => (
            <View key={b} style={styles.bullet}>
              <View style={styles.dot} />
              <Text style={[styles.paragraph, styles.bulletText]}>{b}</Text>
            </View>
          ))}
        </Animated.View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  fill: { flex: 1 },
  segmentWrap: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.md },
  content: { paddingHorizontal: spacing.gutter, paddingTop: spacing.md },
  title: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 32, color: c.ink },
  meta: { marginTop: 4, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  intro: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 27, color: c.inkSoft, marginTop: spacing.sm, maxWidth: 620 },
  section: { marginTop: spacing.xl, maxWidth: 620 },
  headingRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginBottom: spacing.xs },
  number: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, letterSpacing: 1 },
  heading: { flex: 1, fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24, color: c.ink },
  paragraph: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 24, color: c.ink, marginTop: spacing.xs },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingLeft: spacing.xs },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.peach, marginTop: spacing.xs + 9 },
  bulletText: { flex: 1 },
}));
