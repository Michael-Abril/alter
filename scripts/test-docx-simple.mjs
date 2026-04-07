/**
 * Simple test of .docx generation without DB dependency
 */

import { saveDocx } from '../src/lib/docx-generator.ts';
import { getOutputPath } from '../src/lib/output.ts';

console.log('🧪 Testing .docx Generation');
console.log('');

// Test 1: Academic deliverable
console.log('Test 1: Academic Deliverable (.docx)');
const academicPath = getOutputPath('Accounting Exam Study Materials', 'docx');
await saveDocx(academicPath, {
  title: 'Accounting Exam Study Materials',
  content: `# Chapter 3: Cost Behavior and Analysis

## Key Concepts

**Variable Costs** are costs that change in direct proportion to changes in activity level. Examples include:
- Direct materials
- Direct labor
- Sales commissions

**Fixed Costs** remain constant in total regardless of activity level within the relevant range. Examples include:
- Rent
- Insurance
- Depreciation

## Practice Problems

1. Calculate the contribution margin ratio
2. Determine break-even point in units
3. Analyze mixed costs using high-low method

## Study Tips

- Focus on understanding cost behavior patterns
- Practice CVP analysis problems
- Review real-world examples from class`,
  author: 'NightShift AI',
  subject: 'Academic Study Materials',
});

console.log(`✅ Saved to: ${academicPath}`);
console.log('');

// Test 2: Document build
console.log('Test 2: Document Build (.docx)');
const docPath = getOutputPath('Peru Trip Itinerary', 'docx');
await saveDocx(docPath, {
  title: 'Peru 13-Day Adventure Trip Itinerary',
  content: `# Peru Adventure Trip - Final Itinerary

## Day 1-3: Lima
- Arrival and city tour
- Visit Miraflores district
- Explore local cuisine

## Day 4-6: Cusco
- Acclimatization day
- Sacred Valley tour
- **Machu Picchu visit** (Day 6)

## Day 7-9: Amazon Rainforest
- Wildlife spotting
- Canopy walkway
- Night safari

## Day 10-13: Return to Lima
- Beach time
- Shopping for souvenirs
- Departure

## Budget Breakdown
- Flights: $800
- Accommodation: $600
- Activities: $400
- Food: $300
- **Total: $2,100**`,
  author: 'NightShift AI',
  subject: 'Travel Planning',
});

console.log(`✅ Saved to: ${docPath}`);
console.log('');

// Test 3: Spreadsheet project (with warning)
console.log('Test 3: Spreadsheet Project (.docx with warning)');
const spreadsheetPath = getOutputPath('ABC Costing Analysis', 'docx');
await saveDocx(spreadsheetPath, {
  title: 'ABC Costing Analysis',
  content: `# ⚠️ Spreadsheet Project Detected

**Note:** This project involves an Excel template or spreadsheet. NightShift generated the content below — paste it into your spreadsheet.

---

# Activity-Based Costing Analysis

## Cost Pools and Drivers

| Activity | Cost Pool | Cost Driver | Rate |
|----------|-----------|-------------|------|
| Machine Setup | $50,000 | Setup hours | $500/hour |
| Quality Control | $30,000 | Inspections | $150/inspection |
| Material Handling | $20,000 | Moves | $100/move |

## Product Cost Allocation

**Product A:**
- Setup: 20 hours × $500 = $10,000
- QC: 50 inspections × $150 = $7,500
- Handling: 30 moves × $100 = $3,000
- **Total: $20,500**

**Product B:**
- Setup: 30 hours × $500 = $15,000
- QC: 80 inspections × $150 = $12,000
- Handling: 50 moves × $100 = $5,000
- **Total: $32,000**`,
  author: 'NightShift AI',
  subject: 'Cost Accounting Analysis',
});

console.log(`✅ Saved to: ${spreadsheetPath}`);
console.log('');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ All tests complete!');
console.log('');
console.log('📁 Check your output directory:');
console.log('   C:\\Users\\royce\\Documents\\NightShift\\');
console.log('');
console.log('Open the .docx files in Word to verify formatting.');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
