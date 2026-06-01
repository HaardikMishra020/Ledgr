import type { Config } from 'tailwindcss'
import {
  brand,
  colors,
  semantic,
  fontFamily,
  fontSize,
  spacing,
  borderRadius,
  boxShadow,
} from './tokens'

export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ...brand,
        ...colors,
        ...semantic,
      } as Record<string, string>,

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fontFamily: fontFamily as any,

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fontSize: fontSize as any,

      spacing: spacing as Record<string, string>,

      borderRadius: borderRadius as Record<string, string>,

      boxShadow: boxShadow as Record<string, string>,
    },
  },
  plugins: [],
} satisfies Config
