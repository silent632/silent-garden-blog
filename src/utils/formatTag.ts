// 辅助函数：删除所有 emoji
function removeEmoji(str: string): string {
  // 使用 Unicode 范围匹配 emoji
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1E0}-\u{1F1FF}]|🦁/gu, '');
}

// 清理标签：删除 emoji、删除 # 前缀、转小写、去除首尾空格
function cleanTag(tag: string): string {
  return removeEmoji(tag).replace(/^#+/, '').toLowerCase().trim();
}

// 核心转换逻辑：将标签转换为标签数组
function tagToArray(tag: string): string[] {
  // 1. ai/二级标签/ → ai
  if (tag.startsWith('ai/')) {
    return ['ai'];
  }

  // 2. 工作/二级标签/三级标签 → 工作
  if (tag.startsWith('工作/')) {
    return ['工作'];
  }

  // 3. 我的/review/三级标签 → review
  if (tag.startsWith('我的/review/')) {
    return ['review'];
  }

  // 4. 这世界/二级标签/三级标签 → 二级标签
  if (tag.startsWith('这世界/')) {
    const parts = tag.split('/');
    if (parts.length >= 2) {
      return [parts[1]];
    }
  }

  // 5. pkm/二级标签/三级标签 → pkm 和 二级标签
  if (tag.startsWith('pkm/')) {
    const parts = tag.split('/');
    if (parts.length >= 2) {
      return ['pkm', parts[1]];
    }
    return ['pkm'];
  }

  // 6. ref/二级标签 → 二级标签
  if (tag.startsWith('ref/')) {
    const parts = tag.split('/');
    if (parts.length >= 2) {
      return [parts[1]];
    }
  }

  // 处理 post/xxx 格式
  if (tag.startsWith('post/')) {
    return [tag.replace('post/', '')];
  }

  // 处理 观影/xxx 格式
  if (tag.startsWith('观影/')) {
    return ['观影'];
  }

  // 处理 我的/xxx 格式
  if (tag.startsWith('我的/')) {
    return [tag.replace('我的/', '')];
  }

  // 处理 area/xxx 格式
  if (tag.startsWith('area/')) {
    return [tag.replace('area/', '')];
  }

  // 处理 tool/xxx 格式
  if (tag.startsWith('tool/')) {
    return ['tool', tag.replace('tool/', '')];
  }

  // 对于其他格式，将斜杠替换为连字符
  return [tag.replace(/\//g, '-')];
}

// 保持原有的formatTag函数接口，返回单个标签
// 这个函数用于向后兼容，特别是在链接等需要单个标签的地方
export function formatTag(tag: string): string {
  if (!tag || typeof tag !== 'string') {
    return tag;
  }

  const cleaned = cleanTag(tag);
  const result = tagToArray(cleaned);

  // 返回第一个标签（对于会产生多个标签的情况如 tool/xxx, pkm/xxx，只返回第一个）
  return result[0] || cleaned;
}

// 新函数：转换标签，可能返回多个标签
export function transformTag(tag: string): string[] {
  if (!tag || typeof tag !== 'string') {
    return [tag];
  }

  return tagToArray(cleanTag(tag));
}

// 批量处理标签数组并去重
export function processTags(tags: string[]): string[] {
  if (!Array.isArray(tags) || !tags.length) return [];

  const formattedTags = tags.flatMap(tag => transformTag(tag));
  return [...new Set(formattedTags)];
}
