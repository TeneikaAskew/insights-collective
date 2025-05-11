
/**
 * Format message content to handle markdown-like syntax
 */
export const formatMessage = (content: string): string => {
  if (!content) return '';
  
  // Replace markdown-like syntax with HTML elements
  let formattedContent = content;
  
  // Process bold text: **text** -> <strong>text</strong>
  formattedContent = formattedContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Process italic text: _text_ -> <em>text</em>
  formattedContent = formattedContent.replace(/_(.*?)_/g, '<em>$1</em>');
  
  // Process inline code: `text` -> <code>text</code>
  formattedContent = formattedContent.replace(/`(.*?)`/g, '<code class="inline-code">$1</code>');
  
  // Process section headers: ## Title -> <h2>Title</h2>
  formattedContent = formattedContent.replace(/^## (.*?)$/gm, '<h2 class="text-lg font-bold mt-4 mb-2">$1</h2>');
  formattedContent = formattedContent.replace(/^### (.*?)$/gm, '<h3 class="text-md font-semibold mt-3 mb-1">$1</h3>');
  
  // Process bullet points: - item -> <li>item</li>
  formattedContent = formattedContent.replace(/^- (.*?)$/gm, '<li class="ml-6 list-disc">$1</li>');
  
  // Process numbered lists: 1. item -> <li>item</li> (but maintain the numbering)
  formattedContent = formattedContent.replace(/^(\d+)\. (.*?)$/gm, (match, number, content) => {
    return `<li class="ml-6 list-decimal" value="${number}">${content}</li>`;
  });
  
  // Add paragraph tags for regular text
  const paragraphs = formattedContent.split('\n\n');
  formattedContent = paragraphs.map(p => {
    if (
      !p.includes('<h2') && 
      !p.includes('<h3') && 
      !p.includes('<li') && 
      p.trim().length > 0
    ) {
      return `<p class="mb-3">${p}</p>`;
    }
    return p;
  }).join('');
  
  // Wrap consecutive <li> elements in <ul> or <ol>
  formattedContent = formattedContent.replace(/(<li class="ml-6 list-disc">.*?<\/li>)+/g, '<ul class="my-3">$&</ul>');
  formattedContent = formattedContent.replace(/(<li class="ml-6 list-decimal".*?<\/li>)+/g, '<ol class="my-3">$&</ol>');

   // Convert asterisks at beginning of lines to bullet points
  // This will replace any line that starts with "* " with "• "
  formattedContent = formattedContent.replace(/^(\s*)\* (.+)$/gm, '$1• $2');
  
  
  
  // Line breaks
  formattedContent = formattedContent.replace(/\n/g, '<br>');
  
  // Also handle cases where the asterisk appears after a <br> tag
  formattedContent = formattedContent.replace(/<br>\s*\* /g, '<br>• ');

  // First, handle case with text: "quoted content" format
  formattedContent = formattedContent.replace(/^\* ([\w\s]+):(.*?)$/gm, '• $1:$2');
  
  // Then handle standard asterisk bullet points
  formattedContent = formattedContent.replace(/^\* (.+)$/gm, '• $1');
  
  // Also handle cases where the asterisk appears after a line break
  formattedContent = formattedContent.replace(/\n\* /g, '\n• ');
  
  
  // Step 4: Fix any remaining asterisks after line breaks that weren't caught
  formattedContent = formattedContent.replace(/<br>\* /g, '<br>• ');
  
  return formattedContent;
};
