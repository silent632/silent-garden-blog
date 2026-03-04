import { type Book } from './getBookCover';

// 按日期倒序排列书籍
export const sortBooksByDate = (books: Book[]): Book[] => {
  return [...books].sort((a, b) => {
    try {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    } catch (error) {
      console.error('Date sorting error:', error);
      return 0;
    }
  });
};
