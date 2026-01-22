/**
 * Claude.ai Usage Scraper
 * Scrapes usage data from claude.ai/settings (Usage tab)
 *
 * Based on the user's screenshot, this page shows:
 * - Plan usage limits (Current session: X% used, resets in Xh Xm)
 * - Weekly limits (All models: X% used, Sonnet only: X% used)
 * - Extra usage ($X spent, resets date, monthly spending limit)
 */

(function() {
  const PROVIDER_ID = 'claude-ai';

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'scrape') {
      try {
        const data = scrapeClaudeAiUsage();
        sendResponse({ success: true, provider: PROVIDER_ID, data });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }
    return true;
  });

  function scrapeClaudeAiUsage() {
    const data = {
      provider: 'Claude.ai',
      scrapedAt: new Date().toISOString(),
      pageUrl: window.location.href
    };

    const pageText = document.body.innerText;

    // Plan usage limits section
    // Pattern: "Current session" + "Resets in Xh Xm" + "X% used"
    const sessionResetMatch = pageText.match(/Current\s+session[\s\S]*?Resets\s+in\s+([\d]+\s*h(?:r)?\s*[\d]*\s*m(?:in)?)/i);
    if (sessionResetMatch) {
      data.sessionResetIn = sessionResetMatch[1].trim();
    }

    // Session percentage
    const sessionPercentMatch = pageText.match(/Current\s+session[\s\S]*?([\d]+)%\s*used/i);
    if (sessionPercentMatch) {
      data.sessionUsagePercent = parseInt(sessionPercentMatch[1]);
    }

    // Weekly limits section
    // Pattern: "Weekly limits" + "All models" + "X% used"
    const weeklyAllModelsMatch = pageText.match(/All\s+models[\s\S]*?Resets\s+([\w\s\d:]+?)[\s\S]*?([\d]+)%\s*used/i);
    if (weeklyAllModelsMatch) {
      data.weeklyResetTime = weeklyAllModelsMatch[1].trim();
      data.weeklyAllModelsPercent = parseInt(weeklyAllModelsMatch[2]);
    }

    // Sonnet only percentage
    const sonnetMatch = pageText.match(/Sonnet\s+only[\s\S]*?([\d]+)%\s*used/i);
    if (sonnetMatch) {
      data.weeklySonnetPercent = parseInt(sonnetMatch[1]);
    }

    // Extra usage section
    // Pattern: "$X spent" + "Resets DATE" + "X% used"
    const extraSpentMatch = pageText.match(/\$([\d,.]+)\s*spent/i);
    if (extraSpentMatch) {
      data.extraUsageSpent = parseFloat(extraSpentMatch[1].replace(',', ''));
    }

    // Extra usage reset date
    const extraResetMatch = pageText.match(/Extra\s+usage[\s\S]*?Resets\s+([\w\s\d]+)/i);
    if (extraResetMatch) {
      data.extraUsageResetDate = extraResetMatch[1].trim();
    }

    // Extra usage percentage
    const extraPercentMatch = pageText.match(/Extra\s+usage[\s\S]*?([\d]+)%\s*used/i);
    if (extraPercentMatch) {
      data.extraUsagePercent = parseInt(extraPercentMatch[1]);
    }

    // Monthly spending limit
    const monthlyLimitMatch = pageText.match(/Monthly\s+spending\s+limit[:\s]*\$([\d,.]+)/i);
    if (monthlyLimitMatch) {
      data.monthlySpendingLimit = parseFloat(monthlyLimitMatch[1].replace(',', ''));
    }

    // Current balance
    const balanceMatch = pageText.match(/Current\s+balance[:\s]*\$([\d,.]+)/i);
    if (balanceMatch) {
      data.currentBalance = parseFloat(balanceMatch[1].replace(',', ''));
    }

    // Alternative: Try to parse from specific elements if text parsing fails
    // Look for progress bars
    const progressBars = document.querySelectorAll('[role="progressbar"], [class*="progress"]');
    progressBars.forEach((bar, index) => {
      const ariaValue = bar.getAttribute('aria-valuenow');
      const style = bar.style.width || bar.querySelector('[style*="width"]')?.style.width;

      if (ariaValue) {
        const val = parseFloat(ariaValue);
        if (index === 0 && !data.sessionUsagePercent) data.sessionUsagePercent = val;
        else if (index === 1 && !data.weeklyAllModelsPercent) data.weeklyAllModelsPercent = val;
      } else if (style) {
        const match = style.match(/([\d.]+)%/);
        if (match) {
          const val = parseFloat(match[1]);
          if (index === 0 && !data.sessionUsagePercent) data.sessionUsagePercent = val;
        }
      }
    });

    return data;
  }
})();
