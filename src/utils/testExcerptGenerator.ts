// ABOUTME: Test runner for the excerpt generation functionality
// ABOUTME: Provides automated testing to ensure excerpt generation works correctly

import { testExcerptGeneration } from './excerptGenerator';

import { createLogger } from '@/utils/logger';

const logger = createLogger('runExcerptTests');

export function runExcerptTests() {
  logger.log('🧪 Running Excerpt Generation Tests...');
  
  const results = testExcerptGeneration();
  
  logger.log(`✅ Tests Passed: ${results.passed}`);
  logger.log(`❌ Tests Failed: ${results.failed}`);
  
  if (results.failed > 0) {
    logger.log('\n📋 Failed Test Details:');
    results.results
      .filter(r => !r.passed)
      .forEach(result => {
        logger.log(`- ${result.name}: ${result.error || 'Assertion failed'}`);
      });
  }
  
  logger.log('\n📊 All Test Results:');
  results.results.forEach(result => {
    logger.log(`${result.passed ? '✅' : '❌'} ${result.name}`);
    if (result.output !== null) {
      logger.log(`   Output: "${result.output}"`);
    }
  });
  
  return results;
}

// Auto-run tests in development
if (import.meta.env.DEV) {
  runExcerptTests();
}