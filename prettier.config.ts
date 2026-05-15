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
  importOrderTypeImports: 'inline-first',
} satisfies Config;
