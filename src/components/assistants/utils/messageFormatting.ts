
/**
 * Format message content to handle markdown-like syntax
 */
export const formatMessage = (content: string): string => {
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
  
  // Process numbered lists: 1. item -> <li>item</li>
  formattedContent = formattedContent.replace(/^\d+\. (.*?)$/gm, '<li class="ml-6 list-decimal">$1</li>');
  
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
  formattedContent = formattedContent.replace(/(<li class="ml-6 list-decimal">.*?<\/li>)+/g, '<ol class="my-3">$&</ol>');
  
  return formattedContent;
};
