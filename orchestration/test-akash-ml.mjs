#!/usr/bin/env node
/**
 * Quick test script for Akash ML API
 * Run: node orchestration/test-akash-ml.mjs
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from parent directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { callAI, isAIAvailable, getPrimaryAISource, getAvailableAkashModels } from './lib/ai-client.mjs';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 Akash ML API Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // Check configuration
  console.log('📋 Configuration:');
  console.log(`   AI Available: ${isAIAvailable()}`);
  console.log(`   Primary Source: ${getPrimaryAISource()}`);
  console.log(`   AKASH_ML_API_KEY: ${process.env.AKASH_ML_API_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`   ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log('');

  console.log('📦 Available Akash ML Models:');
  const models = getAvailableAkashModels();
  for (const model of models) {
    console.log(`   - ${model.name} (${model.id})`);
    console.log(`     Cost: $${model.costPer1M.input}/${model.costPer1M.output} per M tokens (in/out)`);
  }
  console.log('');

  // Test API call
  console.log('🚀 Testing API call...');
  console.log('');

  try {
    const result = await callAI({
      system: 'You are a helpful assistant. Respond briefly.',
      user: 'Say "Hello from Akash ML!" and tell me what model you are.',
      maxTokens: 100,
      temperature: 0.7,
    });

    console.log('✅ API Call Successful!');
    console.log('');
    console.log(`   Source: ${result.source}`);
    console.log(`   Model: ${result.model}`);
    console.log(`   Tokens: ${result.tokensUsed} (in: ${result.usage?.input_tokens}, out: ${result.usage?.output_tokens})`);
    console.log('');
    console.log('   Response:');
    console.log('   ─────────');
    console.log(`   ${result.content}`);
    console.log('');

    // Estimate cost
    const inputCost = (result.usage?.input_tokens || 0) / 1e6 * 0.13;
    const outputCost = (result.usage?.output_tokens || 0) / 1e6 * 0.40;
    console.log(`   💰 Estimated cost: $${(inputCost + outputCost).toFixed(6)}`);
  } catch (e) {
    console.error('❌ API Call Failed:', e.message);
    process.exit(1);
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Test Complete');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(console.error);
