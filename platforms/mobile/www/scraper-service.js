/**
 * Scraper Service for Mobile App
 *
 * This module contains the scraping logic that can be injected into WebViews.
 * The scrapers are the same logic as the browser extension, but adapted for
 * direct execution rather than message-based communication.
 */

// All scraper functions - these will be injected into WebViews
const SCRAPERS = {
  /**
   * Anthropic scraper
   */
  anthropic: function() {
    const data = {
      provider: 'Anthropic API',
      scrapedAt: new Date().toISOString(),
      pageUrl: window.location.href
    };

    const pageText = document.body.innerText;

    // Credits remaining
    const creditsMatch = pageText.match(/API\s+credits?\s+remaining[:\s]*\$?([\d,.]+)/i);
    if (creditsMatch) {
      data.creditBalance = parseFloat(creditsMatch[1].replace(',', ''));
    }

    // Total spending
    const spendMatch = pageText.match(/Total\s+(?:usage|spending|cost)[:\s]*\$?([\d,.]+)/i);
    if (spendMatch) {
      data.totalSpending = parseFloat(spendMatch[1].replace(',', ''));
    }

    // This month
    const monthMatch = pageText.match(/This\s+month[:\s]*\$?([\d,.]+)/i);
    if (monthMatch) {
      data.thisMonthSpend = parseFloat(monthMatch[1].replace(',', ''));
    }

    // Usage tier
    const tierMatch = pageText.match(/(?:Usage\s+)?[Tt]ier[:\s]*(\d+)/i);
    if (tierMatch) {
      data.usageTier = parseInt(tierMatch[1]);
    }

    // Tokens
    const tokensInMatch = pageText.match(/Total\s+tokens\s+in[:\s]*([\d,]+)/i);
    if (tokensInMatch) {
      data.tokensIn = parseInt(tokensInMatch[1].replace(/,/g, ''));
    }

    const tokensOutMatch = pageText.match(/Total\s+tokens\s+out[:\s]*([\d,]+)/i);
    if (tokensOutMatch) {
      data.tokensOut = parseInt(tokensOutMatch[1].replace(/,/g, ''));
    }

    if (data.tokensIn && data.tokensOut) {
      data.totalTokens = data.tokensIn + data.tokensOut;
    }

    return data;
  },

  /**
   * OpenAI scraper
   */
  openai: function() {
    const data = {
      provider: 'OpenAI',
      scrapedAt: new Date().toISOString(),
      pageUrl: window.location.href
    };

    const pageText = document.body.innerText;

    // Total Spend
    const totalSpendMatch = pageText.match(/Total\s+Spend[\s\S]*?\$([\d,.]+)/i);
    if (totalSpendMatch) {
      data.totalSpend = parseFloat(totalSpendMatch[1].replace(',', ''));
    }

    // Budget
    const budgetMatch = pageText.match(/\$([\d,.]+)\s*\/\s*\$([\d,.]+)/);
    if (budgetMatch) {
      data.currentSpend = parseFloat(budgetMatch[1].replace(',', ''));
      data.budgetLimit = parseFloat(budgetMatch[2].replace(',', ''));
      data.budgetUsagePercent = Math.round((data.currentSpend / data.budgetLimit) * 100);
    }

    // Reset days
    const resetMatch = pageText.match(/Resets\s+in\s+([\d]+)\s*days?/i);
    if (resetMatch) {
      data.resetInDays = parseInt(resetMatch[1]);
    }

    // Tokens
    const tokensMatch = pageText.match(/Total\s+tokens[\s\S]*?([\d,]+)/i);
    if (tokensMatch) {
      data.totalTokens = parseInt(tokensMatch[1].replace(/,/g, ''));
    }

    // Requests
    const requestsMatch = pageText.match(/Total\s+requests[\s\S]*?([\d,]+)/i);
    if (requestsMatch) {
      data.totalRequests = parseInt(requestsMatch[1].replace(/,/g, ''));
    }

    return data;
  },

  /**
   * Claude.ai scraper
   */
  'claude-ai': function() {
    const data = {
      provider: 'Claude.ai',
      scrapedAt: new Date().toISOString(),
      pageUrl: window.location.href
    };

    const pageText = document.body.innerText;

    // Usage percentage
    const usageMatch = pageText.match(/([\d.]+)%\s*(?:used|of\s+(?:daily|weekly|monthly))/i);
    if (usageMatch) {
      data.usagePercent = parseFloat(usageMatch[1]);
    }

    // Plan type
    const planMatch = pageText.match(/(?:Current\s+)?(?:plan|subscription)[:\s]*(Free|Pro|Team|Enterprise)/i);
    if (planMatch) {
      data.plan = planMatch[1];
    }

    // Messages remaining
    const messagesMatch = pageText.match(/([\d,]+)\s*(?:messages?|queries?)\s*(?:remaining|left)/i);
    if (messagesMatch) {
      data.messagesRemaining = parseInt(messagesMatch[1].replace(/,/g, ''));
    }

    return data;
  },

  /**
   * GitHub Copilot scraper
   */
  'github-copilot': function() {
    const data = {
      provider: 'GitHub Copilot',
      scrapedAt: new Date().toISOString(),
      pageUrl: window.location.href
    };

    const pageText = document.body.innerText;

    // Premium requests
    const premiumMatch = pageText.match(/Premium\s+requests?[:\s]*([\d,]+)\s*(?:of|\/)\s*([\d,]+)/i);
    if (premiumMatch) {
      data.premiumUsed = parseInt(premiumMatch[1].replace(/,/g, ''));
      data.premiumLimit = parseInt(premiumMatch[2].replace(/,/g, ''));
      data.usagePercent = Math.round((data.premiumUsed / data.premiumLimit) * 100);
    }

    // Included limit
    const includedMatch = pageText.match(/Included[:\s]*([\d,]+)/i);
    if (includedMatch) {
      data.includedLimit = parseInt(includedMatch[1].replace(/,/g, ''));
    }

    // Reset date
    const resetMatch = pageText.match(/(?:Resets?|Renews?)\s+(?:on\s+)?([A-Za-z]+\s+\d+)/i);
    if (resetMatch) {
      data.resetInfo = resetMatch[1];
    }

    return data;
  },

  /**
   * Google Cloud scraper
   */
  'google-cloud': function() {
    const data = {
      provider: 'Google Cloud',
      scrapedAt: new Date().toISOString(),
      pageUrl: window.location.href
    };

    const pageText = document.body.innerText;

    // Current charges
    const chargesMatch = pageText.match(/(?:Current|This\s+month'?s?)\s+charges?[:\s]*\$?([\d,.]+)/i);
    if (chargesMatch) {
      data.currentCharges = parseFloat(chargesMatch[1].replace(',', ''));
    }

    // Credits
    const creditsMatch = pageText.match(/(?:Credits?|Promotional)\s+(?:balance|remaining)?[:\s]*\$?([\d,.]+)/i);
    if (creditsMatch) {
      data.creditsRemaining = parseFloat(creditsMatch[1].replace(',', ''));
    }

    // Budget
    const budgetMatch = pageText.match(/Budget[:\s]*\$?([\d,.]+)/i);
    if (budgetMatch) {
      data.budget = parseFloat(budgetMatch[1].replace(',', ''));
    }

    return data;
  },

  /**
   * Perplexity scraper
   */
  perplexity: function() {
    const data = {
      provider: 'Perplexity',
      scrapedAt: new Date().toISOString(),
      pageUrl: window.location.href
    };

    const pageText = document.body.innerText;

    // Credits
    const creditsMatch = pageText.match(/(?:API\s+)?[Cc]redits?[:\s]*\$?([\d,.]+)/i);
    if (creditsMatch) {
      data.credits = parseFloat(creditsMatch[1].replace(',', ''));
    }

    // Usage
    const usageMatch = pageText.match(/(?:Usage|Requests?)[:\s]*([\d,]+)/i);
    if (usageMatch) {
      data.usage = parseInt(usageMatch[1].replace(/,/g, ''));
    }

    // Plan
    const planMatch = pageText.match(/(?:Plan|Subscription)[:\s]*(Free|Pro|Enterprise)/i);
    if (planMatch) {
      data.plan = planMatch[1];
    }

    return data;
  },

  /**
   * Generic scraper for unknown pages
   */
  generic: function() {
    const data = {
      provider: 'Unknown',
      scrapedAt: new Date().toISOString(),
      pageUrl: window.location.href,
      pageTitle: document.title
    };

    const pageText = document.body.innerText;

    // Look for common patterns
    const dollarMatch = pageText.match(/\$[\d,.]+/g);
    if (dollarMatch) {
      data.monetaryValues = [...new Set(dollarMatch)].slice(0, 5);
    }

    const percentMatch = pageText.match(/([\d.]+)%/g);
    if (percentMatch) {
      data.percentages = [...new Set(percentMatch)].slice(0, 5);
    }

    return data;
  }
};

/**
 * Get scraper function code as string for injection
 */
function getScraperCode(providerId) {
  const scraper = SCRAPERS[providerId] || SCRAPERS.generic;
  return `(${scraper.toString()})()`;
}

/**
 * Detect which scraper to use based on URL
 */
function detectProvider(url) {
  const urlLower = url.toLowerCase();

  if (urlLower.includes('platform.claude.com') || urlLower.includes('console.anthropic.com')) {
    return 'anthropic';
  }
  if (urlLower.includes('platform.openai.com')) {
    return 'openai';
  }
  if (urlLower.includes('claude.ai')) {
    return 'claude-ai';
  }
  if (urlLower.includes('github.com')) {
    return 'github-copilot';
  }
  if (urlLower.includes('console.cloud.google.com')) {
    return 'google-cloud';
  }
  if (urlLower.includes('perplexity.ai')) {
    return 'perplexity';
  }

  return 'generic';
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SCRAPERS, getScraperCode, detectProvider };
} else if (typeof window !== 'undefined') {
  window.ScraperService = { SCRAPERS, getScraperCode, detectProvider };
}
