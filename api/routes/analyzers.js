const express = require('express');
const router = express.Router();
const { logger } = require('../logger');
const {
  callClaude,
  buildPropertyPrompt,
  buildFlipPrompt,
  buildBrrrrPrompt,
  buildRenovationPrompt,
  buildStockPrompt,
  buildBitcoinPrompt
} = require('../services/ai');

// Helper: validate that a value is a positive finite number
function isPositiveNumber(val) {
  return typeof val === 'number' && isFinite(val) && val > 0;
}

// Helper: safe division that returns 0 instead of NaN/Infinity
function safeDivide(numerator, denominator) {
  if (!denominator || !isFinite(denominator)) return 0;
  const result = numerator / denominator;
  return isFinite(result) ? result : 0;
}

// Helper: round to 2 decimal places
function round2(val) {
  return Math.round(val * 100) / 100;
}

// ===========================================
// PROPERTY ANALYZER - Rental Property Analysis
// ===========================================
router.post('/property', (req, res) => {
  try {
    const {
      purchasePrice, downPaymentPercent = 20, interestRate = 7, loanTerm = 30,
      monthlyRent, otherIncome = 0, propertyTax, insurance, maintenance,
      vacancyRate = 8, managementFee = 10, hoaFees = 0, utilities = 0,
      closingCosts, repairCosts = 0, appreciationRate = 3
    } = req.body;

    if (!isPositiveNumber(purchasePrice) || !isPositiveNumber(monthlyRent)) {
      return res.status(400).json({ error: 'Purchase price and monthly rent must be positive numbers' });
    }

    const downPayment = purchasePrice * (downPaymentPercent / 100);
    const loanAmount = purchasePrice - downPayment;
    const monthlyRate = interestRate / 100 / 12;
    const numPayments = loanTerm * 12;

    // Monthly mortgage payment
    let monthlyMortgage = 0;
    if (loanAmount > 0 && monthlyRate > 0) {
      monthlyMortgage = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
    }

    // Income
    const grossMonthlyIncome = monthlyRent + (otherIncome || 0);
    const vacancyLoss = grossMonthlyIncome * (vacancyRate / 100);
    const effectiveMonthlyIncome = grossMonthlyIncome - vacancyLoss;

    // Expenses - management fee applied to gross rent, not effective income
    const monthlyPropertyTax = (propertyTax || purchasePrice * 0.012) / 12;
    const monthlyInsurance = (insurance || purchasePrice * 0.005) / 12;
    const monthlyMaintenance = (maintenance || purchasePrice * 0.01) / 12;
    const monthlyManagement = monthlyRent * (managementFee / 100);
    const totalMonthlyExpenses = monthlyPropertyTax + monthlyInsurance + monthlyMaintenance + monthlyManagement + (hoaFees || 0) + (utilities || 0);

    // Cash flow
    const monthlyCashFlow = effectiveMonthlyIncome - totalMonthlyExpenses - monthlyMortgage;
    const annualCashFlow = monthlyCashFlow * 12;

    // Key metrics
    const totalCashInvested = downPayment + (closingCosts || purchasePrice * 0.03) + (repairCosts || 0);
    const cashOnCashReturn = safeDivide(annualCashFlow, totalCashInvested) * 100;
    const noi = (effectiveMonthlyIncome - totalMonthlyExpenses) * 12;
    const capRate = safeDivide(noi, purchasePrice) * 100;
    const grossRentMultiplier = safeDivide(purchasePrice, grossMonthlyIncome * 12);
    const annualDebtService = monthlyMortgage * 12;
    const dscr = annualDebtService > 0 ? safeDivide(noi, annualDebtService) : 0;
    const expenseRatio = effectiveMonthlyIncome > 0 ? safeDivide(totalMonthlyExpenses, effectiveMonthlyIncome) * 100 : 0;

    // 5-year projection with principal paydown estimate
    const projection = [];
    for (let year = 1; year <= 5; year++) {
      const projectedValue = purchasePrice * Math.pow(1 + appreciationRate / 100, year);
      const projectedRent = monthlyRent * Math.pow(1 + appreciationRate / 100, year);
      // Estimate principal paid down (simplified: total payments minus interest-only portion)
      const monthsElapsed = year * 12;
      let remainingBalance = loanAmount;
      if (loanAmount > 0 && monthlyRate > 0) {
        remainingBalance = loanAmount * Math.pow(1 + monthlyRate, monthsElapsed) -
          monthlyMortgage * (Math.pow(1 + monthlyRate, monthsElapsed) - 1) / monthlyRate;
      }
      const equity = projectedValue - Math.max(0, remainingBalance);
      projection.push({ year, propertyValue: Math.round(projectedValue), monthlyRent: Math.round(projectedRent), equity: Math.round(equity) });
    }

    // Rating
    let rating = 'Poor';
    if (cashOnCashReturn >= 12 && capRate >= 8) rating = 'Excellent';
    else if (cashOnCashReturn >= 8 && capRate >= 6) rating = 'Good';
    else if (cashOnCashReturn >= 4 && capRate >= 4) rating = 'Fair';

    res.json({
      summary: {
        rating,
        monthlyCashFlow: round2(monthlyCashFlow),
        annualCashFlow: round2(annualCashFlow),
        cashOnCashReturn: round2(cashOnCashReturn),
        capRate: round2(capRate),
        grossRentMultiplier: round2(grossRentMultiplier),
        dscr: round2(dscr),
        noi: round2(noi),
        expenseRatio: round2(expenseRatio)
      },
      financing: {
        downPayment: Math.round(downPayment),
        loanAmount: Math.round(loanAmount),
        monthlyMortgage: round2(monthlyMortgage),
        totalCashInvested: Math.round(totalCashInvested)
      },
      income: {
        grossMonthlyIncome: round2(grossMonthlyIncome),
        vacancyLoss: round2(vacancyLoss),
        effectiveMonthlyIncome: round2(effectiveMonthlyIncome)
      },
      expenses: {
        propertyTax: round2(monthlyPropertyTax),
        insurance: round2(monthlyInsurance),
        maintenance: round2(monthlyMaintenance),
        management: round2(monthlyManagement),
        hoaFees: hoaFees || 0,
        utilities: utilities || 0,
        totalMonthlyExpenses: round2(totalMonthlyExpenses)
      },
      projection
    });
  } catch (err) {
    logger.error('Property analyzer error', { error: err.message });
    res.status(500).json({ error: 'Analysis failed. Please check your inputs.' });
  }
});

// ===========================================
// FIX & FLIP ANALYZER
// ===========================================
router.post('/flip', (req, res) => {
  try {
    const {
      purchasePrice, arv, rehabCost, holdingMonths = 6,
      closingCostsBuy = 3, closingCostsSell = 6,
      monthlyHoldingCost = 0, financingCost = 0,
      interestRate = 10, loanPercent = 80
    } = req.body;

    if (!isPositiveNumber(purchasePrice) || !isPositiveNumber(arv) || !isPositiveNumber(rehabCost)) {
      return res.status(400).json({ error: 'Purchase price, ARV, and rehab cost must be positive numbers' });
    }

    const closingBuy = purchasePrice * (closingCostsBuy / 100);
    const closingSell = arv * (closingCostsSell / 100);
    const loanAmount = purchasePrice * (loanPercent / 100);
    const downPayment = purchasePrice - loanAmount;
    const totalFinancingCost = financingCost || (loanAmount * (interestRate / 100) * (holdingMonths / 12));
    const totalHoldingCost = (monthlyHoldingCost || (purchasePrice * 0.005)) * holdingMonths;

    const totalInvestment = purchasePrice + rehabCost + closingBuy + closingSell + totalHoldingCost + totalFinancingCost;
    const totalCashNeeded = downPayment + rehabCost + closingBuy + totalHoldingCost;
    const profit = arv - totalInvestment;
    const roi = safeDivide(profit, totalCashNeeded) * 100;
    const annualizedRoi = holdingMonths > 0 ? safeDivide(roi, holdingMonths) * 12 : 0;

    // 70% Rule check
    const maxPurchasePrice70 = (arv * 0.7) - rehabCost;
    const meetsRule = purchasePrice <= maxPurchasePrice70;

    let rating = 'Poor Deal';
    if (profit > 0 && roi >= 30 && meetsRule) rating = 'Excellent Deal';
    else if (profit > 0 && roi >= 20) rating = 'Good Deal';
    else if (profit > 0 && roi >= 10) rating = 'Marginal Deal';

    res.json({
      summary: { rating, profit: Math.round(profit), roi: round2(roi), annualizedRoi: round2(annualizedRoi), meetsRule },
      costs: {
        purchasePrice, rehabCost, closingBuy: Math.round(closingBuy), closingSell: Math.round(closingSell),
        holdingCost: Math.round(totalHoldingCost), financingCost: Math.round(totalFinancingCost),
        totalInvestment: Math.round(totalInvestment), totalCashNeeded: Math.round(totalCashNeeded)
      },
      rules: { maxPurchasePrice70: Math.round(maxPurchasePrice70), arv, rehabCost }
    });
  } catch (err) {
    logger.error('Flip analyzer error', { error: err.message });
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// ===========================================
// BRRRR ANALYZER
// ===========================================
router.post('/brrrr', (req, res) => {
  try {
    const {
      purchasePrice, rehabCost, arv, monthlyRent,
      downPaymentPercent = 20, interestRate = 7, refinanceRate = 6.5,
      refinanceLTV = 75, holdingMonths = 6, vacancyRate = 8,
      propertyTax, insurance, maintenance, managementFee = 10
    } = req.body;

    if (!isPositiveNumber(purchasePrice) || !isPositiveNumber(rehabCost) || !isPositiveNumber(arv) || !isPositiveNumber(monthlyRent)) {
      return res.status(400).json({ error: 'Purchase price, rehab cost, ARV, and monthly rent must be positive numbers' });
    }

    // Initial purchase
    const downPayment = purchasePrice * (downPaymentPercent / 100);
    const initialLoan = purchasePrice - downPayment;
    const closingCosts = purchasePrice * 0.03;
    const totalCashIn = downPayment + rehabCost + closingCosts;

    // Holding cost during rehab period
    const monthlyHoldingRate = interestRate / 100 / 12;
    const holdingInterest = initialLoan * monthlyHoldingRate * holdingMonths;

    // Refinance
    const refinanceAmount = arv * (refinanceLTV / 100);
    const cashBackAtRefi = refinanceAmount - initialLoan;
    const moneyLeftInDeal = totalCashIn + holdingInterest - cashBackAtRefi;

    // Monthly cash flow after refinance
    const monthlyRateRefi = refinanceRate / 100 / 12;
    let monthlyMortgageRefi = 0;
    if (refinanceAmount > 0 && monthlyRateRefi > 0) {
      monthlyMortgageRefi = refinanceAmount * (monthlyRateRefi * Math.pow(1 + monthlyRateRefi, 360)) / (Math.pow(1 + monthlyRateRefi, 360) - 1);
    }
    const effectiveRent = monthlyRent * (1 - vacancyRate / 100);
    // Expenses based on purchase price (more conservative than ARV)
    const monthlyPropertyTax = (propertyTax || purchasePrice * 0.012) / 12;
    const monthlyInsurance = (insurance || purchasePrice * 0.005) / 12;
    const monthlyMaintenance = (maintenance || purchasePrice * 0.01) / 12;
    const monthlyManagement = monthlyRent * (managementFee / 100);
    const monthlyExpenses = monthlyPropertyTax + monthlyInsurance + monthlyMaintenance + monthlyManagement;
    const monthlyCashFlow = effectiveRent - monthlyExpenses - monthlyMortgageRefi;

    const infiniteReturn = moneyLeftInDeal <= 0;
    const cashOnCash = infiniteReturn ? 0 : safeDivide(monthlyCashFlow * 12, moneyLeftInDeal) * 100;

    let rating = 'Poor';
    if (infiniteReturn && monthlyCashFlow > 0) rating = 'Excellent - Infinite Return!';
    else if (cashOnCash >= 15) rating = 'Excellent';
    else if (cashOnCash >= 8) rating = 'Good';
    else if (monthlyCashFlow > 0) rating = 'Fair';

    res.json({
      summary: {
        rating, monthlyCashFlow: round2(monthlyCashFlow),
        cashOnCashReturn: infiniteReturn ? 'Infinite' : round2(cashOnCash),
        moneyLeftInDeal: Math.round(moneyLeftInDeal), infiniteReturn
      },
      acquisition: { purchasePrice, rehabCost, downPayment: Math.round(downPayment), totalCashIn: Math.round(totalCashIn) },
      refinance: { arv, refinanceAmount: Math.round(refinanceAmount), cashBack: Math.round(cashBackAtRefi), newMortgage: round2(monthlyMortgageRefi) },
      cashFlow: {
        effectiveRent: round2(effectiveRent), totalExpenses: round2(monthlyExpenses),
        mortgage: round2(monthlyMortgageRefi), netCashFlow: round2(monthlyCashFlow)
      }
    });
  } catch (err) {
    logger.error('BRRRR analyzer error', { error: err.message });
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// ===========================================
// STOCK ANALYZER
// ===========================================
router.post('/stock', (req, res) => {
  try {
    const {
      investmentAmount, expectedReturn = 10, dividendYield = 2,
      investmentPeriod = 10, monthlyContribution = 0,
      expenseRatio = 0.5, taxRate = 15, inflationRate = 3
    } = req.body;

    if (!isPositiveNumber(investmentAmount)) {
      return res.status(400).json({ error: 'Investment amount must be a positive number' });
    }
    if (investmentPeriod < 1 || investmentPeriod > 50) {
      return res.status(400).json({ error: 'Investment period must be between 1 and 50 years' });
    }

    // Net return after expense ratio
    const netReturn = expectedReturn - expenseRatio;
    const monthlyReturn = netReturn / 100 / 12;
    const months = Math.round(investmentPeriod * 12);
    let balance = investmentAmount;
    const yearlyProjection = [];
    let cumulativeDividends = 0;

    for (let month = 1; month <= months; month++) {
      balance = balance * (1 + monthlyReturn) + monthlyContribution;
      if (month % 12 === 0) {
        const year = month / 12;
        const totalContributed = investmentAmount + (monthlyContribution * month);
        const totalGain = balance - totalContributed;
        // Annual dividend based on current balance
        const dividendIncome = balance * (dividendYield / 100);
        cumulativeDividends += dividendIncome;
        const realValue = balance / Math.pow(1 + inflationRate / 100, year);
        yearlyProjection.push({
          year, balance: Math.round(balance), totalContributed: Math.round(totalContributed),
          totalGain: Math.round(totalGain), dividendIncome: Math.round(dividendIncome),
          realValue: Math.round(realValue)
        });
      }
    }

    const finalBalance = balance;
    const totalContributed = investmentAmount + (monthlyContribution * months);
    const totalGain = finalBalance - totalContributed;
    const taxOnGains = Math.max(0, totalGain * (taxRate / 100));
    const afterTax = finalBalance - taxOnGains;

    res.json({
      summary: {
        finalBalance: Math.round(finalBalance),
        totalContributed: Math.round(totalContributed),
        totalGain: Math.round(totalGain),
        totalReturn: round2(safeDivide(totalGain, totalContributed) * 100),
        estimatedDividends: Math.round(cumulativeDividends),
        afterTaxValue: Math.round(afterTax)
      },
      projection: yearlyProjection
    });
  } catch (err) {
    logger.error('Stock analyzer error', { error: err.message });
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// ===========================================
// BITCOIN/CRYPTO ANALYZER
// ===========================================
router.post('/bitcoin', (req, res) => {
  try {
    const {
      investmentAmount, currentPrice = 60000, expectedGrowthRate = 50,
      investmentPeriod = 5, dcaMonthly = 0, taxRate = 15
    } = req.body;

    if (!isPositiveNumber(investmentAmount)) {
      return res.status(400).json({ error: 'Investment amount must be a positive number' });
    }
    if (!isPositiveNumber(currentPrice)) {
      return res.status(400).json({ error: 'Current price must be a positive number' });
    }
    if (investmentPeriod < 1 || investmentPeriod > 30) {
      return res.status(400).json({ error: 'Investment period must be between 1 and 30 years' });
    }

    const btcPurchased = investmentAmount / currentPrice;
    const yearlyProjection = [];
    let totalInvested = investmentAmount;
    let totalBtc = btcPurchased;

    for (let year = 1; year <= investmentPeriod; year++) {
      const projectedPrice = currentPrice * Math.pow(1 + expectedGrowthRate / 100, year);
      if (dcaMonthly > 0) {
        // DCA: calculate monthly purchases through the year at monthly price points
        const prevYearPrice = currentPrice * Math.pow(1 + expectedGrowthRate / 100, year - 1);
        const yearEndPrice = projectedPrice;
        for (let m = 1; m <= 12; m++) {
          const monthPrice = prevYearPrice + (yearEndPrice - prevYearPrice) * (m / 12);
          totalBtc += dcaMonthly / monthPrice;
        }
        totalInvested += dcaMonthly * 12;
      }
      const portfolioValue = totalBtc * projectedPrice;
      const gain = portfolioValue - totalInvested;
      yearlyProjection.push({
        year, projectedPrice: Math.round(projectedPrice), totalBtc: Math.round(totalBtc * 100000000) / 100000000,
        portfolioValue: Math.round(portfolioValue), totalInvested: Math.round(totalInvested),
        gain: Math.round(gain), returnPercent: round2(safeDivide(gain, totalInvested) * 100)
      });
    }

    const finalProjection = yearlyProjection[yearlyProjection.length - 1];
    const taxOnGains = Math.max(0, finalProjection.gain * (taxRate / 100));

    res.json({
      summary: {
        btcPurchased: Math.round(btcPurchased * 100000000) / 100000000,
        totalBtcAccumulated: finalProjection.totalBtc,
        projectedValue: finalProjection.portfolioValue,
        totalInvested: finalProjection.totalInvested,
        projectedGain: finalProjection.gain,
        totalReturn: finalProjection.returnPercent,
        afterTaxGain: Math.round(finalProjection.gain - taxOnGains)
      },
      projection: yearlyProjection,
      disclaimer: 'Cryptocurrency investments are highly volatile. Past performance does not guarantee future results. This is not financial advice.'
    });
  } catch (err) {
    logger.error('Bitcoin analyzer error', { error: err.message });
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// ===========================================
// RENOVATION ROI ANALYZER
// ===========================================
router.post('/renovation', (req, res) => {
  try {
    const { currentValue, renovations } = req.body;
    if (!isPositiveNumber(currentValue)) {
      return res.status(400).json({ error: 'Current property value must be a positive number' });
    }
    if (!Array.isArray(renovations) || renovations.length === 0) {
      return res.status(400).json({ error: 'At least one renovation is required' });
    }

    // Standard ROI percentages for different renovation types
    const roiMultipliers = {
      kitchen: { low: 0.6, mid: 0.75, high: 0.85 },
      bathroom: { low: 0.55, mid: 0.7, high: 0.8 },
      roof: { low: 0.5, mid: 0.65, high: 0.7 },
      flooring: { low: 0.6, mid: 0.75, high: 0.85 },
      exterior: { low: 0.5, mid: 0.7, high: 0.8 },
      basement: { low: 0.5, mid: 0.65, high: 0.75 },
      addition: { low: 0.45, mid: 0.6, high: 0.7 },
      landscaping: { low: 0.6, mid: 0.8, high: 0.95 },
      hvac: { low: 0.5, mid: 0.65, high: 0.75 },
      windows: { low: 0.55, mid: 0.7, high: 0.8 },
      other: { low: 0.4, mid: 0.55, high: 0.65 }
    };

    const validQualities = ['low', 'mid', 'high'];

    let totalCost = 0;
    let totalValueAdded = 0;
    const results = renovations.map((reno, index) => {
      const type = (typeof reno.type === 'string' ? reno.type.toLowerCase() : 'other');
      const cost = Number(reno.cost) || 0;
      if (cost <= 0) {
        throw new Error(`Renovation ${index + 1} must have a positive cost`);
      }
      const quality = validQualities.includes(reno.quality) ? reno.quality : 'mid';
      const multiplier = roiMultipliers[type]?.[quality] || roiMultipliers.other[quality];
      const valueAdded = cost * (1 + multiplier);
      const roi = multiplier * 100;
      totalCost += cost;
      totalValueAdded += valueAdded;
      return { type, description: reno.description || type, cost, valueAdded: Math.round(valueAdded), roi: Math.round(roi), quality };
    });

    const newValue = currentValue + totalValueAdded;
    const totalRoi = totalCost > 0 ? safeDivide(totalValueAdded - totalCost, totalCost) * 100 : 0;

    res.json({
      summary: {
        currentValue, totalRehabCost: totalCost, estimatedNewValue: Math.round(newValue),
        totalValueAdded: Math.round(totalValueAdded), totalRoi: round2(totalRoi),
        netGain: Math.round(totalValueAdded - totalCost)
      },
      renovations: results
    });
  } catch (err) {
    logger.error('Renovation analyzer error', { error: err.message });
    res.status(500).json({ error: err.message || 'Analysis failed' });
  }
});

// ===========================================
// AI-ENHANCED ROUTES (server-side Claude API)
// ===========================================

// AI Property Analysis
router.post('/ai/property', async (req, res) => {
  try {
    const { address, strategy } = req.body;
    if (!address || !strategy) {
      return res.status(400).json({ error: 'Address and strategy are required' });
    }
    const prompt = buildPropertyPrompt(req.body);
    const analysis = await callClaude(prompt, 4096);
    res.json(analysis);
  } catch (err) {
    logger.error('AI property analyzer error', { error: err.message });
    if (err.message.includes('not configured')) {
      return res.status(503).json({ error: 'AI service not configured. Please contact support.' });
    }
    res.status(500).json({ error: 'AI analysis failed. Please try again.' });
  }
});

// AI Flip Analysis
router.post('/ai/flip', async (req, res) => {
  try {
    const { address, purchasePrice, renobudget, arv } = req.body;
    if (!address || !purchasePrice || !renobudget || !arv) {
      return res.status(400).json({ error: 'Address, purchase price, renovation budget, and ARV are required' });
    }
    const prompt = buildFlipPrompt(req.body);
    const analysis = await callClaude(prompt, 2500);
    res.json(analysis);
  } catch (err) {
    logger.error('AI flip analyzer error', { error: err.message });
    if (err.message.includes('not configured')) {
      return res.status(503).json({ error: 'AI service not configured. Please contact support.' });
    }
    res.status(500).json({ error: 'AI analysis failed. Please try again.' });
  }
});

// AI BRRRR Analysis
router.post('/ai/brrrr', async (req, res) => {
  try {
    const { address, purchasePrice, renobudget, arv, monthlyRent } = req.body;
    if (!address || !purchasePrice || !renobudget || !arv || !monthlyRent) {
      return res.status(400).json({ error: 'Address, purchase price, renovation budget, ARV, and monthly rent are required' });
    }
    const prompt = buildBrrrrPrompt(req.body);
    const analysis = await callClaude(prompt, 2500);
    res.json(analysis);
  } catch (err) {
    logger.error('AI BRRRR analyzer error', { error: err.message });
    if (err.message.includes('not configured')) {
      return res.status(503).json({ error: 'AI service not configured. Please contact support.' });
    }
    res.status(500).json({ error: 'AI analysis failed. Please try again.' });
  }
});

// AI Renovation Analysis
router.post('/ai/renovation', async (req, res) => {
  try {
    const { address, currentValue, renoType, renoBudget } = req.body;
    if (!address || !currentValue || !renoType || !renoBudget) {
      return res.status(400).json({ error: 'Address, current value, renovation type, and budget are required' });
    }
    const prompt = buildRenovationPrompt(req.body);
    const analysis = await callClaude(prompt, 2500);
    res.json(analysis);
  } catch (err) {
    logger.error('AI renovation analyzer error', { error: err.message });
    if (err.message.includes('not configured')) {
      return res.status(503).json({ error: 'AI service not configured. Please contact support.' });
    }
    res.status(500).json({ error: 'AI analysis failed. Please try again.' });
  }
});

// AI Stock Analysis
router.post('/ai/stock', async (req, res) => {
  try {
    const { investmentAmount } = req.body;
    if (!investmentAmount || investmentAmount <= 0) {
      return res.status(400).json({ error: 'Investment amount must be a positive number' });
    }
    const prompt = buildStockPrompt(req.body);
    const analysis = await callClaude(prompt, 2500);
    res.json(analysis);
  } catch (err) {
    logger.error('AI stock analyzer error', { error: err.message });
    if (err.message.includes('not configured')) {
      return res.status(503).json({ error: 'AI service not configured. Please contact support.' });
    }
    res.status(500).json({ error: 'AI analysis failed. Please try again.' });
  }
});

// AI Bitcoin Analysis
router.post('/ai/bitcoin', async (req, res) => {
  try {
    const { investmentAmount } = req.body;
    if (!investmentAmount || investmentAmount <= 0) {
      return res.status(400).json({ error: 'Investment amount must be a positive number' });
    }
    const prompt = buildBitcoinPrompt(req.body);
    const analysis = await callClaude(prompt, 2500);
    res.json(analysis);
  } catch (err) {
    logger.error('AI bitcoin analyzer error', { error: err.message });
    if (err.message.includes('not configured')) {
      return res.status(503).json({ error: 'AI service not configured. Please contact support.' });
    }
    res.status(500).json({ error: 'AI analysis failed. Please try again.' });
  }
});

module.exports = router;
