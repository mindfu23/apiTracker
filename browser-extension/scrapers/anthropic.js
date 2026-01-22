/**
 * Anthropic Console Scraper
 * Scrapes usage data from console.anthropic.com/settings/usage
 */

(function() {
  const PROVIDER_ID = 'anthropic';

  // Listen for scrape requests from popup
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'scrape') {
      try {
        const data = scrapeAnthropicUsage();
        sendResponse({ success: true, provider: PROVIDER_ID, data });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }
    return true;
  });

  function scrapeAnthropicUsage() {
    const data = {
      provider: 'Anthropic',
      scrapedAt: new Date().toISOString(),
      pageUrl: window.location.href
    };

    // Try to find usage elements on the page
    // The exact selectors may need adjustment based on Anthropic's current UI

    // Look for spending/balance info
    const balanceEl = document.querySelector('[data-testid="credit-balance"], .credit-balance, [class*="balance"]');
    if (balanceEl) {
      const balanceText = balanceEl.textContent.trim();
      const balanceMatch = balanceText.match(/\$?([\d,.]+)/);
      if (balanceMatch) {
        data.creditBalance = parseFloat(balanceMatch[1].replace(',', ''));
      }
    }

    // Look for spending amount
    const spendingEls = document.querySelectorAll('[class*="spend"], [class*="usage"], [class*="cost"]');
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
    const limitEls = document.querySelectorAll('[class*="limit"], [class*="budget"]');
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
    const percentEls = document.querySelectorAll('[class*="progress"], [class*="percent"]');
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
    const resetEls = document.querySelectorAll('[class*="reset"], [class*="renew"]');
    resetEls.forEach(el => {
      const text = el.textContent;
      if (text.includes('Reset') || text.includes('Resets')) {
        data.resetInfo = text.trim();
      }
    });

    // Alternative: Parse from visible text patterns
    const pageText = document.body.innerText;

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

    return data;
  }
})();
