/**
 * Generic Page Scraper
 * Attempts to extract billing/usage data from any page
 * Uses pattern matching to find common billing-related information
 *
 * NOTE: This scraper should NOT run on pages that have dedicated scrapers.
 * It checks the URL against known provider patterns and skips those pages.
 */

(function() {
  const PROVIDER_ID = 'generic';

  // URLs that have dedicated scrapers - don't run generic on these
  const KNOWN_PROVIDER_URLS = [
    'platform.claude.com',
    'console.anthropic.com',
    'platform.openai.com',
    'github.com/settings/billing',
    'claude.ai/settings',
    'console.cloud.google.com',
    'perplexity.ai/account',
    'perplexity.ai/settings'
  ];

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'scrape') {
      try {
        const currentUrl = window.location.href;

        // Check if this page has a dedicated scraper
        const hasKnownScraper = KNOWN_PROVIDER_URLS.some(url => currentUrl.includes(url));
        if (hasKnownScraper) {
          // Let the dedicated scraper handle this page
          // Return a non-success to indicate this scraper shouldn't be used
          sendResponse({ success: false, error: 'Page handled by dedicated scraper' });
          return true;
        }

        // Pass custom search term if provided
        const customSearchTerm = message.searchTerm || null;
        const data = scrapeGenericPage(customSearchTerm);
        sendResponse({ success: true, provider: data.detectedProvider || PROVIDER_ID, data });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }
    return true;
  });

  function scrapeGenericPage(customSearchTerm = null) {
    const data = {
      provider: 'Unknown',
      scrapedAt: new Date().toISOString(),
      pageUrl: window.location.href,
      pageTitle: document.title
    };

    const pageText = document.body.innerText;
    const hostname = window.location.hostname;

    // If a custom search term was provided, scan for it
    if (customSearchTerm) {
      data.customSearchTerm = customSearchTerm;
      const termLower = customSearchTerm.toLowerCase();
      const lines = pageText.split('\n');

      // Find lines containing the search term
      const matchingLines = [];
      lines.forEach((line, idx) => {
        if (line.toLowerCase().includes(termLower)) {
          const trimmed = line.trim();
          if (trimmed.length > 0 && trimmed.length < 200) {
            matchingLines.push(trimmed);
          }
        }
      });

      if (matchingLines.length > 0) {
        data.customTermMatches = matchingLines.slice(0, 10); // Limit to 10 matches
      }

      // Try to extract numbers near the search term
      // Pattern: "searchTerm: X" or "searchTerm X" or "X searchTerm"
      const numPatterns = [
        new RegExp(`${customSearchTerm}[:\\s]*([\\d,]+\\.?\\d*)`, 'i'),
        new RegExp(`([\\d,]+\\.?\\d*)\\s*${customSearchTerm}`, 'i'),
        new RegExp(`${customSearchTerm}[^\\d]*([\\d,]+\\.?\\d*)`, 'i')
      ];

      for (const pattern of numPatterns) {
        const match = pageText.match(pattern);
        if (match && match[1]) {
          const numVal = parseFloat(match[1].replace(/,/g, ''));
          if (!isNaN(numVal)) {
            data.customTermValue = numVal;
            break;
          }
        }
      }
    }

    // Try to detect provider from hostname
    // Map to the correct provider IDs used by dedicated scrapers
    const providerPatterns = {
      'anthropic': /anthropic/i,
      'openai': /openai/i,
      'google-cloud': /cloud\.google/i,
      'github-copilot': /github/i,
      'perplexity': /perplexity/i,
      'claude-ai': /claude\.ai/i,
      'cohere': /cohere/i,
      'huggingface': /huggingface|hugging/i,
      'groq': /groq/i,
      'mistral': /mistral/i,
      'together': /together\.ai|togetherai/i,
      'replicate': /replicate/i,
      'aws': /aws|amazon/i,
      'azure': /azure|microsoft/i
    };

    for (const [providerId, pattern] of Object.entries(providerPatterns)) {
      if (pattern.test(hostname) || pattern.test(document.title)) {
        data.detectedProvider = providerId;
        // Create a display name from the ID
        data.provider = providerId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        break;
      }
    }

    // Extract monetary values
    const moneyPatterns = [
      // "$X.XX" or "$X,XXX.XX"
      /\$[\d,]+\.?\d*/g,
      // "X.XX USD" or "X,XXX.XX USD"
      /[\d,]+\.?\d*\s*(?:USD|EUR|GBP)/gi
    ];

    const moneyMatches = [];
    moneyPatterns.forEach(pattern => {
      const matches = pageText.match(pattern);
      if (matches) {
        moneyMatches.push(...matches);
      }
    });

    if (moneyMatches.length > 0) {
      data.monetaryValues = [...new Set(moneyMatches)].slice(0, 10);
    }

    // Look for specific billing patterns
    const billingPatterns = {
      // Balance patterns
      balance: [
        /(?:balance|remaining|available)[:\s]*\$?([\d,]+\.?\d*)/i,
        /\$?([\d,]+\.?\d*)\s*(?:remaining|available|balance)/i
      ],
      // Spend/cost patterns
      spend: [
        /(?:total\s+)?(?:spend|spent|cost|charge)[:\s]*\$?([\d,]+\.?\d*)/i,
        /\$?([\d,]+\.?\d*)\s*(?:spent|total\s+cost)/i
      ],
      // Usage patterns
      usage: [
        /(?:usage|used)[:\s]*([\d,]+\.?\d*)\s*(?:of|\/)\s*([\d,]+)/i,
        /([\d,]+\.?\d*)\s*(?:of|\/)\s*([\d,]+)\s*(?:used|requests|tokens|credits)/i
      ],
      // Credit patterns
      credits: [
        /(?:credits?)[:\s]*\$?([\d,]+\.?\d*)/i,
        /\$?([\d,]+\.?\d*)\s*(?:credits?)/i
      ],
      // Budget patterns
      budget: [
        /(?:budget|limit)[:\s]*\$?([\d,]+\.?\d*)/i,
        /\$?([\d,]+\.?\d*)\s*(?:budget|limit)/i
      ],
      // Request count patterns
      requests: [
        /([\d,]+)\s*(?:requests?|calls?|queries?)/i,
        /(?:requests?|calls?|queries?)[:\s]*([\d,]+)/i
      ],
      // Token patterns
      tokens: [
        /([\d,]+)\s*(?:tokens?)/i,
        /(?:tokens?)[:\s]*([\d,]+)/i
      ],
      // Subscription/plan patterns
      plan: [
        /(?:plan|tier|subscription)[:\s]*([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i,
        /([a-zA-Z]+)\s*(?:plan|tier|subscription)/i
      ],
      // Reset/renewal patterns
      reset: [
        /(?:resets?|renews?)\s*(?:in|on)\s*([\d]+)\s*(?:days?|hours?)/i,
        /(?:resets?|renews?)\s*(?:on)?\s*([A-Za-z]+\s+\d+)/i
      ],
      // Percentage patterns
      percent: [
        /([\d.]+)%\s*(?:used|consumed|of)/i,
        /(?:used|consumed)[:\s]*([\d.]+)%/i
      ]
    };

    // Apply patterns and extract data
    for (const [key, patterns] of Object.entries(billingPatterns)) {
      for (const pattern of patterns) {
        const match = pageText.match(pattern);
        if (match) {
          if (key === 'usage' && match[1] && match[2]) {
            data.usageUsed = parseFloat(match[1].replace(/,/g, ''));
            data.usageLimit = parseFloat(match[2].replace(/,/g, ''));
            data.usagePercent = Math.round((data.usageUsed / data.usageLimit) * 100);
          } else if (match[1]) {
            const value = match[1].replace(/,/g, '');
            if (key === 'plan') {
              data[key] = match[1].trim();
            } else if (key === 'reset') {
              data.resetInfo = match[1].trim();
            } else {
              const numVal = parseFloat(value);
              if (!isNaN(numVal)) {
                data[key] = numVal;
              } else {
                data[key] = match[1].trim();
              }
            }
          }
          break;
        }
      }
    }

    // Look for tables with billing data
    const tables = document.querySelectorAll('table');
    tables.forEach((table, idx) => {
      const tableText = table.innerText.toLowerCase();
      if (tableText.includes('usage') || tableText.includes('cost') ||
          tableText.includes('request') || tableText.includes('token') ||
          tableText.includes('model')) {
        // This might be a usage table
        const rows = table.querySelectorAll('tr');
        const tableData = [];
        rows.forEach(row => {
          const cells = row.querySelectorAll('td, th');
          if (cells.length >= 2) {
            const rowData = Array.from(cells).map(c => c.textContent.trim());
            tableData.push(rowData);
          }
        });
        if (tableData.length > 0) {
          data[`table_${idx}`] = tableData.slice(0, 20); // Limit to 20 rows
        }
      }
    });

    // Extract any visible progress bars
    const progressElements = document.querySelectorAll('[role="progressbar"], progress, .progress, [class*="progress"]');
    progressElements.forEach((el, idx) => {
      const value = el.getAttribute('aria-valuenow') || el.value;
      const max = el.getAttribute('aria-valuemax') || el.max;
      if (value !== null) {
        data[`progress_${idx}`] = {
          value: parseFloat(value),
          max: max ? parseFloat(max) : 100
        };
      }
    });

    return data;
  }
})();
