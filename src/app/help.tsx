import { useState } from 'react';
import { Linking, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FaqItem } from '@/components/account/FaqItem';
import { HeaderScrollEdge, useHeaderScroll } from '@/components/account/HeaderScrollEdge';
import { ListGroup } from '@/components/account/ListGroup';
import { enterFade, useToast } from '@/components/motion';
import { useLivePillSpace } from '@/components/order/livePillSpace';
import { Icon, PressableScale, Screen, ScreenHeader, Text } from '@/components/ui';
import { HELP_FAQ } from '@/data/mock/marketing';
import { hourLabel } from '@/lib/storeHours';
import { fonts, makeStyles, useColors } from '@/theme';
import { brand } from '@/theme/brand';

/** Help (DESIGN.md §R3.B "Help"): the FAQ accordion in one sheet, then two ways to reach the café. */
export default function HelpScreen() {
  const c = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  // Room for the live order pill floating over the end of the list (0 when it isn't here).
  const pillSpace = useLivePillSpace();
  const { scrollY, onScroll } = useHeaderScroll();
  const toast = useToast();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const open = (url: string, fallback: string) => {
    Linking.openURL(url).catch(() => toast(fallback));
  };

  const call = () => open(`tel:${brand.supportPhone.replace(/[^\d+]/g, '')}`, `Call us on ${brand.supportPhone}`);
  const email = () => open(`mailto:${brand.supportEmail}`, `Email us at ${brand.supportEmail}`);

  return (
    <Screen>
      <ScreenHeader title="Help" />
      <View style={styles.fill}>
        <Animated.ScrollView
          onScroll={onScroll}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 + pillSpace }]}
          showsVerticalScrollIndicator={false}
        >
          <ListGroup title="Questions" index={0}>
            {HELP_FAQ.map((item, i) => (
              <FaqItem
                key={item.q}
                question={item.q}
                answer={item.a}
                open={openIndex === i}
                onToggle={() => setOpenIndex((cur) => (cur === i ? null : i))}
              />
            ))}
          </ListGroup>

          <ListGroup
            title="Contact"
            index={1}
            style={styles.group}
            below={
              <Animated.View entering={enterFade(2)}>
                <Text style={styles.hours} color={c.inkMuted}>
                  {`Open ${hourLabel(brand.store.opensAtHour)}–${hourLabel(brand.store.closesAtHour)} every day.`}
                </Text>
              </Animated.View>
            }
          >
            <ContactRow title="Call the café" value={brand.supportPhone} onPress={call} />
            <ContactRow title="Email us" value={brand.supportEmail} onPress={email} />
          </ListGroup>
        </Animated.ScrollView>
        <HeaderScrollEdge scrollY={scrollY} />
      </View>
    </Screen>
  );
}

/** A 56px contact row: the action on the left, the full number / address as its value (never truncated to 45%). */
function ContactRow({ title, value, onPress }: { title: string; value: string; onPress: () => void }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <PressableScale onPress={onPress} activeScale={0.985} style={styles.row} accessibilityLabel={`${title}, ${value}`}>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.rowValue} color={c.inkSoft} numberOfLines={1}>
        {value}
      </Text>
      <Icon name="chevron-forward" size={18} color={c.inkMuted} />
    </PressableScale>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16 },
  rowTitle: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22, color: c.ink },
  rowValue: { flex: 1, minWidth: 0, textAlign: 'right', fontFamily: fonts.regular, fontSize: 15, lineHeight: 20 },
  fill: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8 },
  group: { marginTop: 28 },
  hours: { marginTop: 10, paddingHorizontal: 4, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
}));
