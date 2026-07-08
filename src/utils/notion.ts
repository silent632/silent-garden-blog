import type { Book } from './getBookCover'

export interface YearData {
  year: number
  books: Book[]
}

export interface BooksJson {
  currentYear: number
  years: YearData[]
}

async function getBooksFromJson(year?: number): Promise<BooksJson | null> {
  try {
    if (typeof window !== 'undefined') {
      return null
    }

    const fs = await import('fs')
    const path = await import('path')

    const projectRoot = process.cwd()
    const dataDir = path.join(projectRoot, 'src', 'data', 'books')

    const years: YearData[] = []
    const currentYear = new Date().getFullYear()

    if (year) {
      const filePath = path.join(dataDir, `${year}.json`)
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8')
        const yearData: YearData = JSON.parse(fileContent)
        years.push(yearData)
      } else {
        return null
      }
    } else {
      const indexPath = path.join(dataDir, 'index.json')
      if (!fs.existsSync(indexPath)) {
        return null
      }

      const indexContent = fs.readFileSync(indexPath, 'utf-8')
      const indexData = JSON.parse(indexContent)

      for (const yearInfo of indexData.years) {
        const yearNum = yearInfo.year
        const filePath = path.join(dataDir, `${yearNum}.json`)

        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath, 'utf-8')
          const yearData: YearData = JSON.parse(fileContent)
          years.push(yearData)
        }
      }
    }

    return { currentYear, years }
  } catch {
    return null
  }
}

export async function getBooksFromLocalJson(year?: number): Promise<BooksJson> {
  const data = await getBooksFromJson(year)
  if (data) return data

  return {
    currentYear: new Date().getFullYear(),
    years: []
  }
}
