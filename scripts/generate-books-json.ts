/**
 * 从 Notion 获取书籍数据并生成静态 JSON 文件
 * 使用方法: npx tsx scripts/generate-books-json.ts [年份]
 * 示例: npx tsx scripts/generate-books-json.ts 2023
 *       npx tsx scripts/generate-books-json.ts all
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 从 .dev.vars 读取环境变量
function loadEnvVars() {
  const envPath = path.join(__dirname, '..', '.dev.vars');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env: Record<string, string> = {};
  
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  });
  
  return env;
}

const { NOTION_TOKEN, NOTION_DATABASE_ID } = loadEnvVars();

// 书籍数据接口
interface Book {
  title: string;
  score: number;
  date: string;
  comment: string;
  quote?: string;
  cover?: string;
  link?: string;
  recommend?: boolean;
}

interface YearData {
  year: number;
  books: Book[];
}

// 调用 Notion API
async function notionApiCall(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
  const url = `https://api.notion.com/v1${endpoint}`;
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
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

// 解析书籍数据
function parseNotionPage(page: any): Book & { year: number } | null {
  try {
    const properties = page.properties;
    
    // 获取书名
    const titleProperty = properties['title'];
    const title = titleProperty?.title?.map((t: any) => t.plain_text || '').join('') || '';
    if (!title) return null;

    // 获取评分
    const scoreProperty = properties['score'];
    let score = 0;
    if (scoreProperty?.type === 'formula') {
      if (scoreProperty.formula?.type === 'number') {
        score = scoreProperty.formula.number || 0;
      } else if (scoreProperty.formula?.type === 'string') {
        score = parseFloat(scoreProperty.formula.string) || 0;
      }
    }

    // 获取阅读日期
    const dateProperty = properties['end-date'];
    const date = dateProperty?.date?.start || '';

    // 获取年份
    const yearProperty = properties['year'];
    let year: number | null = null;
    if (yearProperty?.type === 'formula') {
      if (yearProperty.formula?.type === 'number') {
        year = yearProperty.formula.number;
      } else if (yearProperty.formula?.type === 'string') {
        year = parseInt(yearProperty.formula.string, 10) || null;
      }
    }
    if (!year) return null;

    // 获取评论
    const commentProperty = properties['comment'] || properties['书评'];
    const comment = commentProperty?.rich_text?.map((t: any) => t.plain_text || '').join('') || '';

    // 获取引用
    const quoteProperty = properties['quote'];
    const quote = quoteProperty?.rich_text?.map((t: any) => t.plain_text || '').join('') || '';

    // 获取封面
    const coverProperty = properties['cover'];
    let cover = '';
    if (coverProperty?.type === 'files' && Array.isArray(coverProperty.files) && coverProperty.files.length > 0) {
      const file = coverProperty.files[0];
      if (file.type === 'external') {
        cover = file.external?.url || '';
      } else if (file.type === 'file') {
        cover = file.file?.url || '';
      }
    }

    // 获取文章链接
    const linkProperty = properties['URL'];
    const link = linkProperty?.url || '';

    // 获取推荐状态
    const starProperty = properties['star'];
    const recommend = starProperty?.checkbox === true;

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
    console.error('Error parsing page:', error);
    return null;
  }
}

// 从 Notion 获取所有书籍数据
async function getAllBooksFromNotion(): Promise<Map<number, Book[]>> {
  const yearMap = new Map<number, Book[]>();
  
  let hasMore = true;
  let nextCursor: string | undefined;
  let totalCount = 0;
  
  console.log('正在从 Notion 获取书籍数据...\n');
  
  while (hasMore) {
    const response = await notionApiCall(`/databases/${NOTION_DATABASE_ID}/query`, 'POST', {
      filter: {
        property: 'show',
        checkbox: {
          equals: true,
        },
      },
      sorts: [
        {
          property: 'end-date',
          direction: 'descending',
        },
      ],
      page_size: 100,
      start_cursor: nextCursor,
    });
    
    for (const page of response.results) {
      const book = parseNotionPage(page);
      if (book) {
        const { year, ...bookData } = book;
        if (!yearMap.has(year)) {
          yearMap.set(year, []);
        }
        yearMap.get(year)!.push(bookData);
        totalCount++;
      }
    }
    
    hasMore = response.has_more;
    nextCursor = response.next_cursor;
    
    if (hasMore) {
      console.log(`  已获取 ${totalCount} 本书...`);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  console.log(`\n总共获取 ${totalCount} 本书\n`);
  
  return yearMap;
}

// 生成 JSON 文件
async function generateJsonFiles(targetYear?: number) {
  const yearMap = await getAllBooksFromNotion();
  const dataDir = path.join(__dirname, '..', 'src', 'data', 'books');
  
  // 确保目录存在
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const years = Array.from(yearMap.keys()).sort((a, b) => b - a);
  
  console.log(`年份列表: ${years.join(', ')}\n`);
  
  for (const year of years) {
    // 如果指定了年份，只生成该年份
    if (targetYear && year !== targetYear) {
      continue;
    }
    
    const books = yearMap.get(year)!;
    
    // 按日期倒序排序
    books.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
    
    const yearData: YearData = {
      year,
      books,
    };
    
    const filePath = path.join(dataDir, `${year}.json`);
    fs.writeFileSync(filePath, JSON.stringify(yearData, null, 2), 'utf-8');
    console.log(`✅ 生成 ${year}.json (${books.length} 本书)`);
  }
  
  // 生成索引文件
  const indexData = {
    years: years.map(year => ({
      year,
      count: yearMap.get(year)?.length || 0,
    })),
    updatedAt: new Date().toISOString(),
  };
  
  const indexPath = path.join(dataDir, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2), 'utf-8');
  console.log(`\n✅ 生成 index.json`);
  console.log(`\n更新时间: ${new Date().toLocaleString()}`);
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const targetYear = args[0] ? parseInt(args[0], 10) : undefined;
  
  if (args[0] && args[0] !== 'all' && isNaN(targetYear!)) {
    console.log('使用方法:');
    console.log('  npx tsx scripts/generate-books-json.ts      # 生成所有年份');
    console.log('  npx tsx scripts/generate-books-json.ts 2023 # 生成指定年份');
    console.log('  npx tsx scripts/generate-books-json.ts all  # 生成所有年份');
    process.exit(1);
  }
  
  await generateJsonFiles(targetYear);
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
