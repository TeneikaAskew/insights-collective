// ABOUTME: Test runner for the excerpt generation functionality
// ABOUTME: Provides automated testing to ensure excerpt generation works correctly

import { testExcerptGeneration } from './excerptGenerator';

export function runExcerptTests() {
  console.log('🧪 Running Excerpt Generation Tests...');
  
  const results = testExcerptGeneration();
  
  console.log(`✅ Tests Passed: ${results.passed}`);
  console.log(`❌ Tests Failed: ${results.failed}`);
  
  if (results.failed > 0) {
    console.log('\n📋 Failed Test Details:');
    results.results
      .filter(r => !r.passed)
      .forEach(result => {
        console.log(`- ${result.name}: ${result.error || 'Assertion failed'}`);
      });
  }
  
  console.log('\n📊 All Test Results:');
  results.results.forEach(result => {
    console.log(`${result.passed ? '✅' : '❌'} ${result.name}`);
    if (result.output !== null) {
      console.log(`   Output: "${result.output}"`);
    }
  });
  
  return results;
}

// Auto-run tests in development
if (import.meta.env.DEV) {
  runExcerptTests();
}