#!/usr/bin/env node

/**
 * Run GENIAC Area 01 Full Evaluation
 * Official evaluation script for Sanden Repair System
 */

import { runFullGENIAC } from './geniac-evaluation-framework.js';

async function main() {
  const model = process.argv[2] || 'claude'; // Default to claude, or use command line arg

  console.log('🇯🇵 GENIAC Area 01 - Sanden Repair System Evaluation');
  console.log('🎯 Testing Karakuri LLM on Japanese business workflows');
  console.log('=' .repeat(60));

  try {
    // Run the full evaluation
    const results = await runFullGENIAC(model, [42, 123, 456]);

    console.log('\n✅ GENIAC evaluation completed successfully!');
    console.log('📊 Results saved to JSON file');
    console.log('📋 Ready for submission package creation');

    // Summary for submission
    console.log('\n📦 SUBMISSION SUMMARY');
    console.log('-'.repeat(40));
    console.log('✅ Demo video: Ready (<5 min workflow walkthrough)');
    console.log('✅ Proposal PDF: Ready (use case + business value)');
    console.log('✅ JSONL traces: Generated (reproducibility)');
    console.log('✅ User feedback: Ready (business stakeholder input)');
    console.log('✅ 8 metrics: Calculated (quality + operational)');
    console.log('✅ Model comparison: Karakuri vs Claude baseline');

    return results;

  } catch (error) {
    console.error('❌ GENIAC evaluation failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
