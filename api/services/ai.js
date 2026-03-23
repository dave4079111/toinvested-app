/**
 * AI Service - Server-side Claude API integration
 * Keeps API keys secure on the server, never exposed to browser
 */

const { logger } = require('../logger');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

/**
 * Call Claude API with a prompt and return parsed JSON
 * @param {string} prompt - The user prompt
 * @param {number} maxTokens - Max response tokens (default 2500)
 * @returns {object} Parsed JSON response from Claude
 */
async function callClaude(prompt, maxTokens = 2500) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    logger.error('Claude API error', { status: response.status, body: errText });
    throw new Error(`Claude API returned ${response.status}`);
  }

  const result = await response.json();
  const text = result.content[0].text.trim();

  // Parse JSON - handle possible markdown code fences
  let jsonStr = text;
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    logger.error('Failed to parse Claude response as JSON', { text: text.substring(0, 500) });
    throw new Error('AI returned invalid format');
  }
}

// ==========================================
// PROMPT BUILDERS
// ==========================================

function buildPropertyPrompt(data) {
  const fmt = (v) => Number(v).toLocaleString('en-US');

  let details = '';
  switch (data.strategy) {
    case 'buyhold':
      details = `
Strategy: Buy & Hold (long-term rental)
Purchase Price: $${fmt(data.purchase_price)}
Down Payment: ${data.down_payment_pct}%
Expected Monthly Rent: $${fmt(data.monthly_rent)}
Known Repairs Needed: $${fmt(data.repairs)}`;
      break;
    case 'flip':
      details = `
Strategy: Fix & Flip
Purchase Price: $${fmt(data.purchase_price)}
Renovation Budget: $${fmt(data.reno_budget)}
After Repair Value (ARV): $${fmt(data.arv)}
Expected Timeline: ${data.timeline} months`;
      break;
    case 'brrrr':
      details = `
Strategy: BRRRR (Buy, Rehab, Rent, Refinance, Repeat)
Purchase Price: $${fmt(data.purchase_price)}
Renovation Budget: $${fmt(data.reno_budget)}
ARV (After Repair Value): $${fmt(data.arv)}
Monthly Rent After Rehab: $${fmt(data.monthly_rent)}
Refinance LTV Target: ${data.refi_ltv}%`;
      break;
    case 'multiunit':
      details = `
Strategy: Multi-Unit / Multi-Family
Purchase Price: $${fmt(data.purchase_price)}
Number of Units: ${data.num_units}
Total Monthly Rent Roll: $${fmt(data.total_rent_roll)}
Occupancy Rate: ${data.occupancy_rate}%
Down Payment: ${data.down_payment_pct}%`;
      break;
  }

  return `You are an expert real estate investment analyst. Analyze the following property deal and provide a comprehensive investment analysis.

PROPERTY:
Address: ${data.address}
${details}

INSTRUCTIONS:
Analyze this deal thoroughly. Use standard real estate assumptions where the investor hasn't provided data:
- Interest rate: assume current market rate (~7% for investment property)
- Loan term: 30 years
- Property taxes: ~1.2% of purchase price annually (adjust for locale)
- Insurance: ~0.5% of purchase price annually
- Maintenance reserve: 10% of gross rent
- Vacancy allowance: 5-8%
- Property management: 10% of gross rent
- Closing costs: ~3% for buy, ~6% for sell

Respond in EXACTLY this JSON format (no markdown, no code fences, just raw JSON):
{
  "verdict": "STRONG BUY" or "BUY" or "HOLD" or "PASS",
  "verdict_summary": "One sentence explaining the verdict",
  "metrics": [
    {"label": "Metric Name", "value": "Formatted Value"},
    ... (4-6 key metrics appropriate to the strategy)
  ],
  "cashflow": [
    {"item": "Line Item Name", "amount": 1234.56, "type": "income" or "expense"},
    ... (include all relevant monthly income and expense items)
  ],
  "cashflow_net": 456.78,
  "risks": [
    {"level": "high" or "medium" or "low", "text": "Description of this specific risk"},
    ... (3-5 risks)
  ],
  "market_context": "A paragraph about market context and how this deal fits",
  "optimization_tips": [
    "Specific actionable tip 1",
    "Specific actionable tip 2",
    "Specific actionable tip 3"
  ],
  "full_assessment": "A detailed 2-3 paragraph assessment of this deal covering the overall opportunity, key strengths, key weaknesses, and final recommendation."
}

For the metrics, use strategy-appropriate metrics:
- Buy & Hold: Cap Rate, Cash-on-Cash Return, DSCR, Monthly Cash Flow, Total Cash Needed, Gross Rent Multiplier
- Fix & Flip: Total Profit, ROI, Profit Margin, ARV Ratio, Cost per Sq Ft (estimate), All-In Cost
- BRRRR: Cash Left in Deal, Cash-on-Cash, DSCR, Monthly Cash Flow After Refi, Equity Created, Total Investment Before Refi
- Multi-Unit: Cap Rate, Cash-on-Cash, Price per Unit, DSCR, Gross Rent Multiplier, Monthly Cash Flow

Ensure all numbers are realistic and mathematically consistent. Be honest — if it's a bad deal, say so.`;
}

function buildFlipPrompt(data) {
  const fmt = (v) => Number(v).toLocaleString('en-US');
  const finLabels = { cash: 'All Cash', hard_money: 'Hard Money Loan', conventional: 'Conventional Loan' };

  return `You are an expert real estate investment analyst specializing in fix & flip deals. Analyze this potential flip deal and provide a comprehensive assessment.

DEAL DETAILS:
- Property Address: ${data.address}
- Purchase Price: $${fmt(data.purchasePrice)}
- Renovation Budget: $${fmt(data.renobudget)}
- After Repair Value (ARV): $${fmt(data.arv)}
- Holding Period: ${data.holdingPeriod} months
- Financing: ${finLabels[data.financing] || data.financing}

Please analyze and provide a detailed assessment. Respond in EXACTLY this JSON format (no markdown, no code fences, just raw JSON):
{
  "profitProjection": {
    "netProfit": number,
    "totalCosts": number,
    "breakdown": "string description of costs"
  },
  "roi": {
    "percentage": number,
    "cashInvested": number,
    "verdict": "string"
  },
  "seventyPercentRule": {
    "maxPrice": number,
    "actualPrice": number,
    "passes": boolean,
    "explanation": "string"
  },
  "costToArv": {
    "ratio": number,
    "rating": "string",
    "explanation": "string"
  },
  "riskAssessment": {
    "level": "LOW" or "MODERATE" or "HIGH",
    "factors": ["string array of risk factors"],
    "mitigations": ["string array of mitigations"]
  },
  "contractorTips": ["string array of 3-4 tips"],
  "summary": "A 2-3 sentence executive summary of the deal"
}

Be realistic and mathematically consistent. If it's a bad deal, say so.`;
}

function buildBrrrrPrompt(data) {
  const fmt = (v) => Number(v).toLocaleString('en-US');

  return `You are an expert real estate investment analyst specializing in the BRRRR strategy (Buy, Rehab, Rent, Refinance, Repeat). Analyze this BRRRR deal.

DEAL DETAILS:
- Property Address: ${data.address}
- Purchase Price: $${fmt(data.purchasePrice)}
- Renovation Budget: $${fmt(data.renobudget)}
- After Repair Value (ARV): $${fmt(data.arv)}
- Expected Monthly Rent: $${fmt(data.monthlyRent)}
- Refinance LTV Target: ${data.refiLTV}%
- Interest Rate Estimate: ${data.interestRate}%

Total cash invested = Purchase Price + Renovation Budget.

Respond in EXACTLY this JSON format (no markdown, no code fences, just raw JSON):
{
  "cashOut": {
    "refinanceAmount": number,
    "totalInvested": number,
    "cashOutProceeds": number,
    "capitalLeftInDeal": number,
    "explanation": "string"
  },
  "infiniteReturn": {
    "achieved": boolean,
    "explanation": "string"
  },
  "monthlyCashFlow": {
    "rent": number,
    "mortgage": number,
    "expenses": number,
    "netCashFlow": number,
    "breakdown": "string"
  },
  "capRate": {
    "percentage": number,
    "noi": number,
    "verdict": "string"
  },
  "dscr": {
    "ratio": number,
    "meetsThreshold": boolean,
    "explanation": "string"
  },
  "equityPosition": {
    "equity": number,
    "equityPercent": number,
    "explanation": "string"
  },
  "riskFactors": ["string array of 3-5 risks"],
  "summary": "2-3 sentence executive summary"
}

Be realistic and mathematically consistent. If it's a bad deal, say so.`;
}

function buildRenovationPrompt(data) {
  const fmt = (v) => Number(v).toLocaleString('en-US');
  const typeLabels = { kitchen: 'Kitchen Remodel', bathroom: 'Bathroom Remodel', full_gut: 'Full Gut Renovation', cosmetic: 'Cosmetic Update' };
  const purposeLabels = { sell: 'Sell (Flip)', hold: 'Hold (Rental)', brrrr: 'BRRRR Strategy' };

  return `You are an expert real estate renovation analyst and advisor. Analyze this renovation plan and provide comprehensive guidance.

RENOVATION DETAILS:
- Property Address: ${data.address}
- Current Estimated Value: $${fmt(data.currentValue)}
- Renovation Type: ${typeLabels[data.renoType] || data.renoType}
- Estimated Renovation Budget: $${fmt(data.renoBudget)}
- Purpose: ${purposeLabels[data.purpose] || data.purpose}

Respond in EXACTLY this JSON format (no markdown, no code fences, just raw JSON):
{
  "estimatedValueAdd": {
    "valueIncrease": number,
    "newValue": number,
    "percentIncrease": number,
    "explanation": "string"
  },
  "roi": {
    "percentage": number,
    "dollarReturn": number,
    "verdict": "string"
  },
  "costComparison": {
    "rating": "Below Average" or "Average" or "Above Average",
    "typicalRange": "string like $15,000 - $45,000",
    "explanation": "string"
  },
  "riskLevel": {
    "level": "LOW" or "MODERATE" or "HIGH",
    "factors": ["string array of risk factors"],
    "mitigations": ["string array of mitigations"]
  },
  "scopeRecommendations": {
    "include": ["string array of items to include"],
    "exclude": ["string array of items to skip or reduce"],
    "priorityOrder": ["string array ordered by ROI impact"]
  },
  "agentTalkingPoints": ["string array of 3-4 professional talking points"],
  "summary": "2-3 sentence executive summary"
}

Be realistic. Use 2026 renovation cost data. If the budget is unrealistic, say so.`;
}

function buildStockPrompt(data) {
  const fmt = (v) => Number(v).toLocaleString('en-US');

  return `You are an expert financial analyst. Analyze this stock/ETF investment scenario and provide comprehensive guidance.

INVESTMENT DETAILS:
- Initial Investment: $${fmt(data.investmentAmount)}
- Monthly Contribution: $${fmt(data.monthlyContribution || 0)}
- Expected Annual Return: ${data.expectedReturn || 10}%
- Dividend Yield: ${data.dividendYield || 2}%
- Investment Period: ${data.investmentPeriod || 10} years
- Expense Ratio: ${data.expenseRatio || 0.5}%
- Tax Rate on Gains: ${data.taxRate || 15}%

Respond in EXACTLY this JSON format (no markdown, no code fences, just raw JSON):
{
  "summary": "2-3 sentence executive summary of expected outcomes",
  "projectedValue": number,
  "totalContributed": number,
  "totalGain": number,
  "totalReturn": number,
  "estimatedDividends": number,
  "afterTaxValue": number,
  "metrics": [
    {"label": "Metric Name", "value": "Formatted Value"},
    ... (4-6 key metrics)
  ],
  "yearByYear": [
    {"year": 1, "balance": number, "contributed": number, "gain": number},
    ... (one entry per year)
  ],
  "risks": [
    {"level": "high" or "medium" or "low", "text": "Description"},
    ... (3-5 risks)
  ],
  "recommendations": ["Actionable tip 1", "Actionable tip 2", "Actionable tip 3"],
  "comparison": "A paragraph comparing this investment strategy vs alternatives like real estate, bonds, or crypto"
}

Be realistic with projections. Use historical market data as reference.`;
}

function buildBitcoinPrompt(data) {
  const fmt = (v) => Number(v).toLocaleString('en-US');

  return `You are an expert cryptocurrency analyst. Analyze this Bitcoin investment scenario.

INVESTMENT DETAILS:
- Initial Investment: $${fmt(data.investmentAmount)}
- Current BTC Price: $${fmt(data.currentPrice || 87000)}
- Monthly DCA Amount: $${fmt(data.dcaMonthly || 0)}
- Investment Period: ${data.investmentPeriod || 5} years
- Expected Annual Growth: ${data.expectedGrowthRate || 30}%
- Tax Rate on Gains: ${data.taxRate || 15}%

Respond in EXACTLY this JSON format (no markdown, no code fences, just raw JSON):
{
  "summary": "2-3 sentence executive summary",
  "btcPurchased": number,
  "projectedBtcPrice": number,
  "projectedValue": number,
  "totalInvested": number,
  "projectedGain": number,
  "totalReturn": number,
  "afterTaxGain": number,
  "metrics": [
    {"label": "Metric Name", "value": "Formatted Value"},
    ... (4-6 key metrics including BTC amount, sats, etc.)
  ],
  "yearByYear": [
    {"year": 1, "btcPrice": number, "totalBtc": number, "portfolioValue": number, "totalInvested": number},
    ... (one per year)
  ],
  "risks": [
    {"level": "high" or "medium" or "low", "text": "Description"},
    ... (3-5 risks)
  ],
  "recommendations": ["Actionable tip 1", "Actionable tip 2", "Actionable tip 3"],
  "halvingAnalysis": "A paragraph about how Bitcoin halving cycles affect this investment timeline"
}

Be realistic. Include volatility warnings. Reference historical BTC performance.`;
}

module.exports = {
  callClaude,
  buildPropertyPrompt,
  buildFlipPrompt,
  buildBrrrrPrompt,
  buildRenovationPrompt,
  buildStockPrompt,
  buildBitcoinPrompt
};
