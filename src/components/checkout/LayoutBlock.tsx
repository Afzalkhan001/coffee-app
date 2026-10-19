import type { ReactNode } from 'react';
import { Platform, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { layoutSpring, type EntryAnimation, type ExitAnimation } from '@/components/motion';

/**
 * Layout transition for views NESTED inside another view that already animates its layout. On web
 * Reanimated measures absolute rects, so a nested view that re-renders in the same commit as its
 * moving parent would replay the parent's move on top of it (double travel). Native frames are
 * parent-relative, so nesting is fine there.
 */
export const nestedLayout = Platform.OS === 'web' ? undefined : layoutSpring;

export interface LayoutBlockProps {
  /**
   * Re-render trigger. Reanimated (web) only runs a layout transition for a component that
   * re-renders in the commit that moved it, and React Compiler memoizes blocks whose props didn't
   * change, so they used to snap while their neighbours glided (D-05). Pass a string that changes
   * whenever anything ABOVE this block can change height; every block re-measures and glides.
   */
  layoutKey: string;
  entering?: EntryAnimation;
  exiting?: ExitAnimation;
  onLayout?: (e: LayoutChangeEvent) => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/** A stacked screen block that springs to its new position when the blocks above it change size. */
export function LayoutBlock(props: LayoutBlockProps) {
  'use no memo'; // must re-create the Animated.View element whenever `layoutKey` changes
  const { entering, exiting, onLayout, style, children } = props;
  return (
    <Animated.View layout={layoutSpring} entering={entering} exiting={exiting} onLayout={onLayout} style={style}>
      {children}
    </Animated.View>
  );
}
