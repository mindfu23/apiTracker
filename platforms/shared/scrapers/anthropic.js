/**
 * Anthropic API Console Scraper - Core Logic
 * Platform-agnostic scraping functions for platform.claude.com/usage
 *
 * This module exports pure functions that can be used by:
 * - Browser extensions (Firefox, Chrome, Safari)
 * - Mobile app (Capacitor WebView)
 */

const PROVIDER_ID = 'anthropic';
const PROVIDER_NAME = 'Anthropic API';

/**
 * Scrape Anthropic usage data from the current page
 * @param {Document} doc - The document object to scrape from
 * @returns {Object} Scraped data object
 */
function scrapeAnthropicUsage(doc = document) {
  const data = {
    provider: PROVIDER_NAME,
    scrapedAt: new Date().toISOString(),
    pageUrl: doc.location?.href || ''
  };

  // Look for spending/balance info
  const balanceEl = doc.querySelector('[data-testid="credit-balance"], .credit-balance, [class*="balance"]');
  if (balanceEl) {
    const balanceText = balanceEl.textContent.trim();
    const balanceMatch = balanceText.match(/\$?([\d,.]+)/);
    if (balanceMatch) {
      data.creditBalance = parseFloat(balanceMatch[1].replace(',', ''));
    }
  }

  // Look for spending amount
  const spendingEls = doc.querySelectorAll('[class*="spend"], [class*="usage"], [class*="cost"]');
  spendingEls.forEach(el => {
    const text = el.textContent;
    if (text.includes('spent') || text.includes('used')) {
      const match = text.match(/\$?([\d,.]+)/);
      if (match) {
        data.amountSpent = parseFloat(match[1].replace(',', ''));
      }
    }
  });

  // Look for monthly limit
  const limitEls = doc.querySelectorAll('[class*="limit"], [class*="budget"]');
  limitEls.forEach(el => {
    const text = el.textContent;
    if (text.includes('limit') || text.includes('budget')) {
      const match = text.match(/\$?([\d,.]+)/);
      if (match) {
        data.monthlyLimit = parseFloat(match[1].replace(',', ''));
      }
    }
  });

  // Look for percentage indicators
  const percentEls = doc.querySelectorAll('[class*="progress"], [class*="percent"]');
  percentEls.forEach(el => {
    const text = el.textContent;
    const match = text.match(/([\d.]+)%/);
    if (match) {
      if (text.toLowerCase().includes('session')) {
        data.sessionUsagePercent = parseFloat(match[1]);
      } else if (text.toLowerCase().includes('week')) {
        data.weeklyUsagePercent = parseFloat(match[1]);
      } else {
        data.usagePercent = parseFloat(match[1]);
      }
    }
  });

  // Look for reset time
  const resetEls = doc.querySelectorAll('[class*="reset"], [class*="renew"]');
  resetEls.forEach(el => {
    const text = el.textContent;
    if (text.includes('Reset') || text.includes('Resets')) {
      data.resetInfo = text.trim();
    }
  });

  // Parse from visible text patterns
  const pageText = doc.body.innerText;

  // Pattern: "$X spent"
  const spentMatch = pageText.match(/\$([\d,.]+)\s*spent/i);
  if (spentMatch && !data.amountSpent) {
    data.amountSpent = parseFloat(spentMatch[1].replace(',', ''));
  }

  // Pattern: "X% used"
  const usedMatch = pageText.match(/([\d.]+)%\s*used/gi);
  if (usedMatch) {
    usedMatch.forEach(m => {
      const val = parseFloat(m.match(/([\d.]+)/)[1]);
      if (!data.usagePercent) data.usagePercent = val;
    });
  }

  // Pattern: "Resets in X"
  const resetMatch = pageText.match(/Resets?\s+(?:in\s+)?([\w\s\d]+)/i);
  if (resetMatch && !data.resetInfo) {
    data.resetInfo = `Resets ${resetMatch[1]}`;
  }

  // Pattern: Current balance
  const balanceMatch2 = pageText.match(/Current\s+balance[:\s]+\$([\d,.]+)/i);
  if (balanceMatch2 && !data.creditBalance) {
    data.creditBalance = parseFloat(balanceMatch2[1].replace(',', ''));
  }

  // Pattern: Monthly spending limit
  const limitMatch = pageText.match(/Monthly\s+spending\s+limit[:\s]+\$([\d,.]+)/i);
  if (limitMatch && !data.monthlyLimit) {
    data.monthlyLimit = parseFloat(limitMatch[1].replace(',', ''));
  }

  // Pattern: "API credits remaining: $X.XX"
  const creditsRemainingMatch = pageText.match(/API\s+credits?\s+remaining[:\s]*\$?([\d,.]+)/i);
  if (creditsRemainingMatch) {
    data.creditBalance = parseFloat(creditsRemainingMatch[1].replace(',', ''));
  }

  // Pattern: "credits remaining" without "API"
  const altCreditsMatch = pageText.match(/\$?([\d,.]+)\s+(?:credits?)?\s*remaining/i);
  if (altCreditsMatch && !data.creditBalance) {
    data.creditBalance = parseFloat(altCreditsMatch[1].replace(',', ''));
  }

  // Pattern: Total usage/spending
  const totalUsageMatch = pageText.match(/Total\s+(?:usage|spending|cost)[:\s]*\$?([\d,.]+)/i);
  if (totalUsageMatch) {
    data.totalSpending = parseFloat(totalUsageMatch[1].replace(',', ''));
  }

  // Pattern: "This month: $X.XX"
  const thisMonthMatch = pageText.match(/This\s+month[:\s]*\$?([\d,.]+)/i);
  if (thisMonthMatch) {
    data.thisMonthSpend = parseFloat(thisMonthMatch[1].replace(',', ''));
  }

  // Pattern: Usage tier
  const tierMatch = pageText.match(/(?:Usage\s+)?[Tt]ier[:\s]*(\d+)/i);
  if (tierMatch) {
    data.usageTier = parseInt(tierMatch[1]);
  }

  // Pattern: Rate limit info
  const rateLimitMatch = pageText.match(/Rate\s+limit[:\s]*([\d,]+)\s*(?:requests?|RPM)/i);
  if (rateLimitMatch) {
    data.rateLimit = parseInt(rateLimitMatch[1].replace(',', ''));
  }

  // Model-specific usage
  const modelPatterns = [
    /claude[- ]?3[- ]?5?[- ]?(?:opus|sonnet|haiku)[:\s]*\$?([\d,.]+)/gi,
    /claude[- ]?(?:opus|sonnet|haiku)[- ]?[\d.]*[:\s]*\$?([\d,.]+)/gi
  ];

  data.modelUsage = {};
  modelPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(pageText)) !== null) {
      const modelName = match[0].split(/[:\s]/)[0].trim();
      const amount = parseFloat(match[1].replace(',', ''));
      if (!isNaN(amount)) {
        data.modelUsage[modelName] = amount;
      }
    }
  });

  if (Object.keys(data.modelUsage).length === 0) {
    delete data.modelUsage;
  }

  // Look for usage tables
  const tables = doc.querySelectorAll('table');
  tables.forEach(table => {
    const headerRow = table.querySelector('tr');
    if (headerRow) {
      const headerText = headerRow.textContent.toLowerCase();
      if (headerText.includes('model') || headerText.includes('cost') || headerText.includes('usage')) {
        const rows = table.querySelectorAll('tr');
        const usageData = [];
        rows.forEach((row, idx) => {
          if (idx === 0) return;
          const cells = row.querySelectorAll('td');
          if (cells.length >= 2) {
            usageData.push({
              model: cells[0]?.textContent?.trim(),
              value: cells[1]?.textContent?.trim()
            });
          }
        });
        if (usageData.length > 0) {
          data.usageBreakdown = usageData;
        }
      }
    }
  });

  // Token usage patterns
  const tokensInMatch = pageText.match(/Total\s+tokens\s+in[:\s]*([\d,]+)/i);
  if (tokensInMatch) {
    data.tokensIn = parseInt(tokensInMatch[1].replace(/,/g, ''));
  }

  const tokensOutMatch = pageText.match(/Total\s+tokens\s+out[:\s]*([\d,]+)/i);
  if (tokensOutMatch) {
    data.tokensOut = parseInt(tokensOutMatch[1].replace(/,/g, ''));
  }

  if (data.tokensIn !== undefined && data.tokensOut !== undefined) {
    data.totalTokens = data.tokensIn + data.tokensOut;
  }

  const webSearchMatch = pageText.match(/Total\s+web\s+searches[:\s]*([\d,]+)/i);
  if (webSearchMatch) {
    data.webSearches = parseInt(webSearchMatch[1].replace(/,/g, ''));
  }

  // Look for token numbers in card-like elements
  const allElements = doc.querySelectorAll('*');
  allElements.forEach(el => {
    const text = el.textContent?.trim();
    if (!text) return;

    if (text === 'Total tokens in' || text === 'Total tokens out' || text === 'Total web searches') {
      const parent = el.parentElement;
      if (parent) {
        const parentText = parent.textContent;
        const numMatch = parentText.match(/(?:Total\s+tokens\s+(?:in|out)|Total\s+web\s+searches)[^\d]*([\d,]+)/i);
        if (numMatch) {
          const value = parseInt(numMatch[1].replace(/,/g, ''));
          if (text.includes('tokens in') && !data.tokensIn) {
            data.tokensIn = value;
          } else if (text.includes('tokens out') && !data.tokensOut) {
            data.tokensOut = value;
          } else if (text.includes('web searches') && !data.webSearches) {
            data.webSearches = value;
          }
        }
      }
    }
  });

  if (data.tokensIn !== undefined && data.tokensOut !== undefined && !data.totalTokens) {
    data.totalTokens = data.tokensIn + data.tokensOut;
  }

  return data;
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PROVIDER_ID, PROVIDER_NAME, scrapeAnthropicUsage };
} else if (typeof window !== 'undefined') {
  window.AnthropicScraper = { PROVIDER_ID, PROVIDER_NAME, scrapeAnthropicUsage };
}
