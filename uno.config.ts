import { defineConfig, presetMini, presetTypography, type Rule } from 'unocss'

import { integ } from './src/site.config.ts'

const typographyCustom = integ.typography || {}

const fg = 'hsl(var(--foreground) / var(--un-text-opacity, 1))'
const fgMuted = 'hsl(var(--muted-foreground) / var(--un-text-opacity, 1))'

const typographyConfig = {
  cssExtend: {
    html: {
      'font-family': '"Noto Serif SC", "Songti SC", "STSong", serif'
    },
    body: {
      color: fgMuted,
      'font-family': '"Noto Serif SC", "Songti SC", "STSong", serif'
    },

    'p, li, blockquote, dd': {
      'font-size': '1rem',
      'line-height': '1.85'
    },

    'h1,h2,h3,h4,h5,h6': {
      'scroll-margin-top': '3rem',
      'font-weight': '600',
      color: fg,
      'letter-spacing': '0.01em'
    },

    h1: {
      'font-size': '2rem',
      'line-height': '1.35'
    },

    h2: {
      'font-size': '1.55rem',
      'line-height': '1.45'
    },

    h3: {
      'font-size': '1.25rem',
      'line-height': '1.55'
    },

    'h1>a,h2>a,h3>a,h4>a,h5>a,h6>a': {
      'margin-inline-start': '0.75rem',
      color: fgMuted,
      transition: 'opacity 0.2s ease',
      opacity: '0'
    },

    'h1>a:focus,h2>a:focus,h3>a:focus,h4>a:focus,h5>a:focus,h6>a:focus': {
      opacity: 1
    },

    'h1:hover>a,h2:hover>a,h3:hover>a,h4:hover>a,h5:hover>a,h6:hover>a': {
      opacity: 1
    },

    'h1:target>a,h2:target>a,h3:target>a,h4:target>a,h5:target>a,h6:target>a': {
      opacity: 1
    },

    blockquote: {
      position: 'relative',
      'border-left': '3px solid hsl(var(--primary) / 0.55)',
      'border-radius': '0.75rem',
      'padding-inline': '1rem',
      'padding-block': '0.75rem',
      margin: '1.2rem 0',
      background: 'hsl(var(--muted) / 0.38)',
      'box-sizing': 'border-box',
      'text-align': 'left',
      ...(typographyCustom.blockquoteStyle === 'normal' ? { 'font-style': 'normal' } : {})
    },

    '.dark blockquote': {
      background: 'hsl(var(--muted) / 0.35)'
    },

    '.callout': {
      background: 'hsl(var(--muted) / 0.45)'
    },

    '.dark .callout': {
      background: 'hsl(var(--muted) / 0.4)'
    },

    table: {
      display: 'block',
      'font-size': '.92em'
    },

    'table tr': {
      'border-bottom-width': '1px'
    },

    'tbody tr:last-child': {
      'border-bottom-width': '0'
    },

    'thead th': {
      'font-weight': '600',
      color: fg
    },

    'td, th': {
      border: 'inherit',
      'text-align': 'start',
      padding: '0.6em'
    },

    'thead th:first-child,thead th:first-child,tbody td:first-child,tfoot td:first-child': {
      'padding-inline-start': '0'
    },

    'ol, ul': {
      'padding-left': '2.1em'
    },

    'ol>li, ul>li': {
      'padding-inline-start': '.3em'
    },

    'ul>li::marker': {
      color: fgMuted,
      '--un-text-opacity': '0.45'
    },

    li: {
      'margin-top': '.45em',
      'margin-bottom': '.45em'
    },

    ...(typographyCustom.inlineCodeBlockStyle === 'modern' && {
      ':not(pre)>code::before,:not(pre)>code::after': {
        content: 'none'
      },
      ':not(pre) > code': {
        padding: '0.28em 0.45em',
        color: 'hsl(var(--primary) / var(--un-text-opacity, 1))',
        border: '1px solid hsl(var(--border) / 1)',
        'border-radius': 'var(--radius)',
        'background-color': 'hsl(var(--muted) / var(--un-bg-opacity, 1))'
      }
    }),

    img: {
      'border-radius': 'var(--radius)',
      margin: '0 auto'
    },

    hr: {
      '--un-prose-hr': 'hsl(var(--border) / 1)'
    },

    kbd: {
      color: fg,
      'border-color': 'hsl(var(--border) / 1)',
      'box-shadow': '0 0 0 1px hsl(var(--primary-foreground) / 1), 0 3px hsl(var(--primary-foreground) / 1)'
    },

    strong: {
      'font-weight': '650',
      color: fg
    },

    a: {
      'font-weight': '500',
      color: 'hsl(var(--primary) / var(--un-text-opacity, 1))'
    },

    'code:not(pre code)': {
      'white-space': 'pre-wrap!important',
      'word-break': 'break-all!important'
    }
  }
}

const themeColors = {
  border: 'hsl(var(--border) / <alpha-value>)',
  input: 'hsl(var(--input) / <alpha-value>)',
  ring: 'hsl(var(--ring) / <alpha-value>)',
  background: 'hsl(var(--background) / <alpha-value>)',
  foreground: 'hsl(var(--foreground) / <alpha-value>)',
  primary: {
    DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
    foreground: 'hsl(var(--primary-foreground) / <alpha-value>)'
  },
  secondary: {
    DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
    foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)'
  },
  destructive: {
    DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
    foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)'
  },
  muted: {
    DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
    foreground: 'hsl(var(--muted-foreground) / <alpha-value>)'
  },
  accent: {
    DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
    foreground: 'hsl(var(--accent-foreground) / <alpha-value>)'
  },
  popover: {
    DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
    foreground: 'hsl(var(--popover-foreground) / <alpha-value>)'
  },
  card: {
    DEFAULT: 'hsl(var(--card) / <alpha-value>)',
    foreground: 'hsl(var(--card-foreground) / <alpha-value>)'
  }
}

const rules: Rule<object>[] = [
  [
    'sr-only',
    {
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: '0',
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0,0,0,0)',
      'white-space': 'nowrap',
      'border-width': '0'
    }
  ],
  [
    'object-cover',
    {
      'object-fit': 'cover'
    }
  ]
]

export default defineConfig({
  presets: [presetMini(), presetTypography(typographyConfig)],
  rules,
  theme: {
    colors: themeColors
  },
  safelist: ['rounded-t-2xl', 'rounded-b-2xl', 'text-xl', 'prose']
})
