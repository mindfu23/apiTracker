/**
 * Perplexity API Billing Scraper
 * Scrapes from perplexity.ai/account/api or perplexity.ai/account/api/group
 *
 * Based on the user's screenshot, this shows:
 * - Credit balance: "$X.XX remaining" or "$X.XX"
 * - Payment method
 * - Auto reload status
 * - Usage tier
 * - Promotions (monthly Pro credit)
 * - Usage chart by model (sonar, sonar-pro)
 */

(function() {
  const PROVIDER_ID = 'perplexity';

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'scrape') {
      try {
        const data = scrapePerplexityUsage();
        sendResponse({ success: true, provider: PROVIDER_ID, data });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }
    return true;
  });

  function scrapePerplexityUsage() {
    const data = {
      provider: 'Perplexity',
      scrapedAt: new Date().toISOString(),
      pageUrl: window.location.href
    };

    const pageText = document.body.innerText;
    const currentPath = window.location.pathname;

    // Credit balance: "$X remaining"
    const balanceMatch = pageText.match(/\$([\d,.]+)\s+remaining/i);
    if (balanceMatch) {
      data.creditBalance = parseFloat(balanceMatch[1].replace(',', ''));
    }

    // Alternative: "Credit balance" section
    const altBalanceMatch = pageText.match(/Credit\s+balance[\s\S]*?\$([\d,.]+)/i);
    if (altBalanceMatch && !data.creditBalance) {
      data.creditBalance = parseFloat(altBalanceMatch[1].replace(',', ''));
    }

    // Usage tier
    const tierMatch = pageText.match(/Usage\s+tier[:\s]+(\d+)/i);
    if (tierMatch) {
      data.usageTier = parseInt(tierMatch[1]);
    }

    // Promotions / monthly credit
    const promoMatch = pageText.match(/\$([\d,.]+)\s+monthly\s+(?:Pro\s+)?credit/i);
    if (promoMatch) {
      data.monthlyCredit = parseFloat(promoMatch[1].replace(',', ''));
    }

    // Auto reload status
    if (pageText.toLowerCase().includes('auto reload')) {
      data.autoReload = pageText.toLowerCase().includes('enabled') ? 'Enabled' : 'Disabled';
    }

    // Try to parse API usage stats
    // Look for request counts
    const requestsMatch = pageText.match(/Chat\s+Completions?\s+API\s+Requests?[\s\S]*?Last\s+30\s+Days/i);
    if (requestsMatch) {
      data.apiRequestsSection = true;
    }

    // Model usage from chart legend
    const sonarMatch = pageText.match(/sonar[:\s]+(\d+)/i);
    if (sonarMatch) {
      data.sonarRequests = parseInt(sonarMatch[1]);
    }

    const sonarProMatch = pageText.match(/sonar-pro[:\s]+(\d+)/i);
    if (sonarProMatch) {
      data.sonarProRequests = parseInt(sonarProMatch[1]);
    }

    // Total requests (sum if we have breakdown)
    if (data.sonarRequests || data.sonarProRequests) {
      data.totalRequests = (data.sonarRequests || 0) + (data.sonarProRequests || 0);
    }

    // Look for spending info
    const spendMatch = pageText.match(/(?:Total\s+)?(?:spend|spent)[:\s]+\$([\d,.]+)/i);
    if (spendMatch) {
      data.totalSpend = parseFloat(spendMatch[1].replace(',', ''));
    }

    // Pro subscription info
    if (pageText.includes('Pro Perks') || pageText.includes('Pro subscription')) {
      data.subscriptionType = 'Pro';
    }

    // Additional patterns for /account/api and /account/api/group pages

    // Pattern: Just "$X.XX" near credit/balance text
    const simpleBalanceMatch = pageText.match(/(?:credit|balance|remaining)[^$]*\$([0-9]+(?:\.[0-9]{2})?)/i);
    if (simpleBalanceMatch && !data.creditBalance) {
      data.creditBalance = parseFloat(simpleBalanceMatch[1]);
    }

    // Pattern: API key status
    if (pageText.toLowerCase().includes('api key') || pageText.toLowerCase().includes('api keys')) {
      data.hasApiKey = true;
    }

    // Pattern: Group info (for /account/api/group page)
    if (currentPath.includes('/group')) {
      const groupNameMatch = pageText.match(/(?:Group|Team|Organization)[:\s]+([^\n]+)/i);
      if (groupNameMatch) {
        data.groupName = groupNameMatch[1].trim();
      }
    }

    // Pattern: Monthly limit
    const monthlyLimitMatch = pageText.match(/(?:monthly|month)\s+(?:limit|cap)[:\s]*\$?([0-9,]+(?:\.[0-9]{2})?)/i);
    if (monthlyLimitMatch) {
      data.monthlyLimit = parseFloat(monthlyLimitMatch[1].replace(',', ''));
    }

    // Pattern: Usage this month
    const monthUsageMatch = pageText.match(/(?:this\s+month|current\s+month)[:\s]*\$?([0-9,]+(?:\.[0-9]{2})?)/i);
    if (monthUsageMatch) {
      data.usageThisMonth = parseFloat(monthUsageMatch[1].replace(',', ''));
    }

    // Look for any dollar amounts on the page and categorize them
    const allDollarAmounts = pageText.match(/\$[0-9,]+(?:\.[0-9]{2})?/g);
    if (allDollarAmounts && allDollarAmounts.length > 0) {
      data.foundAmounts = allDollarAmounts.slice(0, 5).map(a => parseFloat(a.replace(/[$,]/g, '')));
    }

    // Pattern: Requests count
    const requestsCountMatch = pageText.match(/([0-9,]+)\s*(?:total\s+)?requests?/i);
    if (requestsCountMatch) {
      data.totalRequests = parseInt(requestsCountMatch[1].replace(',', ''));
    }

    // Pattern: API calls
    const apiCallsMatch = pageText.match(/([0-9,]+)\s*(?:api\s+)?calls?/i);
    if (apiCallsMatch && !data.totalRequests) {
      data.totalRequests = parseInt(apiCallsMatch[1].replace(',', ''));
    }

    return data;
  }
})();
