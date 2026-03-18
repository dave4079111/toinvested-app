const express = require('express');
const router = express.Router();
const { logger } = require('../logger');

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

    if (!purchasePrice || !monthlyRent) {
      return res.status(400).json({ error: 'Purchase price and monthly rent are required' });
    }

    const downPayment = purchasePrice * (downPaymentPercent / 100);
    const loanAmount = purchasePrice - downPayment;
    const monthlyRate = interestRate / 100 / 12;
    const numPayments = loanTerm * 12;

    // Monthly mortgage payment
    const monthlyMortgage = loanAmount > 0
      ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
      : 0;

    // Income
    const grossMonthlyIncome = monthlyRent + (otherIncome || 0);
    const vacancyLoss = grossMonthlyIncome * (vacancyRate / 100);
    const effectiveMonthlyIncome = grossMonthlyIncome - vacancyLoss;

    // Expenses
    const monthlyPropertyTax = (propertyTax || purchasePrice * 0.012) / 12;
    const monthlyInsurance = (insurance || purchasePrice * 0.005) / 12;
    const monthlyMaintenance = maintenance || (purchasePrice * 0.01) / 12;
    const monthlyManagement = effectiveMonthlyIncome * (managementFee / 100);
    const totalMonthlyExpenses = monthlyPropertyTax + monthlyInsurance + monthlyMaintenance + monthlyManagement + (hoaFees || 0) + (utilities || 0);

    // Cash flow
    const monthlyCashFlow = effectiveMonthlyIncome - totalMonthlyExpenses - monthlyMortgage;
    const annualCashFlow = monthlyCashFlow * 12;

    // Key metrics
    const totalCashInvested = downPayment + (closingCosts || purchasePrice * 0.03) + (repairCosts || 0);
    const cashOnCashReturn = (annualCashFlow / totalCashInvested) * 100;
    const noi = (effectiveMonthlyIncome - totalMonthlyExpenses) * 12;
    const capRate = (noi / purchasePrice) * 100;
    const grossRentMultiplier = purchasePrice / (grossMonthlyIncome * 12);
    const dscr = noi / (monthlyMortgage * 12);
    const expenseRatio = (totalMonthlyExpenses / effectiveMonthlyIncome) * 100;

    // 5-year projection
    const projection = [];
    for (let year = 1; year <= 5; year++) {
      const projectedValue = purchasePrice * Math.pow(1 + appreciationRate / 100, year);
      const projectedRent = monthlyRent * Math.pow(1.03, year);
      const equity = projectedValue - loanAmount; // Simplified
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
        monthlyCashFlow: Math.round(monthlyCashFlow * 100) / 100,
        annualCashFlow: Math.round(annualCashFlow * 100) / 100,
        cashOnCashReturn: Math.round(cashOnCashReturn * 100) / 100,
        capRate: Math.round(capRate * 100) / 100,
        grossRentMultiplier: Math.round(grossRentMultiplier * 100) / 100,
        dscr: Math.round(dscr * 100) / 100,
        noi: Math.round(noi * 100) / 100,
        expenseRatio: Math.round(expenseRatio * 100) / 100
      },
      financing: {
        downPayment: Math.round(downPayment),
        loanAmount: Math.round(loanAmount),
        monthlyMortgage: Math.round(monthlyMortgage * 100) / 100,
        totalCashInvested: Math.round(totalCashInvested)
      },
      income: {
        grossMonthlyIncome: Math.round(grossMonthlyIncome * 100) / 100,
        vacancyLoss: Math.round(vacancyLoss * 100) / 100,
        effectiveMonthlyIncome: Math.round(effectiveMonthlyIncome * 100) / 100
      },
      expenses: {
        propertyTax: Math.round(monthlyPropertyTax * 100) / 100,
        insurance: Math.round(monthlyInsurance * 100) / 100,
        maintenance: Math.round(monthlyMaintenance * 100) / 100,
        management: Math.round(monthlyManagement * 100) / 100,
        hoaFees: hoaFees || 0,
        utilities: utilities || 0,
        totalMonthlyExpenses: Math.round(totalMonthlyExpenses * 100) / 100
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

    if (!purchasePrice || !arv || !rehabCost) {
      return res.status(400).json({ error: 'Purchase price, ARV, and rehab cost are required' });
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
    const roi = (profit / totalCashNeeded) * 100;
    const annualizedRoi = (roi / holdingMonths) * 12;

    // 70% Rule check
    const maxPurchasePrice70 = (arv * 0.7) - rehabCost;
    const meetsRule = purchasePrice <= maxPurchasePrice70;

    let rating = 'Poor Deal';
    if (roi >= 30 && meetsRule) rating = 'Excellent Deal';
    else if (roi >= 20) rating = 'Good Deal';
    else if (roi >= 10) rating = 'Marginal Deal';

    res.json({
      summary: { rating, profit: Math.round(profit), roi: Math.round(roi * 100) / 100, annualizedRoi: Math.round(annualizedRoi * 100) / 100, meetsRule },
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

    if (!purchasePrice || !rehabCost || !arv || !monthlyRent) {
      return res.status(400).json({ error: 'Purchase price, rehab cost, ARV, and monthly rent are required' });
    }

    // Initial purchase
    const downPayment = purchasePrice * (downPaymentPercent / 100);
    const initialLoan = purchasePrice - downPayment;
    const totalCashIn = downPayment + rehabCost + (purchasePrice * 0.03); // + closing costs

    // Refinance
    const refinanceAmount = arv * (refinanceLTV / 100);
    const cashBackAtRefi = refinanceAmount - initialLoan;
    const moneyLeftInDeal = totalCashIn - cashBackAtRefi;

    // Monthly cash flow after refinance
    const monthlyRateRefi = refinanceRate / 100 / 12;
    const monthlyMortgageRefi = refinanceAmount * (monthlyRateRefi * Math.pow(1 + monthlyRateRefi, 360)) / (Math.pow(1 + monthlyRateRefi, 360) - 1);
    const effectiveRent = monthlyRent * (1 - vacancyRate / 100);
    const monthlyExpenses = ((propertyTax || arv * 0.012) / 12) + ((insurance || arv * 0.005) / 12) +
      (maintenance || arv * 0.01 / 12) + (effectiveRent * managementFee / 100);
    const monthlyCashFlow = effectiveRent - monthlyExpenses - monthlyMortgageRefi;

    const infiniteReturn = moneyLeftInDeal <= 0;
    const cashOnCash = infiniteReturn ? Infinity : (monthlyCashFlow * 12 / moneyLeftInDeal) * 100;

    let rating = 'Poor';
    if (infiniteReturn && monthlyCashFlow > 0) rating = 'Excellent - Infinite Return!';
    else if (cashOnCash >= 15) rating = 'Excellent';
    else if (cashOnCash >= 8) rating = 'Good';
    else if (monthlyCashFlow > 0) rating = 'Fair';

    res.json({
      summary: {
        rating, monthlyCashFlow: Math.round(monthlyCashFlow * 100) / 100,
        cashOnCashReturn: infiniteReturn ? 'Infinite' : Math.round(cashOnCash * 100) / 100,
        moneyLeftInDeal: Math.round(moneyLeftInDeal), infiniteReturn
      },
      acquisition: { purchasePrice, rehabCost, downPayment: Math.round(downPayment), totalCashIn: Math.round(totalCashIn) },
      refinance: { arv, refinanceAmount: Math.round(refinanceAmount), cashBack: Math.round(cashBackAtRefi), newMortgage: Math.round(monthlyMortgageRefi * 100) / 100 },
      cashFlow: {
        effectiveRent: Math.round(effectiveRent * 100) / 100, totalExpenses: Math.round(monthlyExpenses * 100) / 100,
        mortgage: Math.round(monthlyMortgageRefi * 100) / 100, netCashFlow: Math.round(monthlyCashFlow * 100) / 100
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

    if (!investmentAmount) {
      return res.status(400).json({ error: 'Investment amount is required' });
    }

    const monthlyReturn = expectedReturn / 100 / 12;
    const months = investmentPeriod * 12;
    let balance = investmentAmount;
    const yearlyProjection = [];

    for (let month = 1; month <= months; month++) {
      balance = balance * (1 + monthlyReturn) + monthlyContribution;
      if (month % 12 === 0) {
        const year = month / 12;
        const totalContributed = investmentAmount + (monthlyContribution * month);
        const totalGain = balance - totalContributed;
        const dividendIncome = balance * (dividendYield / 100);
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
    const totalDividends = finalBalance * (dividendYield / 100) * investmentPeriod;
    const taxOnGains = totalGain * (taxRate / 100);
    const afterTax = finalBalance - taxOnGains;

    res.json({
      summary: {
        finalBalance: Math.round(finalBalance),
        totalContributed: Math.round(totalContributed),
        totalGain: Math.round(totalGain),
        totalReturn: Math.round((totalGain / totalContributed) * 100 * 100) / 100,
        estimatedDividends: Math.round(totalDividends),
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

    if (!investmentAmount) {
      return res.status(400).json({ error: 'Investment amount is required' });
    }

    const btcPurchased = investmentAmount / currentPrice;
    const yearlyProjection = [];
    let totalInvested = investmentAmount;
    let totalBtc = btcPurchased;

    for (let year = 1; year <= investmentPeriod; year++) {
      const projectedPrice = currentPrice * Math.pow(1 + expectedGrowthRate / 100, year);
      if (dcaMonthly > 0) {
        // DCA accumulation (simplified - uses average price for the year)
        const avgPrice = currentPrice * Math.pow(1 + expectedGrowthRate / 100, year - 0.5);
        totalBtc += (dcaMonthly * 12) / avgPrice;
        totalInvested += dcaMonthly * 12;
      }
      const portfolioValue = totalBtc * projectedPrice;
      const gain = portfolioValue - totalInvested;
      yearlyProjection.push({
        year, projectedPrice: Math.round(projectedPrice), totalBtc: Math.round(totalBtc * 100000000) / 100000000,
        portfolioValue: Math.round(portfolioValue), totalInvested: Math.round(totalInvested),
        gain: Math.round(gain), returnPercent: Math.round((gain / totalInvested) * 100 * 100) / 100
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
    if (!currentValue || !renovations || !renovations.length) {
      return res.status(400).json({ error: 'Current value and at least one renovation are required' });
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

    let totalCost = 0;
    let totalValueAdded = 0;
    const results = renovations.map(reno => {
      const type = reno.type?.toLowerCase() || 'other';
      const cost = reno.cost || 0;
      const quality = reno.quality || 'mid';
      const multiplier = roiMultipliers[type]?.[quality] || roiMultipliers.other[quality];
      const valueAdded = cost * (1 + multiplier);
      const roi = multiplier * 100;
      totalCost += cost;
      totalValueAdded += valueAdded;
      return { type, description: reno.description || type, cost, valueAdded: Math.round(valueAdded), roi: Math.round(roi), quality };
    });

    const newValue = currentValue + totalValueAdded;
    const totalRoi = ((totalValueAdded - totalCost) / totalCost) * 100;

    res.json({
      summary: {
        currentValue, totalRehabCost: totalCost, estimatedNewValue: Math.round(newValue),
        totalValueAdded: Math.round(totalValueAdded), totalRoi: Math.round(totalRoi * 100) / 100,
        netGain: Math.round(totalValueAdded - totalCost)
      },
      renovations: results
    });
  } catch (err) {
    logger.error('Renovation analyzer error', { error: err.message });
    res.status(500).json({ error: 'Analysis failed' });
  }
});

module.exports = router;
