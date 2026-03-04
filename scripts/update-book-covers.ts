/**
 * 更新书籍封面链接为统一的格式
 * 使用方法: npx tsx scripts/update-book-covers.ts [年份]
 * 示例: npx tsx scripts/update-book-covers.ts 2025
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

// 生成标准封面链接
function generateCoverUrl(title: string, year: number): string {
  const encodedTitle = encodeURIComponent(title);
  return `https://img.example.com/books/${year}/${encodedTitle}.jpg`;
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

// 更新 JSON 文件
function updateJsonFile(year: number) {
  const dataDir = path.join(__dirname, '..', 'src', 'data', 'books');
  const filePath = path.join(dataDir, `${year}.json`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ 文件不存在: ${filePath}`);
    return null;
  }
  
  const data: YearData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  let updateCount = 0;
  
  for (const book of data.books) {
    const newCover = generateCoverUrl(book.title, year);
    if (book.cover !== newCover) {
      console.log(`  ${book.title}:`);
      console.log(`    旧: ${book.cover}`);
      console.log(`    新: ${newCover}`);
      book.cover = newCover;
      updateCount++;
    }
  }
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`\n✅ 已更新 ${year}.json，共 ${updateCount} 本书\n`);
  
  return data.books;
}

// 从 Notion 获取书籍页面 ID
async function getNotionPages(): Promise<Map<string, string>> {
  const titleToId = new Map<string, string>();
  
  let hasMore = true;
  let nextCursor: string | undefined;
  
  while (hasMore) {
    const response = await notionApiCall(`/databases/${NOTION_DATABASE_ID}/query`, 'POST', {
      filter: {
        property: 'show',
        checkbox: {
          equals: true,
        },
      },
      page_size: 100,
      start_cursor: nextCursor,
    });
    
    for (const page of response.results) {
      const titleProperty = page.properties['title'];
      const title = titleProperty?.title?.map((t: any) => t.plain_text || '').join('') || '';
      if (title) {
        titleToId.set(title, page.id);
      }
    }
    
    hasMore = response.has_more;
    nextCursor = response.next_cursor;
    
    if (hasMore) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return titleToId;
}

// 更新 Notion 中的封面
async function updateNotionCovers(books: Book[], year: number) {
  console.log('正在从 Notion 获取页面映射...\n');
  const titleToId = await getNotionPages();
  
  let updateCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  
  for (const book of books) {
    const pageId = titleToId.get(book.title);
    if (!pageId) {
      console.log(`  ⚠️  未找到: ${book.title}`);
      skipCount++;
      continue;
    }
    
    const newCover = generateCoverUrl(book.title, year);
    
    try {
      // 更新页面属性
      await notionApiCall(`/pages/${pageId}`, 'PATCH', {
        properties: {
          'cover': {
            files: [
              {
                name: `${book.title}.jpg`,
                external: {
                  url: newCover,
                },
              },
            ],
          },
        },
      });
      
      console.log(`  ✅ 已更新: ${book.title}`);
      updateCount++;
      
      // 添加延迟避免 API 限制
      await new Promise(resolve => setTimeout(resolve, 350));
    } catch (error) {
      console.error(`  ❌ 更新失败: ${book.title}`, error);
      errorCount++;
    }
  }
  
  console.log(`\n✅ Notion 更新完成:`);
  console.log(`   成功: ${updateCount}`);
  console.log(`   跳过: ${skipCount}`);
  console.log(`   失败: ${errorCount}`);
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const year = args[0] ? parseInt(args[0], 10) : new Date().getFullYear();
  
  if (isNaN(year)) {
    console.log('使用方法:');
    console.log('  npx tsx scripts/update-book-covers.ts      # 使用当前年份');
    console.log('  npx tsx scripts/update-book-covers.ts 2025 # 指定年份');
    process.exit(1);
  }
  
  console.log(`\n📚 更新 ${year} 年书籍封面链接\n`);
  console.log('='.repeat(50));
  
  // 1. 更新 JSON 文件
  console.log('\n1. 更新 JSON 文件\n');
  const books = updateJsonFile(year);
  
  if (!books) {
    process.exit(1);
  }
  
  // 2. 更新 Notion
  console.log('\n2. 更新 Notion 数据库\n');
  await updateNotionCovers(books, year);
  
  console.log('\n' + '='.repeat(50));
  console.log('\n🎉 全部完成！\n');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
