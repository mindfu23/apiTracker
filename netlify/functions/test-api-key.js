// Netlify function to test API keys and fetch usage/limits
// This proxies requests to avoid CORS issues in the browser

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { provider, apiKey } = body;

  if (!provider || !apiKey) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Provider and apiKey required' }) };
  }

  try {
    const result = await testProvider(provider.toLowerCase(), apiKey);
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (error) {
    console.error(`Error testing ${provider}:`, error);
    return { 
      statusCode: 200, 
      headers, 
      body: JSON.stringify({ 
        valid: false, 
        error: error.message || 'Failed to validate key'
      }) 
    };
  }
};

async function testProvider(provider, apiKey) {
  switch (provider) {
    case 'openai':
      return await testOpenAI(apiKey);
    case 'anthropic':
      return await testAnthropic(apiKey);
    case 'gemini':
    case 'google':
      return await testGemini(apiKey);
    case 'huggingface':
      return await testHuggingFace(apiKey);
    case 'perplexity':
      return await testPerplexity(apiKey);
    case 'groq':
      return await testGroq(apiKey);
    case 'cohere':
      return await testCohere(apiKey);
    case 'github copilot':
    case 'github-copilot':
    case 'github':
      return await testGitHubCopilot(apiKey);
    default:
      return {
        valid: null,
        message: 'Unknown provider - cannot auto-detect limits. Please enter manually.',
        manualOnly: true
      };
  }
}

// OpenAI - Check models endpoint and usage
async function testOpenAI(apiKey) {
  // First validate the key works
  const modelsRes = await fetch('https://api.openai.com/v1/models', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });

  if (!modelsRes.ok) {
    const err = await modelsRes.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Invalid API key');
  }

  // Try to get usage (requires org-level permissions)
  // Note: This endpoint may not work for all keys
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const endDate = now.toISOString().split('T')[0];
  
  let usage = null;
  try {
    const usageRes = await fetch(
      `https://api.openai.com/v1/usage?start_date=${startDate}&end_date=${endDate}`,
      { headers: { 'Authorization': `Bearer ${apiKey}` } }
    );
    if (usageRes.ok) {
      const usageData = await usageRes.json();
      // Sum up total tokens
      usage = usageData.data?.reduce((sum, day) => sum + (day.n_requests || 0), 0) || 0;
    }
  } catch (e) {
    // Usage endpoint may not be available
  }

  return {
    valid: true,
    provider: 'OpenAI',
    usage: usage,
    limit: null, // OpenAI doesn't expose hard limits via API
    resetPeriod: 'monthly',
    resetInfo: `Resets on the 1st of each month`,
    message: usage !== null 
      ? `Key valid. ${usage} requests this month.`
      : 'Key valid. Usage tracking available in dashboard.',
    dashboardUrl: 'https://platform.openai.com/usage',
  };
}

// Anthropic - Make a minimal request to check headers
// Enhanced to extract all rate limit information for comprehensive tracking
async function testAnthropic(apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'Hi' }]
    })
  });

  if (!res.ok && res.status === 401) {
    throw new Error('Invalid API key');
  }

  // Extract all rate limit headers (Anthropic uses anthropic-ratelimit-* prefix)
  const headers = {
    // Request limits
    requestsLimit: res.headers.get('anthropic-ratelimit-requests-limit'),
    requestsRemaining: res.headers.get('anthropic-ratelimit-requests-remaining'),
    requestsReset: res.headers.get('anthropic-ratelimit-requests-reset'),
    // Token limits (input)
    inputTokensLimit: res.headers.get('anthropic-ratelimit-input-tokens-limit'),
    inputTokensRemaining: res.headers.get('anthropic-ratelimit-input-tokens-remaining'),
    inputTokensReset: res.headers.get('anthropic-ratelimit-input-tokens-reset'),
    // Token limits (output)
    outputTokensLimit: res.headers.get('anthropic-ratelimit-output-tokens-limit'),
    outputTokensRemaining: res.headers.get('anthropic-ratelimit-output-tokens-remaining'),
    outputTokensReset: res.headers.get('anthropic-ratelimit-output-tokens-reset'),
    // Legacy/alternate headers
    legacyLimit: res.headers.get('x-ratelimit-limit-requests'),
    legacyRemaining: res.headers.get('x-ratelimit-remaining-requests'),
    legacyReset: res.headers.get('x-ratelimit-reset-requests'),
  };

  // Parse request limits (prefer new headers, fallback to legacy)
  const requestsLimit = parseInt(headers.requestsLimit || headers.legacyLimit) || null;
  const requestsRemaining = parseInt(headers.requestsRemaining || headers.legacyRemaining);
  const requestsReset = headers.requestsReset || headers.legacyReset;

  // Parse token limits
  const inputTokensLimit = parseInt(headers.inputTokensLimit) || null;
  const inputTokensRemaining = parseInt(headers.inputTokensRemaining);
  const outputTokensLimit = parseInt(headers.outputTokensLimit) || null;
  const outputTokensRemaining = parseInt(headers.outputTokensRemaining);

  // Calculate usage
  const requestsUsage = (requestsLimit && !isNaN(requestsRemaining))
    ? requestsLimit - requestsRemaining
    : null;

  // Detect tier based on request limits (RPM)
  // Tier 1: 60 RPM, Tier 2: 1000 RPM, Tier 3: 2000 RPM, Tier 4: 4000 RPM
  const detectedTier = detectAnthropicTier(requestsLimit);

  // Parse reset time
  let resetDate = null;
  if (requestsReset) {
    try {
      resetDate = new Date(requestsReset).toISOString();
    } catch (e) {
      // Reset time parsing failed
    }
  }

  return {
    valid: true,
    provider: 'Anthropic',
    usage: requestsUsage,
    limit: requestsLimit,
    resetPeriod: 'per-minute',
    resetDate: resetDate,
    resetInfo: requestsReset
      ? `Resets at ${new Date(requestsReset).toLocaleTimeString()}`
      : 'Resets every minute',
    subscriptionTier: detectedTier,
    message: requestsLimit
      ? `Key valid. ${requestsRemaining}/${requestsLimit} requests remaining (${detectedTier}).`
      : 'Key valid. Rate limit info not available in response.',
    dashboardUrl: 'https://console.anthropic.com/settings/limits',
    // Extended data for detailed display
    rateLimits: {
      requests: {
        limit: requestsLimit,
        remaining: !isNaN(requestsRemaining) ? requestsRemaining : null,
        reset: requestsReset
      },
      inputTokens: {
        limit: inputTokensLimit,
        remaining: !isNaN(inputTokensRemaining) ? inputTokensRemaining : null,
        reset: headers.inputTokensReset
      },
      outputTokens: {
        limit: outputTokensLimit,
        remaining: !isNaN(outputTokensRemaining) ? outputTokensRemaining : null,
        reset: headers.outputTokensReset
      }
    }
  };
}

// Detect Anthropic tier based on RPM limit
function detectAnthropicTier(requestsPerMinute) {
  if (!requestsPerMinute) return 'Unknown';
  if (requestsPerMinute >= 4000) return 'Tier 4';
  if (requestsPerMinute >= 2000) return 'Tier 3';
  if (requestsPerMinute >= 1000) return 'Tier 2';
  if (requestsPerMinute >= 60) return 'Tier 1';
  return 'Free';
}

// Google Gemini
// Enhanced with tier detection and known rate limits
async function testGemini(apiKey) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Invalid API key');
  }

  const data = await res.json();

  // Check rate limit headers if available
  const rateLimitLimit = res.headers.get('x-ratelimit-limit');
  const rateLimitRemaining = res.headers.get('x-ratelimit-remaining');
  const rateLimitReset = res.headers.get('x-ratelimit-reset');

  // Count available models to help estimate tier
  const modelCount = data.models?.length || 0;

  // Gemini rate limits by tier (RPM for gemini-1.5-flash):
  // Free: 15 RPM, Tier 1: 150-300 RPM, Tier 2: 1000+ RPM, Tier 3: 4000+ RPM
  const limit = rateLimitLimit ? parseInt(rateLimitLimit) : null;
  const detectedTier = detectGeminiTier(limit);

  // Calculate next reset (daily at midnight Pacific)
  const now = new Date();
  const pacificMidnight = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  pacificMidnight.setDate(pacificMidnight.getDate() + 1);
  pacificMidnight.setHours(0, 0, 0, 0);

  return {
    valid: true,
    provider: 'Google Gemini',
    usage: null,
    limit: limit,
    resetPeriod: 'per-minute',
    resetDate: rateLimitReset || null,
    resetInfo: 'Rate limits apply per minute. Daily quotas reset at midnight Pacific.',
    subscriptionTier: detectedTier,
    message: `Key valid. ${modelCount} models available. ${detectedTier} tier detected.`,
    dashboardUrl: 'https://console.cloud.google.com/apis/dashboard',
    availableModels: data.models?.map(m => m.name).slice(0, 10) || [],
    rateLimits: limit ? {
      requests: {
        limit: limit,
        remaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : null,
        reset: rateLimitReset
      }
    } : null
  };
}

// Detect Gemini tier based on RPM limit
function detectGeminiTier(requestsPerMinute) {
  if (!requestsPerMinute) return 'Unknown';
  if (requestsPerMinute >= 4000) return 'Tier 3';
  if (requestsPerMinute >= 1000) return 'Tier 2';
  if (requestsPerMinute >= 150) return 'Tier 1';
  if (requestsPerMinute >= 15) return 'Free';
  return 'Free';
}

// HuggingFace
async function testHuggingFace(apiKey) {
  const res = await fetch('https://huggingface.co/api/whoami-v2', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });

  if (!res.ok) {
    throw new Error('Invalid API key');
  }

  const data = await res.json();
  
  return {
    valid: true,
    provider: 'HuggingFace',
    usage: null,
    limit: null,
    resetPeriod: 'hourly',
    resetInfo: 'Rate limits vary by endpoint and account tier',
    message: `Key valid. Authenticated as ${data.name || 'user'}. Usage available in dashboard.`,
    dashboardUrl: 'https://huggingface.co/settings/billing',
    accountType: data.type,
  };
}

// Perplexity
// Enhanced with comprehensive rate limit parsing
async function testPerplexity(apiKey) {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-sonar-small-128k-online',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 1
    })
  });

  if (!res.ok && res.status === 401) {
    throw new Error('Invalid API key');
  }

  // Extract all rate limit headers
  const headers = {
    requestsLimit: res.headers.get('x-ratelimit-limit-requests'),
    requestsRemaining: res.headers.get('x-ratelimit-remaining-requests'),
    requestsReset: res.headers.get('x-ratelimit-reset-requests'),
    tokensLimit: res.headers.get('x-ratelimit-limit-tokens'),
    tokensRemaining: res.headers.get('x-ratelimit-remaining-tokens'),
  };

  const requestsLimit = headers.requestsLimit ? parseInt(headers.requestsLimit) : null;
  const requestsRemaining = headers.requestsRemaining ? parseInt(headers.requestsRemaining) : null;
  const tokensLimit = headers.tokensLimit ? parseInt(headers.tokensLimit) : null;

  // Calculate usage
  const requestsUsage = (requestsLimit && requestsRemaining !== null)
    ? requestsLimit - requestsRemaining
    : null;

  // Detect tier based on limits
  // Pro: ~$5/month included, Max: ~$50/month
  const detectedTier = requestsLimit && requestsLimit > 100 ? 'Pro' : 'Free';

  // Calculate next reset (monthly on billing date)
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return {
    valid: true,
    provider: 'Perplexity',
    usage: requestsUsage,
    limit: requestsLimit,
    resetPeriod: 'monthly',
    resetDate: nextMonth.toISOString(),
    resetInfo: 'Resets on your monthly billing date',
    subscriptionTier: detectedTier,
    message: requestsLimit
      ? `Key valid. ${requestsRemaining}/${requestsLimit} requests remaining.`
      : 'Key valid. Detailed usage available in dashboard.',
    dashboardUrl: 'https://www.perplexity.ai/settings/api',
    rateLimits: {
      requests: {
        limit: requestsLimit,
        remaining: requestsRemaining,
        reset: headers.requestsReset
      },
      tokens: tokensLimit ? {
        limit: tokensLimit,
        remaining: headers.tokensRemaining ? parseInt(headers.tokensRemaining) : null
      } : null
    }
  };
}

// Groq
async function testGroq(apiKey) {
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });

  if (!res.ok) {
    throw new Error('Invalid API key');
  }

  const rateLimitLimit = res.headers.get('x-ratelimit-limit-requests');
  const rateLimitRemaining = res.headers.get('x-ratelimit-remaining-requests');
  const rateLimitReset = res.headers.get('x-ratelimit-reset-requests');

  const limit = rateLimitLimit ? parseInt(rateLimitLimit) : null;
  const remaining = rateLimitRemaining ? parseInt(rateLimitRemaining) : null;

  return {
    valid: true,
    provider: 'Groq',
    usage: (limit && remaining !== null) ? limit - remaining : null,
    limit: limit,
    resetPeriod: 'per-minute',
    resetInfo: rateLimitReset || 'Resets every minute',
    message: limit 
      ? `Key valid. ${remaining}/${limit} requests remaining.`
      : 'Key valid.',
  };
}

// Cohere
async function testCohere(apiKey) {
  const res = await fetch('https://api.cohere.ai/v1/check-api-key', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }
  });

  if (!res.ok) {
    throw new Error('Invalid API key');
  }

  const data = await res.json();

  return {
    valid: data.valid === true,
    provider: 'Cohere',
    usage: null,
    limit: null,
    resetPeriod: 'per-minute',
    resetInfo: 'Rate limits vary by tier',
    message: data.valid ? 'Key valid. Usage available in dashboard.' : 'Invalid key.',
    dashboardUrl: data.valid ? 'https://dashboard.cohere.com/api-keys' : null,
  };
}

// GitHub Copilot - Premium Request Usage API
// Requires Fine-Grained Personal Access Token with "Plan" (user) read permission
// API: GET /users/{username}/settings/billing/premium_request/usage
async function testGitHubCopilot(apiKey) {
  // First, get the authenticated user's username
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });

  if (!userRes.ok) {
    if (userRes.status === 401) {
      throw new Error('Invalid Personal Access Token');
    }
    const err = await userRes.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to authenticate with GitHub');
  }

  const userData = await userRes.json();
  const username = userData.login;

  // Now fetch the Copilot premium usage data
  const usageRes = await fetch(
    `https://api.github.com/users/${username}/settings/billing/premium_request/usage`,
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  );

  // If we can't access billing data, the token may not have "Plan" permission
  if (!usageRes.ok) {
    if (usageRes.status === 403 || usageRes.status === 404) {
      return {
        valid: true,
        provider: 'GitHub Copilot',
        usage: null,
        limit: null,
        resetPeriod: 'monthly',
        resetInfo: 'Resets on your billing date',
        message: `Authenticated as ${username}. Grant "Plan" permission to PAT for usage data.`,
        dashboardUrl: 'https://github.com/settings/billing/summary',
        username: username,
        note: 'Create a Fine-Grained PAT with "Plan" (read) permission for full usage data'
      };
    }
    const err = await usageRes.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to fetch usage data');
  }

  const usageData = await usageRes.json();

  // Parse usage items - sum up premium requests
  let totalUsage = 0;
  let premiumLimit = 300; // Default Copilot Pro limit (varies by plan)
  const usageByModel = {};

  if (usageData.usage_items && Array.isArray(usageData.usage_items)) {
    usageData.usage_items.forEach(item => {
      const quantity = item.quantity || 0;
      totalUsage += quantity;

      // Track by model for detailed breakdown
      const model = item.sku_description || item.model || 'Unknown';
      usageByModel[model] = (usageByModel[model] || 0) + quantity;
    });
  }

  // Detect tier based on usage limits or billing info
  // Copilot Individual: ~300 premium requests/month
  // Copilot Business: higher limits
  // Copilot Enterprise: even higher
  let detectedTier = 'Individual';
  if (usageData.included_premium_requests) {
    premiumLimit = usageData.included_premium_requests;
    if (premiumLimit >= 1000) {
      detectedTier = 'Enterprise';
    } else if (premiumLimit >= 500) {
      detectedTier = 'Business';
    }
  }

  // Calculate reset date (monthly on billing date)
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

  return {
    valid: true,
    provider: 'GitHub Copilot',
    usage: totalUsage,
    limit: premiumLimit,
    resetPeriod: 'monthly',
    resetDate: nextMonth.toISOString(),
    resetInfo: 'Resets on your monthly billing date',
    subscriptionTier: detectedTier,
    message: `Authenticated as ${username}. ${totalUsage}/${premiumLimit} premium requests used.`,
    dashboardUrl: 'https://github.com/settings/billing/summary',
    username: username,
    usageByModel: Object.keys(usageByModel).length > 0 ? usageByModel : null,
    rateLimits: {
      premiumRequests: {
        limit: premiumLimit,
        used: totalUsage,
        remaining: Math.max(0, premiumLimit - totalUsage)
      }
    }
  };
}
