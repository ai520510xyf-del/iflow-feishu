/**
 * 卡片构建器
 */

class CardBuilder {
  buildMarkdownCard(text) {
    // 预处理 Markdown 内容，确保列表格式正确
    const processedText = this.preprocessMarkdown(text);
    return {
      config: { wide_screen_mode: true },
      elements: [{ tag: 'markdown', content: processedText }],
    };
  }

  buildReasoningCard(reasoning, content, thinkingTime = null, responseTime = null,
                    isThinking = false, isGenerating = false, modelName = null, contentLeftPercent = null) {
    const elements = [];
    
    // 思考模块
    if (reasoning && reasoning.trim()) {
      let thinkingStatus = '';
      if (isThinking) {
        const timeStr = thinkingTime !== null ? `(${(thinkingTime/1000).toFixed(1)}s)` : '';
        thinkingStatus = `💭 思考中 ${timeStr}`;
      } else if (thinkingTime !== null) {
        const timeStr = thinkingTime > 1000 ? `${(thinkingTime/1000).toFixed(1)}s` : `${thinkingTime}ms`;
        thinkingStatus = `💭 思考完成 (${timeStr})`;
      }
      
      let titleContent = '';
      if (modelName) titleContent += `<font color='blue'>${modelName}</font>`;
      // 始终显示剩余上下文，默认为100%
      // const displayPercent = contentLeftPercent !== null ? contentLeftPercent : 100;
      // titleContent += (titleContent ? '  |  ' : '') + `<font color='grey'>${displayPercent}% left</font>`;
      if (thinkingStatus) titleContent += (titleContent ? '  <font color=\'grey\'>|</font>  ' : '') + thinkingStatus;
      
      if (titleContent) {
        elements.push({
          tag: 'div',
          text: { content: titleContent, tag: 'lark_md', text_size: 'small' }
        });
      }
      
      // 预处理 reasoning 内容
      const processedReasoning = this.preprocessMarkdown(reasoning.trim());
      elements.push({ tag: 'markdown', content: processedReasoning });
      elements.push({ tag: 'hr' });
    }
    
    // 回复模块
    if (content !== null || responseTime !== null || isGenerating) {
      let responseTitle = '📝 回复';
      if (isGenerating && responseTime !== null) {
        const timeStr = responseTime > 1000 ? `${(responseTime/1000).toFixed(1)}s` : `${responseTime}ms`;
        responseTitle = `📝 Doing (${timeStr})`;
      } else if (!isGenerating && responseTime !== null) {
        const timeStr = responseTime > 1000 ? `${(responseTime/1000).toFixed(1)}s` : `${responseTime}ms`;
        responseTitle = `📝 Done (${timeStr})`;
      }
      
      let titleContent = '';
      if (modelName) titleContent += `<font color='blue'>${modelName}</font>`;
      // 始终显示剩余上下文，默认为100%
      // const displayPercent = contentLeftPercent !== null ? contentLeftPercent : 100;
      // titleContent += (titleContent ? '  |  ' : '') + `<font color='grey'>${displayPercent}% left</font>`;
      const statusColor = isGenerating ? 'orange' : 'green';
      titleContent += (titleContent ? '  <font color=\'grey\'>|</font>  ' : '') + `<font color='${statusColor}'>${responseTitle}</font>`;
      
      if (titleContent) {
        elements.push({
          tag: 'div',
          text: { content: titleContent, tag: 'lark_md', text_size: 'small' }
        });
      }
      
      if (content && content.trim()) {
        // 预处理内容，特别是列表格式
        const processedContent = this.preprocessMarkdown(content.trim());
        elements.push({ tag: 'markdown', content: processedContent });
      }
    }
    
    return {
      config: { wide_screen_mode: true },
      elements: elements.length > 0 ? elements : [{ tag: 'markdown', content: '(空响应)' }]
    };
  }
  
  /**
   * 预处理 Markdown 内容，移除不支持的元素
   */
  preprocessMarkdown(content) {
    if (!content || typeof content !== 'string') {
      return content;
    }
    
    // 只处理飞书不支持的 Markdown 元素
    let processed = content;
    
    // 移除或转换不支持的元素
    processed = processed
      .replace(/```([\s\S]*?)```/g, '[代码块]\n$1\n[代码块结束]')  // 代码块转换
      .replace(/`([^`]+)`/g, '【$1】')       // 行内代码用特殊括号标记
      .replace(/\*\*(.*?)\*\*/g, '【$1】')  // 粗体也用特殊括号标记
      .replace(/\*(.*?)\*/g, '_$1_')        // 斜体保持下划线
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')       // 移除图片，保留替代文本
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');       // 链接转为纯文本
    
    return processed;
  }
}

module.exports = { CardBuilder };