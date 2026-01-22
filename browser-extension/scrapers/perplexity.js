/**
 * Perplexity API Billing Scraper
 * Scrapes from perplexity.ai/settings/api (API billing page)
 *
 * Based on the user's screenshot, this shows:
 * - Credit balance: "$X remaining"
 * - Payment method
 * - Auto reload status
 * - Usage tier
 * - Promotions (monthly Pro credit)
 * - Usage chart by model (sonar, sonar-pro)
 */

(function() {
  const PROVIDER_ID = 'perplexity';

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

    return data;
  }
})();
