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
      : 'Key valid. Usage data requires organization-level access.',
  };
}

// Anthropic - Make a minimal request to check headers
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

  // Even if rate limited, we can read headers
  const rateLimitLimit = res.headers.get('x-ratelimit-limit-requests') || 
                         res.headers.get('anthropic-ratelimit-requests-limit');
  const rateLimitRemaining = res.headers.get('x-ratelimit-remaining-requests') ||
                             res.headers.get('anthropic-ratelimit-requests-remaining');
  const rateLimitReset = res.headers.get('x-ratelimit-reset-requests') ||
                         res.headers.get('anthropic-ratelimit-requests-reset');

  if (!res.ok && res.status === 401) {
    throw new Error('Invalid API key');
  }

  const limit = rateLimitLimit ? parseInt(rateLimitLimit) : null;
  const remaining = rateLimitRemaining ? parseInt(rateLimitRemaining) : null;
  const usage = (limit && remaining !== null) ? limit - remaining : null;

  return {
    valid: true,
    provider: 'Anthropic',
    usage: usage,
    limit: limit,
    resetPeriod: 'per-minute',
    resetInfo: rateLimitReset ? `Resets at ${rateLimitReset}` : 'Resets every minute',
    message: limit 
      ? `Key valid. ${remaining}/${limit} requests remaining this period.`
      : 'Key valid. Rate limit info not available in response.',
  };
}

// Google Gemini
async function testGemini(apiKey) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Invalid API key');
  }

  return {
    valid: true,
    provider: 'Google Gemini',
    usage: null,
    limit: null,
    resetPeriod: 'per-minute',
    resetInfo: 'Rate limits vary by model and tier',
    message: 'Key valid. Usage tracking requires Google Cloud Console.',
  };
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
    message: `Key valid. Authenticated as ${data.name || 'user'}.`,
    accountType: data.type,
  };
}

// Perplexity
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

  // Check for rate limit headers
  const rateLimitLimit = res.headers.get('x-ratelimit-limit-requests');
  const rateLimitRemaining = res.headers.get('x-ratelimit-remaining-requests');

  return {
    valid: true,
    provider: 'Perplexity',
    usage: null,
    limit: rateLimitLimit ? parseInt(rateLimitLimit) : null,
    resetPeriod: 'monthly',
    resetInfo: 'Check dashboard for detailed usage',
    message: 'Key valid. Detailed usage available in Perplexity dashboard.',
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
    message: data.valid ? 'Key valid.' : 'Invalid key.',
  };
}
