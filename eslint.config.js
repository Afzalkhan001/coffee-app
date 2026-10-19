// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

/**
 * Theming (BUILD_CONTRACT → Theming, DESIGN.md §R4). Folders already on the runtime theme may not
 * import the static LIGHT palette: colours come from `useColors()` / `useTheme()` /
 * `makeStyles((c, t) => …)`. Add a folder (or a single converted screen file) to this list when
 * you convert it; `npm run theme:check` lists everything still on the static palette.
 */
const THEMED_FILES = [
  'src/theme/**/*.{ts,tsx}',
  'src/components/ui/**/*.{ts,tsx}',
  'src/components/domain/**/*.{ts,tsx}',
  'src/components/motion/**/*.{ts,tsx}',
  'src/components/navigation/**/*.{ts,tsx}',
  'src/components/order/**/*.{ts,tsx}',
  'src/components/invoice/**/*.{ts,tsx}',
  'src/app/_layout.tsx',
  'src/app/(tabs)/_layout.tsx',
  // Settings is the reference screen conversion (it hosts the Appearance selector).
  'src/app/settings.tsx',
  'src/components/account/{AppearanceRow,ConfirmSheet,HeaderScrollEdge,ListGroup,ModalSheet,NotificationPrefsCard,Toggle}.tsx',
  // R4 browse + account screens.
  'src/app/(tabs)/**/*.{ts,tsx}',
  'src/app/category/**/*.{ts,tsx}',
  'src/app/auth/**/*.{ts,tsx}',
  'src/app/{search,onboarding,help,legal}.tsx',
  'src/components/home/**/*.{ts,tsx}',
  'src/components/onboarding/**/*.{ts,tsx}',
  'src/components/account/**/*.{ts,tsx}',
  // R4 commerce screens (product → cart → checkout → payment → confirmation, tracking, invoice).
  'src/app/product/**/*.{ts,tsx}',
  'src/app/order/**/*.{ts,tsx}',
  'src/app/{cart,checkout,payment,mode,address,favorites}.tsx',
  'src/components/product/**/*.{ts,tsx}',
  'src/components/checkout/**/*.{ts,tsx}',
];

const STATIC_PALETTE_MESSAGE =
  'Static light palette: read colours at render time with useColors() / useTheme() or makeStyles((c, t) => …) (BUILD_CONTRACT → Theming).';

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", ".expo/*"],
  },
  {
    files: THEMED_FILES,
    ignores: ['**/__tests__/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: '@/theme', importNames: ['colors', 'heroTints', 'tileTints', 'shadows'], message: STATIC_PALETTE_MESSAGE },
            { name: '@/components/motion', importNames: ['boxShadows'], message: 'Use useTheme().boxShadows (scheme-aware).' },
            { name: '@/components/motion/color', importNames: ['boxShadows'], message: 'Use useTheme().boxShadows (scheme-aware).' },
          ],
        },
      ],
    },
  },
]);
