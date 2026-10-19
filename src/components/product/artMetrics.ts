/**
 * Product-detail view of the cut-out metrics (`@/data/mock/photoMetrics`): where the subject's top
 * and right edges land in the hero art box once the art is seated on its contact line (food items
 * shift down onto their shadow, the cheesecake shows at 0.84). The steam rises from the cup's rim,
 * and the kcal badge hugs the subject instead of the empty corner of a wide, short item's box.
 */
import { placedSubjectRight, placedSubjectTop } from '@/data/mock/photoMetrics';

export { artPlacement, artPlacementTransform, ART_BASELINE } from '@/data/mock/photoMetrics';

/** Top of the subject in its art box (fraction), after placement. Unknown / remote images → ~0.25. */
export function subjectTop(image: string | null | undefined): number {
  return placedSubjectTop(image);
}

/** Right edge of the subject in its art box (fraction), after placement. */
export function subjectRight(image: string | null | undefined): number {
  return placedSubjectRight(image);
}
