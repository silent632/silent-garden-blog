import type { CardListData, Config, IntegrationUserConfig, ThemeUserConfig } from 'astro-pure/types'

export const theme: ThemeUserConfig = {
  // === Basic configuration ===
  /** Title for your website. Will be used in metadata and as browser tab title. */
  title: 'Silent的花园',
  /** Will be used in index page & copyright declaration */
  author: '赛伦特',
  /** Description metadata for your website. Can be used in page metadata. */
  description: '长期主义',
  /** The default favicon for your site which should be a path to an image in the `public/` directory. */
  favicon: '/favicon/favicon.ico',
  /** Specify the default language for this site. */
  locale: {
    lang: 'zh-CN',
    attrs: 'zh_CN',
    dateLocale: 'zh-CN',
    dateOptions: {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }
  },
  /** Set a logo image to show in the homepage. */
  logo: {
    src: 'src/assets/avatar.png',
    alt: 'Avatar'
  },

  // === Global configuration ===
  titleDelimiter: '·',
  prerender: true,
  npmCDN: 'https://cdn.jsdelivr.net/npm',

  head: [],
  customCss: ['/styles/linkpreview.css'],

  /** Configure the header of your site. */
  header: {
    menu: [
      { title: 'Blog', link: '/blog' },
      { title: 'Diary', link: '/diary' },
      { title: 'Projects', link: '/projects' },
      { title: 'Books', link: '/books' },
      { title: 'Archives', link: '/archives' },
      { title: 'About', link: '/about' }
    ]
  },

  /** Configure the footer of your site. */
  footer: {
    year: `© 2026 - ${new Date().getFullYear()}`,

    links: [
      {
        title: 'Copyright',
        link: '/terms/copyright',
        style: 'text-sm'
      },
      {
        title: 'Terms',
        link: '/terms/list',
        pos: 2
      }
    ],

    /** Enable displaying a "Astro & Pure theme powered" link in your site's footer. */
    credits: true,
    /** Optional details about the social media accounts for this site. */
    social: { github: 'https://github.com/silent632' }
  },

  content: {
    externalLinksContent: '',
    /** Blog page size for pagination (optional) */
    blogPageSize: 10,
    externalLinkArrow: false,
    share: ['x', 'bluesky']
  }
}

export const integ: IntegrationUserConfig = {
  links: {
    logbook: [
      { date: '2026-02-23', content: 'Site launched' }
    ],

    applyTip: [
      { name: 'Name', val: 'Silent Garden' },
      { name: 'Description', val: 'Long-termism' },
      { name: 'Link', val: 'https://example.com' },
      { name: 'Icon', val: 'https://example.com/favicon/favicon.ico' }
    ]
  },

  pagefind: true,
  quote: {
    server: 'https://api.quotable.io/quotes/random?maxLength=60',
    target: `(data) => data[0].content || 'Error'`
  },

  typography: {
    class: 'prose text-base text-muted-foreground',
    blockquoteStyle: 'normal',
    inlineCodeBlockStyle: 'modern'
  },
  mediumZoom: {
    enable: true,
    selector: '.prose .zoomable',
    options: {
      className: 'zoomable'
    }
  },

  waline: {
    enable: false,
    server: 'https://comment.example.com/', // TODO: 域名确定后替换
    emoji: ['bmoji', 'weibo'],
    additionalConfigs: {
      search: true,
      pageview: true,
      comment: true,
      locale: {
        reaction0: 'Like',
        placeholder: '欢迎留言（填写邮箱可收到回复，无需登录）'
      },
      imageUploader: false
    }
  }
}

export const terms: CardListData = {
  title: 'Policy Documents',
  list: [
    {
      title: 'Privacy Policy',
      link: '/terms/privacy-policy'
    },
    {
      title: 'Terms & Conditions',
      link: '/terms/terms-and-conditions'
    },
    {
      title: 'Copyright Notice',
      link: '/terms/copyright'
    },
    {
      title: 'Disclaimer',
      link: '/terms/disclaimer'
    }
  ]
}

const config = { ...theme, integ } as Config
export default config
