/**
 * GitHub Copilot Premium Usage Scraper
 * Scrapes from github.com/settings/billing/premium_requests_usage
 *
 * Based on the user's screenshot, this page shows:
 * - Billed premium requests ($X)
 * - Included premium requests consumed (X of Y included)
 * - Monthly limit resets in X days on DATE
 * - Usage breakdown by model (Claude Opus 4.5, Gemini 3 Pro, etc.)
 */

(function() {
  const PROVIDER_ID = 'github-copilot';

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'scrape') {
      try {
        const data = scrapeGitHubCopilotUsage();
        sendResponse({ success: true, provider: PROVIDER_ID, data });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }
    return true;
  });

  function scrapeGitHubCopilotUsage() {
    const data = {
      provider: 'GitHub Copilot',
      scrapedAt: new Date().toISOString(),
      pageUrl: window.location.href
    };

    const pageText = document.body.innerText;

    // Billed premium requests amount
    const billedMatch = pageText.match(/Billed\s+premium\s+requests[\s\S]*?\$([\d,.]+)/i);
    if (billedMatch) {
      data.billedAmount = parseFloat(billedMatch[1].replace(',', ''));
    }

    // Included premium requests consumed: "X of Y included"
    const includedMatch = pageText.match(/Included\s+premium\s+requests\s+consumed[\s\S]*?([\d,.]+)[\s\S]*?of\s+([\d,]+)\s+included/i);
    if (includedMatch) {
      data.includedUsed = parseFloat(includedMatch[1].replace(',', ''));
      data.includedLimit = parseInt(includedMatch[2].replace(',', ''));
      data.includedUsagePercent = Math.round((data.includedUsed / data.includedLimit) * 100);
    }

    // Alternative simpler pattern: "X of Y included"
    if (!data.includedLimit) {
      const simpleIncludedMatch = pageText.match(/([\d,.]+)\s+of\s+([\d,]+)\s+included/i);
      if (simpleIncludedMatch) {
        data.includedUsed = parseFloat(simpleIncludedMatch[1].replace(',', ''));
        data.includedLimit = parseInt(simpleIncludedMatch[2].replace(',', ''));
        data.includedUsagePercent = Math.round((data.includedUsed / data.includedLimit) * 100);
      }
    }

    // Monthly limit resets: "resets in X days on DATE"
    const resetMatch = pageText.match(/(?:Monthly\s+limit\s+)?[Rr]esets\s+in\s+([\d]+)\s*days?\s+on\s+([\w\s\d,]+)/i);
    if (resetMatch) {
      data.resetInDays = parseInt(resetMatch[1]);
      data.resetDate = resetMatch[2].trim();
    }

    // Price per premium request
    const priceMatch = pageText.match(/Price\s+per\s+premium\s+request[:\s]+\$([\d.]+)/i);
    if (priceMatch) {
      data.pricePerRequest = parseFloat(priceMatch[1]);
    }

    // Usage breakdown by model
    data.modelBreakdown = [];

    // Look for table rows with model data
    // Pattern: "Model Name" | "X" (included) | "Y" (billed) | "$Z" | "$W"
    const tableRows = document.querySelectorAll('table tr, [role="row"]');
    tableRows.forEach(row => {
      const cells = row.querySelectorAll('td, [role="cell"]');
      if (cells.length >= 4) {
        const modelName = cells[0]?.textContent?.trim();
        const includedRequests = cells[1]?.textContent?.trim();
        const billedRequests = cells[2]?.textContent?.trim();

        if (modelName && !modelName.toLowerCase().includes('model')) {
          const modelData = {
            model: modelName,
            includedRequests: parseFloat(includedRequests?.replace(',', '')) || 0,
            billedRequests: parseInt(billedRequests?.replace(',', '')) || 0
          };

          // Only add if we got real data
          if (modelData.includedRequests > 0 || modelData.billedRequests > 0) {
            data.modelBreakdown.push(modelData);
          }
        }
      }
    });

    // Alternative: parse model breakdown from text
    // Pattern: "Claude Opus 4.5    1,473    177    $66.00    $7.08"
    const modelPatterns = [
      /Claude\s+(?:Opus|Sonnet)\s+[\d.]+/gi,
      /Gemini\s+\d+\s+(?:Pro|Flash)/gi,
      /GPT-[\d.]+[-\w]*/gi,
      /Coding\s+Agent\s+model/gi
    ];

    if (data.modelBreakdown.length === 0) {
      modelPatterns.forEach(pattern => {
        const matches = pageText.match(pattern);
        if (matches) {
          matches.forEach(modelName => {
            // Try to find the numbers after the model name
            const modelRegex = new RegExp(modelName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '[\\s\\S]*?([\\d,.]+)\\s+([\\d,]+)', 'i');
            const modelMatch = pageText.match(modelRegex);
            if (modelMatch) {
              data.modelBreakdown.push({
                model: modelName,
                includedRequests: parseFloat(modelMatch[1].replace(',', '')) || 0,
                billedRequests: parseInt(modelMatch[2].replace(',', '')) || 0
              });
            }
          });
        }
      });
    }

    // Copilot plan info
    const planMatch = pageText.match(/(?:Copilot|Premium\s+requests\s+included\s+in\s+your)\s+([\w\s]+)\s+plan/i);
    if (planMatch) {
      data.plan = planMatch[1].trim();
    }

    return data;
  }
})();
