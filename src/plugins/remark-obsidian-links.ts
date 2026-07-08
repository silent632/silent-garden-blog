import type { Text } from 'mdast'
import { visit } from 'unist-util-visit'
import { buildInternalContentUrl } from '../utils/contentRouting.mjs'

/**
 * Remark插件：处理Obsidian链接格式 [[文件名|别名]] 和 ![[文件名]]
 * 转换为站内相对链接 [别名](/type/year/文件名)
 * 同时清理已存在的Markdown链接中的文件夹路径和绝对域名
 */
const remarkObsidianLinks = () => {
  return (tree: any) => {
    // 收集所有需要处理的文本节点
    const textNodes: Array<{node: Text; parent: any; index: number}> = []

    visit(tree, 'text', (node: Text, index: number | undefined, parent: any) => {
      if (index === undefined || !parent) return
      
      const text = node.value
      // 检查文本是否包含Obsidian链接格式
      if (/\[\[.*?\]\]/.test(text)) {
        textNodes.push({ node, parent, index })
      }
    })

    // 处理Obsidian链接格式 [[文件名|别名]] 和 ![[文件名]]
    textNodes.forEach(({ node, parent, index }) => {
      const text = node.value
      
      // 匹配所有Obsidian链接格式
      const obsidianLinkRegex = /(!?\[\[([^\|\]]+)(?:\|([^\]]+))?\]\])/g
      let match
      let lastIndex = 0
      const newNodes: any[] = []

      // 分割文本节点，处理每个Obsidian链接
      while ((match = obsidianLinkRegex.exec(text)) !== null) {
        // 添加链接前的普通文本
        if (match.index > lastIndex) {
          newNodes.push({
            type: 'text',
            value: text.slice(lastIndex, match.index)
          })
        }

        const fullMatch = match[1]
        const isImageLink = fullMatch.startsWith('!')
        const fileName = match[2]
        const alias = match[3] || cleanUpFileName(fileName)
        
        try {
          // 从文件名和路径中提取信息
          let type = 'notes'
          let year = String(new Date().getFullYear())
          
          // 确保清理文件名，去掉所有路径信息
          const cleanFileName = cleanUpFileName(fileName)
          
          // 提取年份
          year = extractYear(fileName)
          
          // 根据文件目录判断类型
          if (fileName.startsWith('blog/') || fileName.includes('/blog/')) {
            type = 'blog'
          } else if (fileName.startsWith('notes/') || fileName.includes('/notes/')) {
            type = 'notes'
          }
          
          // 构建目标URL
          const targetUrl = buildInternalContentUrl(type, year, cleanFileName)
          
          // 创建相应的节点
          if (isImageLink) {
            // 创建图片节点
            newNodes.push({
              type: 'image',
              url: targetUrl,
              alt: cleanFileName
            })
          } else {
            // 创建链接节点
            newNodes.push({
              type: 'link',
              url: targetUrl,
              children: [{
                type: 'text',
                value: alias
              }]
            })
          }
        } catch (error) {
          // 如果处理失败，保留原始文本
          newNodes.push({
            type: 'text',
            value: fullMatch
          })
        }

        lastIndex = match.index + match[0].length
      }

      // 添加最后剩余的文本
      if (lastIndex < text.length) {
        newNodes.push({
          type: 'text',
          value: text.slice(lastIndex)
        })
      }

      // 替换原始文本节点为新的节点数组
      parent.children.splice(index, 1, ...newNodes)
    })

    // 处理已存在的Markdown链接，清理文件夹路径
    visit(tree, 'link', (node: any) => {
      const parsedLink = parseInternalContentLink(node.url)
      if (parsedLink) {
        node.url = buildInternalContentUrl(
          parsedLink.type,
          parsedLink.year,
          cleanUpFileName(parsedLink.fileName)
        )
      }
    })
  }
}

function parseInternalContentLink(rawUrl: string): { type: string; year: string; fileName: string } | null {
  if (!rawUrl) return null

  try {
    const url = rawUrl.startsWith('/')
      ? new URL(`https://placeholder.local${rawUrl}`)
      : new URL(rawUrl)
    const parts = url.pathname.split('/').filter(Boolean)

    if (parts.length < 3) return null

    const [type, year, ...fileParts] = parts
    if (!['blog', 'notes', 'diary'].includes(type) || !/^\d{4}$/.test(year)) {
      return null
    }

    return {
      type,
      year,
      fileName: decodeURIComponent(fileParts.join('/'))
    }
  } catch {
    return null
  }
}

/**
 * 清理文件名，移除文件夹路径并确保不为空
 */
function cleanUpFileName(fileName: string): string {
  let cleanFileName = fileName;
  
  // 首先移除任何可能的前缀，特别是类似2.3-Notes%2F、3.1-Notes%2F这种情况
  if (cleanFileName.includes('%2F')) {
    const urlPathParts = cleanFileName.split('%2F');
    cleanFileName = urlPathParts[urlPathParts.length - 1];
  }
  
  // 移除Notes相关的前缀模式（如：2.3-Notes/、3.1-Notes/等）
  cleanFileName = cleanFileName.replace(/^\d+\.\d+-Notes\//gi, '');
  cleanFileName = cleanFileName.replace(/^\d+\.\d+-Notes%2F/gi, '');
  
  // 然后处理普通斜杠'/'情况
  if (cleanFileName.includes('/')) {
    const pathParts = cleanFileName.split('/');
    cleanFileName = pathParts[pathParts.length - 1];
  }
  
  // 特别处理可能的编码字符
  try {
    cleanFileName = decodeURIComponent(cleanFileName);
  } catch (e) {
    // 如果解码失败，保持原文件名
  }
  
  // 确保cleanFileName不为空
  if (!cleanFileName) {
    cleanFileName = 'untitled';
  }
  
  return cleanFileName;
}

/**
 * 从文件名或路径中提取年份，默认为当前年份
 */
function extractYear(fileName: string): string {
  const pathParts = fileName.split('/')
  if (pathParts.length > 0 && /^\d{4}$/.test(pathParts[0])) {
    return pathParts[0]
  }
  return String(new Date().getFullYear())
}

export default remarkObsidianLinks
