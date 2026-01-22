/**
 * OpenAI Platform Scraper
 * Scrapes usage data from platform.openai.com/usage
 *
 * Based on the user's screenshot, this page shows:
 * - Total Spend ($X)
 * - January budget ($X / $X)
 * - Resets in X days
 * - Total tokens
 * - Total requests
 * - Breakdown by category (Responses, Images, etc.)
 */

(function() {
  const PROVIDER_ID = 'openai';

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'scrape') {
      try {
        const data = scrapeOpenAIUsage();
        sendResponse({ success: true, provider: PROVIDER_ID, data });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }
    return true;
  });

  function scrapeOpenAIUsage() {
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

    // Budget: "$X / $Y" pattern
    const budgetMatch = pageText.match(/\$([\d,.]+)\s*\/\s*\$([\d,.]+)/);
    if (budgetMatch) {
      data.currentSpend = parseFloat(budgetMatch[1].replace(',', ''));
      data.budgetLimit = parseFloat(budgetMatch[2].replace(',', ''));
    }

    // Alternative: look for "January budget" or similar month pattern
    const monthBudgetMatch = pageText.match(/(\w+)\s+budget[\s\S]*?\$([\d,.]+)\s*\/\s*\$([\d,.]+)/i);
    if (monthBudgetMatch) {
      data.budgetMonth = monthBudgetMatch[1];
      data.currentSpend = parseFloat(monthBudgetMatch[2].replace(',', ''));
      data.budgetLimit = parseFloat(monthBudgetMatch[3].replace(',', ''));
    }

    // Resets in X days
    const resetMatch = pageText.match(/Resets\s+in\s+([\d]+)\s*days?/i);
    if (resetMatch) {
      data.resetInDays = parseInt(resetMatch[1]);
    }

    // Total tokens
    const tokensMatch = pageText.match(/Total\s+tokens[\s\S]*?([\d,]+)/i);
    if (tokensMatch) {
      data.totalTokens = parseInt(tokensMatch[1].replace(/,/g, ''));
    }

    // Total requests
    const requestsMatch = pageText.match(/Total\s+requests[\s\S]*?([\d,]+)/i);
    if (requestsMatch) {
      data.totalRequests = parseInt(requestsMatch[1].replace(/,/g, ''));
    }

    // Responses and Chat Completions
    const responsesMatch = pageText.match(/Responses\s+and\s+Chat\s+Completions[\s\S]*?([\d,]+)\s*requests/i);
    if (responsesMatch) {
      data.chatCompletionsRequests = parseInt(responsesMatch[1].replace(/,/g, ''));
    }

    // Images requests
    const imagesMatch = pageText.match(/Images[\s\S]*?([\d,]+)\s*(?:requests|images)/i);
    if (imagesMatch) {
      data.imagesRequests = parseInt(imagesMatch[1].replace(/,/g, ''));
    }

    // Embeddings requests
    const embeddingsMatch = pageText.match(/Embeddings[\s\S]*?([\d,]+)\s*requests/i);
    if (embeddingsMatch) {
      data.embeddingsRequests = parseInt(embeddingsMatch[1].replace(/,/g, ''));
    }

    // Try to get data from structured elements
    // Look for spend amounts
    const spendElements = document.querySelectorAll('[class*="spend"], [class*="cost"], [class*="total"]');
    spendElements.forEach(el => {
      const text = el.textContent;
      const dollarMatch = text.match(/\$([\d,.]+)/);
      if (dollarMatch && !data.totalSpend) {
        const val = parseFloat(dollarMatch[1].replace(',', ''));
        if (val > 0) data.totalSpend = val;
      }
    });

    // Calculate usage percentage if we have budget info
    if (data.currentSpend !== undefined && data.budgetLimit) {
      data.budgetUsagePercent = Math.round((data.currentSpend / data.budgetLimit) * 100);
    }

    return data;
  }
})();
