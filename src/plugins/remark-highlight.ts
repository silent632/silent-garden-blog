import type { Root } from 'mdast'
import { visit } from 'unist-util-visit'
import type { Plugin } from 'unified'

/**
 * 一个支持markdown中==高亮文本==语法的remark插件
 * 将==高亮文本==转换为带背景色F3D94D的<mark>元素
 */
const remarkHighlight: Plugin<[], Root> = () => {
  return (tree) => {
    // 正则表达式匹配==高亮文本==格式
    const highlightRegex = /==([^=]+)==/g
    
    // 遍历所有的text节点
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === undefined) return
      
      const text = node.value
      let match
      let lastIndex = 0
      const newNodes: any[] = []
      
      // 查找所有匹配的高亮文本
      while ((match = highlightRegex.exec(text)) !== null) {
        // 添加匹配前的普通文本
        if (match.index > lastIndex) {
          newNodes.push({
            type: 'text',
            value: text.slice(lastIndex, match.index)
          })
        }
        
        // 添加高亮文本作为mark元素
        const highlightNode = {
          type: 'element',
          data: {
            hName: 'mark',
            hProperties: {
              style: 'background-color: #F3D94D'
            }
          },
          children: [{
            type: 'text',
            value: match[1]
          }]
        }
        
        newNodes.push(highlightNode)
        lastIndex = match.index + match[0].length
      }
      
      // 如果有匹配项，替换原始节点
      if (newNodes.length > 0) {
        // 添加最后剩余的文本
        if (lastIndex < text.length) {
          newNodes.push({
            type: 'text',
            value: text.slice(lastIndex)
          })
        }
        
        // 替换原始节点
        parent.children.splice(index, 1, ...newNodes)
      }
    })
  }
}

export default remarkHighlight