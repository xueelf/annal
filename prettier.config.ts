import { type Config } from 'prettier';

export default {
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  quoteProps: 'as-needed',
  arrowParens: 'avoid',
  endOfLine: 'lf',
  plugins: ['prettier-plugin-sort'],
  importOrderGroups: [
    'builtin',
    'external',
    'internal',
    'parent',
    'sibling',
    'index',
  ],
  importOrderTypeImports: 'inline-first',
} satisfies Config;
