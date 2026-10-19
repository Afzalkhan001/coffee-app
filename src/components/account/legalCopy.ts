/**
 * Placeholder legal copy for the prototype. Replace with the client's reviewed Terms of Service
 * and Privacy Policy before launch (PRD §18 "Terms and privacy").
 */
import { brand, SPEND_PER_POINT } from '@/theme/brand';

export type LegalDocId = 'terms' | 'privacy';

export interface LegalSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface LegalDoc {
  id: LegalDocId;
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

export const LEGAL_DOCS: Record<LegalDocId, LegalDoc> = {
  terms: {
    id: 'terms',
    title: 'Terms of service',
    updated: '1 October 2026',
    intro: `These terms explain how ordering with ${brand.fullName} works: placing orders, paying, picking up and earning rewards. By using the app you agree to them.`,
    sections: [
      {
        heading: 'Your account',
        paragraphs: [
          'You sign in with your mobile number and a one-time code. Keep your phone secure: anyone who can read your messages could sign in as you.',
          'Please give us a name we can call at the bar. You can change it any time from your profile.',
        ],
      },
      {
        heading: 'Placing an order',
        paragraphs: [
          'An order is confirmed once payment succeeds, or once you choose to pay at the counter. Prices are in Indian rupees (₹) and include any modifiers you select; GST (5%) is added at checkout.',
          'Prep times are estimates. We start making your order as soon as it is accepted, so changes after that point may not be possible.',
        ],
        bullets: [
          'You can cancel while an order is “Placed” or “Accepted”.',
          'Once preparation starts, please speak to the café about changes.',
          'Unclaimed pickup orders are held for 30 minutes.',
        ],
      },
      {
        heading: 'Payments and refunds',
        paragraphs: [
          'Card and wallet payments are processed by our payment partner; we never see or store your full card number.',
          'If something isn’t right with your order, tell us within 24 hours from Help & support and we’ll make it right with a remake, a credit or a refund to your original payment method.',
        ],
      },
      {
        heading: 'Rewards',
        paragraphs: [
          `You earn 1 point for every ${brand.currency.symbol}${SPEND_PER_POINT} spent on completed orders. Points have no cash value, can’t be transferred and may expire after 12 months without activity.`,
          'A redeemed reward is applied to your next order. If that order is cancelled, the points come back to your balance.',
        ],
      },
      {
        heading: 'Delivery',
        paragraphs: [
          `We deliver within ${brand.store.deliveryRadiusKm} km of the café. A delivery fee applies to smaller orders and is shown before you pay.`,
        ],
      },
      {
        heading: 'Contact',
        paragraphs: [`Questions about these terms? Email ${brand.supportEmail} or call ${brand.supportPhone}.`],
      },
    ],
  },
  privacy: {
    id: 'privacy',
    title: 'Privacy policy',
    updated: '1 October 2026',
    intro: `${brand.fullName} collects only what we need to make your order and run rewards. We don’t sell your personal information.`,
    sections: [
      {
        heading: 'What we collect',
        paragraphs: ['When you use the app we collect:'],
        bullets: [
          'Your phone number and name, to sign you in and call your order.',
          'Your orders, rewards and saved addresses, so you can reorder and track them.',
          'Your location, only if you allow it, to find the nearest café and check delivery.',
          'Basic device information, to keep the app secure and working well.',
        ],
      },
      {
        heading: 'How we use it',
        paragraphs: [
          'We use your information to prepare and deliver orders, send order updates you’ve opted into, run the rewards program and improve our menu and service.',
          'Promotional messages are sent only if you turn on Promotions in your notification preferences.',
        ],
      },
      {
        heading: 'Who we share it with',
        paragraphs: [
          'We share the minimum needed with partners who help us run the service: our payment processor, delivery couriers (name, address and order details only) and cloud hosting providers.',
        ],
      },
      {
        heading: 'Your choices',
        paragraphs: ['You’re in control of your data:'],
        bullets: [
          'Change notification preferences any time in Profile.',
          'Turn location access off in your device settings.',
          'Ask us for a copy of your data, or to delete your account.',
        ],
      },
      {
        heading: 'Keeping it safe',
        paragraphs: [
          'Data is encrypted in transit and at rest. We keep order records for as long as needed for accounting and to provide your history, then delete or anonymise them.',
        ],
      },
      {
        heading: 'Contact',
        paragraphs: [`Privacy questions or requests: ${brand.supportEmail}.`],
      },
    ],
  },
};

export function isLegalDocId(value: unknown): value is LegalDocId {
  return value === 'terms' || value === 'privacy';
}
