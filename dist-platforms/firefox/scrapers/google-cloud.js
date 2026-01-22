/**
 * Google Cloud Console Scraper
 * Scrapes billing data from console.cloud.google.com
 *
 * Based on the user's screenshot, this shows:
 * - "$X out of $Y credits used"
 * - "Expires DATE"
 * - Full account activation status
 */

(function() {
  const PROVIDER_ID = 'google-cloud';

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'scrape') {
      try {
        const data = scrapeGoogleCloudUsage();
        sendResponse({ success: true, provider: PROVIDER_ID, data });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }
    return true;
  });

  function scrapeGoogleCloudUsage() {
    const data = {
      provider: 'Google Cloud',
      scrapedAt: new Date().toISOString(),
      pageUrl: window.location.href
    };

    const pageText = document.body.innerText;

    // Credits usage: "$X out of $Y credits used"
    const creditsMatch = pageText.match(/\$([\d,.]+)\s+out\s+of\s+\$([\d,.]+)\s+credits?\s+used/i);
    if (creditsMatch) {
      data.creditsUsed = parseFloat(creditsMatch[1].replace(',', ''));
      data.creditsTotal = parseFloat(creditsMatch[2].replace(',', ''));
      data.creditsRemaining = data.creditsTotal - data.creditsUsed;
      data.creditsUsagePercent = Math.round((data.creditsUsed / data.creditsTotal) * 100);
    }

    // Alternative: "X / Y" pattern
    if (!data.creditsUsed) {
      const altCreditsMatch = pageText.match(/\$([\d,.]+)\s*\/\s*\$([\d,.]+)\s*credits?/i);
      if (altCreditsMatch) {
        data.creditsUsed = parseFloat(altCreditsMatch[1].replace(',', ''));
        data.creditsTotal = parseFloat(altCreditsMatch[2].replace(',', ''));
        data.creditsRemaining = data.creditsTotal - data.creditsUsed;
      }
    }

    // Expiration date
    const expiresMatch = pageText.match(/Expires?\s+([\w\s\d,]+\d{4})/i);
    if (expiresMatch) {
      data.expirationDate = expiresMatch[1].trim();
    }

    // Account type
    if (pageText.includes('full account')) {
      data.accountType = 'Full Account';
    } else if (pageText.includes('trial')) {
      data.accountType = 'Trial';
    } else if (pageText.includes('free tier')) {
      data.accountType = 'Free Tier';
    }

    // Current project
    const projectMatch = pageText.match(/(?:working\s+on\s+)?project\s+([\w\s-]+?)(?:\s+Number|\s+ID|$)/i);
    if (projectMatch) {
      data.currentProject = projectMatch[1].trim();
    }

    // Project ID
    const projectIdMatch = pageText.match(/ID:\s*([\w-]+)/i);
    if (projectIdMatch) {
      data.projectId = projectIdMatch[1];
    }

    // Look for billing account info on billing pages
    const billingAmountMatch = pageText.match(/Current\s+(?:month|billing)[:\s]+\$([\d,.]+)/i);
    if (billingAmountMatch) {
      data.currentBillingAmount = parseFloat(billingAmountMatch[1].replace(',', ''));
    }

    // Budget info
    const budgetMatch = pageText.match(/Budget[:\s]+\$([\d,.]+)/i);
    if (budgetMatch) {
      data.budget = parseFloat(budgetMatch[1].replace(',', ''));
    }

    // Vertex AI / Gemini specific
    const geminiMatch = pageText.match(/Gemini\s+API[\s\S]*?\$([\d,.]+)/i);
    if (geminiMatch) {
      data.geminiSpend = parseFloat(geminiMatch[1].replace(',', ''));
    }

    return data;
  }
})();
