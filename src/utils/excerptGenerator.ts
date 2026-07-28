// ABOUTME: Utility functions for automatically generating excerpts from blog post content
// ABOUTME: Provides smart excerpt generation with sentence boundary detection and content cleaning

import { htmlToPlainText } from './htmlToPlainText';

/**
 * Generates an excerpt from HTML or markdown content
 * @param content - The full blog post content (HTML or markdown)
 * @param maxLength - Maximum length of the excerpt (default: 160 characters)
 * @param preferSentences - Whether to prefer complete sentences (default: true)
 * @returns Generated excerpt string
 */
export function generateExcerpt(
  content: string, 
  maxLength: number = 160, 
  preferSentences: boolean = true
): string {
  if (!content || typeof content !== 'string') {
    return '';
  }

  // Parse rather than regex-strip: htmlToPlainText uses DOMParser, which
  // handles nested/malformed tags correctly and decodes entities to their
  // characters instead of deleting them (the old regex turned "R&amp;D" into
  // "R D"). Whitespace normalisation happens inside the util.
  const cleanContent = htmlToPlainText(content);

  if (!cleanContent) {
    return '';
  }

  // If content is already short enough, return as is
  if (cleanContent.length <= maxLength) {
    return cleanContent;
  }

  if (preferSentences) {
    // Try to extract complete sentences
    const sentences = cleanContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let excerpt = '';
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      
      // Check if adding this sentence would exceed the limit
      const potentialExcerpt = excerpt 
        ? `${excerpt}. ${trimmedSentence}` 
        : trimmedSentence;
      
      if (potentialExcerpt.length <= maxLength) {
        excerpt = potentialExcerpt;
      } else {
        break;
      }
    }
    
    // If we got at least one complete sentence, use it
    if (excerpt && excerpt.length > 20) {
      return excerpt + (excerpt.endsWith('.') || excerpt.endsWith('!') || excerpt.endsWith('?') ? '' : '.');
    }
  }

  // Fallback: truncate at word boundary
  if (cleanContent.length > maxLength) {
    const truncated = cleanContent.substring(0, maxLength);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    
    if (lastSpaceIndex > maxLength * 0.7) { // Only use word boundary if it's not too far back
      return truncated.substring(0, lastSpaceIndex) + '...';
    } else {
      return truncated + '...';
    }
  }

  return cleanContent;
}

/**
 * Generates excerpts for multiple content blocks
 * @param contents - Array of content strings
 * @param maxLength - Maximum length per excerpt
 * @returns Array of generated excerpts
 */
export function generateMultipleExcerpts(contents: string[], maxLength: number = 160): string[] {
  return contents.map(content => generateExcerpt(content, maxLength));
}

/**
 * Generates an excerpt specifically optimized for SEO meta descriptions
 * @param content - The full blog post content
 * @param title - The blog post title (to avoid repetition)
 * @returns SEO-optimized excerpt
 */
export function generateSEOExcerpt(content: string, title: string = ''): string {
  const excerpt = generateExcerpt(content, 155, true); // Google recommends ~155 chars for meta descriptions
  
  // Avoid starting the excerpt with the title
  if (title && excerpt.toLowerCase().startsWith(title.toLowerCase())) {
    const withoutTitle = excerpt.substring(title.length).trim();
    if (withoutTitle.startsWith(':') || withoutTitle.startsWith('-')) {
      return withoutTitle.substring(1).trim();
    }
    return withoutTitle;
  }
  
  return excerpt;
}

/**
 * Tests the excerpt generation function with various inputs
 * @returns Test results
 */
export function testExcerptGeneration(): { passed: number; failed: number; results: any[] } {
  const tests = [
    {
      name: 'Simple text',
      input: 'This is a simple test. It should work correctly. This is another sentence.',
      expected: { length: 60, endsWithPeriod: true },
      maxLength: 60
    },
    {
      name: 'HTML content',
      input: '<p>This is <strong>HTML</strong> content.</p><p>It should be cleaned.</p>',
      expected: { length: 50, endsWithPeriod: true },
      maxLength: 50
    },
    {
      name: 'Long content without sentences',
      input: 'This is very long content without proper sentence endings and it should be truncated at word boundaries',
      expected: { length: 80, endsWith: '...' },
      maxLength: 80
    },
    {
      name: 'Empty content',
      input: '',
      expected: { result: '' },
      maxLength: 160
    },
    {
      name: 'HTML entities',
      input: 'This has &amp; HTML entities &lt;like this&gt; and should be cleaned.',
      expected: { length: 70, endsWithPeriod: true },
      maxLength: 70
    }
  ];

  const results = [];
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = generateExcerpt(test.input, test.maxLength);
      const success = test.expected.result 
        ? result === test.expected.result
        : result.length <= test.maxLength && 
          (test.expected.endsWithPeriod ? result.endsWith('.') : true) &&
          (test.expected.endsWith ? result.endsWith(test.expected.endsWith) : true);

      if (success) {
        passed++;
      } else {
        failed++;
      }

      results.push({
        name: test.name,
        input: test.input,
        output: result,
        expected: test.expected,
        passed: success
      });
    } catch (error) {
      failed++;
      results.push({
        name: test.name,
        input: test.input,
        output: null,
        error: error.message,
        passed: false
      });
    }
  }

  return { passed, failed, results };
}