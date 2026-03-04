export interface Book {
  title: string;
  score: number;
  date: string;
  comment: string;
  quote?: string;
  cover?: string;
  link?: string;
  recommend?: boolean;
}

export const getBookCover = (book: Book, _year: number): string => {
  try {
    // 如果有单独设置的封面，则优先使用
    if (book.cover && book.cover.trim() !== '') {
      return book.cover;
    }

    // 无封面时统一使用本地默认封面，避免出现空白图
    return '/cover/b1.png';
  } catch (error) {
    console.error('Error getting book cover:', error);
    // 返回默认封面
    return '/cover/b1.png';
  }
};
