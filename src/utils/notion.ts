import type { Book } from './getBookCover';

// 存储运行时环境变量
let runtimeNotionToken: string | undefined;
let runtimeDatabaseId: string | undefined;

// 设置运行时环境变量（由 Astro 页面调用）
export function setNotionEnv(token: string, databaseId: string) {
  runtimeNotionToken = token;
  runtimeDatabaseId = databaseId;
}

// 获取环境变量（兼容多种环境）
function getEnvVar(key: string): string | undefined {
  // 优先使用运行时设置的变量（Cloudflare 环境）
  if (key === 'NOTION_TOKEN' && runtimeNotionToken) {
    return runtimeNotionToken;
  }
  if (key === 'NOTION_DATABASE_ID' && runtimeDatabaseId) {
    return runtimeDatabaseId;
  }
  
  // 尝试从 import.meta.env 获取（Vite/Astro）
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const val = import.meta.env[key];
    if (val) return val;
  }
  // 尝试从 process.env 获取（Node.js）
  if (typeof process !== 'undefined' && process.env) {
    const val = process.env[key];
    if (val) return val;
  }
  return undefined;
}

const NOTION_TOKEN = () => getEnvVar('NOTION_TOKEN');
const DATABASE_ID = () => getEnvVar('NOTION_DATABASE_ID');
let loggedMissingNotionEnv = false;

function hasNotionEnv(): boolean {
  return Boolean(NOTION_TOKEN() && DATABASE_ID());
}

function logMissingNotionEnvOnce() {
  if (loggedMissingNotionEnv) return;
  console.warn('[Books] Notion 环境变量缺失，跳过 Notion API，使用本地 JSON 回退。');
  loggedMissingNotionEnv = true;
}

export interface YearData {
  year: number;
  books: Book[];
}

export interface BooksJson {
  currentYear: number;
  years: YearData[];
}

// 从 JSON 文件获取数据的函数
async function getBooksFromJson(year?: number): Promise<BooksJson | null> {
  try {
    // 客户端环境无法直接读取文件，返回 null 让代码回退到 API
    if (typeof window !== 'undefined') {
      return null;
    }
    
    // 服务器端：使用 fs 读取 JSON 文件
    const fs = await import('fs');
    const path = await import('path');
    
    // 使用项目根目录的绝对路径
    const projectRoot = process.cwd();
    const dataDir = path.join(projectRoot, 'src', 'data', 'books');
    
    const years: YearData[] = [];
    const currentYear = new Date().getFullYear();
    
    // 如果指定了年份，只读取该年份
    if (year) {
      const filePath = path.join(dataDir, `${year}.json`);
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const yearData: YearData = JSON.parse(fileContent);
        years.push(yearData);
        console.log(`[Books] 从 JSON 文件加载 ${year} 年数据`);
      } else {
        console.log(`[Books] ${year} 年 JSON 文件不存在: ${filePath}`);
        return null;
      }
    } else {
      // 读取索引文件，加载所有年份
      const indexPath = path.join(dataDir, 'index.json');
      if (!fs.existsSync(indexPath)) {
        console.log('[Books] JSON 索引文件不存在');
        return null;
      }
      
      const indexContent = fs.readFileSync(indexPath, 'utf-8');
      const indexData = JSON.parse(indexContent);
      
      // 读取每年的数据
      for (const yearInfo of indexData.years) {
        const yearNum = yearInfo.year;
        const filePath = path.join(dataDir, `${yearNum}.json`);
        
        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const yearData: YearData = JSON.parse(fileContent);
          years.push(yearData);
        }
      }
      
      console.log(`[Books] 从 JSON 文件加载 ${years.length} 个年份数据`);
    }
    
    return {
      currentYear,
      years,
    };
  } catch (error) {
    console.error('[Books] 读取 JSON 文件失败:', error);
    return null;
  }
}

// 直接调用 Notion REST API
async function notionApiCall(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
  const token = NOTION_TOKEN();
  if (!token) {
    throw new Error('NOTION_TOKEN is not defined');
  }

  const url = `https://api.notion.com/v1${endpoint}`;
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Notion API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

// Book 扩展类型，包含 year 属性
interface BookWithYear extends Book {
  year: number;
}

// 从 Notion 获取书籍数据（支持按年份筛选）
export async function getBooksFromNotionAPI(targetYear?: number): Promise<BooksJson> {
  const databaseId = DATABASE_ID();
  if (!databaseId) {
    throw new Error('NOTION_DATABASE_ID is not defined');
  }

  // 构建筛选条件
  const filter: any = {
    and: [
      {
        property: 'show',
        checkbox: {
          equals: true,
        },
      },
    ],
  };
  
  // 如果指定了年份，添加年份筛选（year formula 返回的是字符串）
  if (targetYear) {
    filter.and.push({
      property: 'year',
      formula: {
        string: {
          equals: targetYear.toString(),
        },
      },
    });
  }

  // 分页获取数据
  const allResults: any[] = [];
  let hasMore = true;
  let nextCursor: string | undefined;
  
  while (hasMore) {
    const response = await notionApiCall(`/databases/${databaseId}/query`, 'POST', {
      filter,
      sorts: [
        {
          property: 'end-date',
          direction: 'descending',
        },
      ],
      page_size: 100,
      start_cursor: nextCursor,
    });
    
    allResults.push(...response.results);
    hasMore = response.has_more;
    nextCursor = response.next_cursor;
  }
  
  console.log(`[Notion] 从 API 获取 ${allResults.length} 本书籍数据` + (targetYear ? ` (${targetYear}年)` : ''));

  const booksWithYear: BookWithYear[] = [];
  
  for (const page of allResults) {
    const book = parseNotionPage(page);
    if (book) {
      booksWithYear.push(book);
    }
  }

  // 按年份分组
  const yearMap = new Map<number, Book[]>();
  let currentYear = targetYear || new Date().getFullYear();
  
  for (const book of booksWithYear) {
    const year = book.year;
    
    if (!yearMap.has(year)) {
      yearMap.set(year, []);
    }
    const { year: _, ...bookData } = book;
    yearMap.get(year)!.push(bookData);
  }

  const years: YearData[] = [];
  for (const [year, yearBooks] of yearMap) {
    years.push({
      year,
      books: yearBooks,
    });
  }

  years.sort((a, b) => b.year - a.year);

  return {
    currentYear,
    years,
  };
}

// 主函数：历史年份从本地 JSON 读取，今年从 Notion API 获取
export async function getBooksFromNotion(): Promise<BooksJson> {
  const currentYear = new Date().getFullYear(); // 2026
  const historicalYears = [2023, 2024, 2025]; // 历史年份从本地 JSON 读取
  
  const allYears: YearData[] = [];
  
  // 1. 从历史年份 JSON 文件读取
  for (const year of historicalYears) {
    const yearData = await getBooksFromJson(year);
    if (yearData && yearData.years.length > 0) {
      allYears.push(...yearData.years);
    }
  }
  
  // 2. 从今年 (2026) Notion API 获取（无环境变量时直接回退本地 JSON）
  if (!hasNotionEnv()) {
    logMissingNotionEnvOnce();
    const fallbackData = await getBooksFromJson(currentYear);
    if (fallbackData && fallbackData.years.length > 0) {
      allYears.push(...fallbackData.years);
    }
  } else {
    try {
      console.log(`[Books] 从 Notion API 获取 ${currentYear} 年数据...`);
      const currentYearData = await getBooksFromNotionAPI(currentYear);
      if (currentYearData && currentYearData.years.length > 0) {
        allYears.push(...currentYearData.years);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[Books] Notion API 获取失败，回退本地 JSON：${message}`);
      // 尝试从本地 JSON 读取今年数据作为回退
      const fallbackData = await getBooksFromJson(currentYear);
      if (fallbackData && fallbackData.years.length > 0) {
        allYears.push(...fallbackData.years);
      }
    }
  }
  
  // 按年份倒序排列
  allYears.sort((a, b) => b.year - a.year);
  
  return {
    currentYear,
    years: allYears,
  };
}

// 解析 Notion 页面数据
function parseNotionPage(page: any): BookWithYear | null {
  try {
    const properties = page.properties;
    
    // 获取书名（title类型）
    const titleProperty = properties['title'];
    const title = extractTitle(titleProperty);
    if (!title) {
      console.warn('Book without title, skipping:', page.id);
      return null;
    }

    // 获取评分（formula 类型返回 number）
    const scoreProperty = properties['score'];
    const score = extractFormulaNumber(scoreProperty) || 0;

    // 获取阅读日期（date类型）
    const dateProperty = properties['end-date'];
    const date = extractDate(dateProperty);

    // 获取年份（formula 类型返回 number）
    const yearProperty = properties['year'];
    const year = extractFormulaNumber(yearProperty);
    if (!year) {
      console.warn('Book without year, skipping:', page.id);
      return null;
    }

    // 获取评论（rich_text类型）
    const commentProperty = properties['comment'] || properties['书评'];
    const comment = extractRichText(commentProperty) || '';

    // 获取引用（rich_text类型）
    const quoteProperty = properties['quote'];
    const quote = extractRichText(quoteProperty) || '';

    // 获取封面（files类型）
    const coverProperty = properties['cover'];
    const cover = extractFileUrl(coverProperty);

    // 获取文章链接（url类型）
    const linkProperty = properties['URL'];
    const link = extractUrl(linkProperty);

    // 获取推荐状态（checkbox类型）
    const starProperty = properties['star'];
    const recommend = extractCheckbox(starProperty);

    return {
      title,
      score,
      date,
      year,
      comment,
      quote,
      cover,
      link,
      recommend,
    };
  } catch (error) {
    console.error('Error parsing Notion page:', page.id, error);
    return null;
  }
}

// 提取标题
function extractTitle(property: any): string {
  if (!property) return '';
  
  if (property.type === 'title' && Array.isArray(property.title)) {
    return property.title.map((t: any) => t.plain_text || t.text?.content || '').join('');
  }
  
  return '';
}

// 提取 formula 类型的数字
function extractFormulaNumber(property: any): number {
  if (!property) return 0;
  
  if (property.type === 'formula') {
    if (property.formula?.type === 'number') {
      return property.formula.number || 0;
    }
    if (property.formula?.type === 'string') {
      const num = parseInt(property.formula.string, 10);
      return isNaN(num) ? 0 : num;
    }
  }
  
  return 0;
}

// 提取日期
function extractDate(property: any): string {
  if (!property) return '';
  
  if (property.type === 'date' && property.date?.start) {
    return property.date.start;
  }
  
  return '';
}

// 提取富文本
function extractRichText(property: any): string {
  if (!property) return '';
  
  if (property.type === 'rich_text' && Array.isArray(property.rich_text)) {
    return property.rich_text.map((t: any) => t.plain_text || t.text?.content || '').join('');
  }
  
  return '';
}

// 提取文件URL
function extractFileUrl(property: any): string {
  if (!property) return '';
  
  if (property.type === 'files' && Array.isArray(property.files) && property.files.length > 0) {
    const file = property.files[0];
    if (file.type === 'external') {
      return file.external?.url || '';
    } else if (file.type === 'file') {
      return file.file?.url || '';
    }
  }
  
  return '';
}

// 提取URL
function extractUrl(property: any): string {
  if (!property) return '';
  
  if (property.type === 'url' && property.url) {
    return property.url;
  }
  
  return '';
}

// 提取checkbox
function extractCheckbox(property: any): boolean {
  if (!property) return false;
  
  if (property.type === 'checkbox') {
    return property.checkbox === true;
  }
  
  return false;
}
