/**
 * Netlify function to fetch OpenAI organization usage data
 * Requires OPENAI_ADMIN_KEY for organization-level access
 */

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // Accept both GET (with env var) and POST (with provided key)
  let adminKey;

  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body);
      adminKey = body.adminKey;
    } catch (e) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }
  }

  // Fallback to environment variable
  adminKey = adminKey || process.env.OPENAI_ADMIN_KEY;

  if (!adminKey) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'OpenAI Admin Key required',
        message: 'Please provide an admin key or set OPENAI_ADMIN_KEY environment variable'
      })
    };
  }

  try {
    const usageData = await fetchOpenAIUsage(adminKey);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(usageData)
    };
  } catch (error) {
    console.error('Error fetching OpenAI usage:', error);
    return {
      statusCode: error.status || 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Failed to fetch usage data',
        details: error.details || null
      })
    };
  }
};

/**
 * Fetch usage data from OpenAI Organization API
 */
async function fetchOpenAIUsage(adminKey) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startTime = Math.floor(startOfMonth.getTime() / 1000);
  const endTime = Math.floor(now.getTime() / 1000);

  // Fetch multiple usage types in parallel
  const [completions, images, embeddings, audio] = await Promise.all([
    fetchUsageEndpoint(adminKey, 'completions', startTime, endTime),
    fetchUsageEndpoint(adminKey, 'images', startTime, endTime).catch(() => null),
    fetchUsageEndpoint(adminKey, 'embeddings', startTime, endTime).catch(() => null),
    fetchUsageEndpoint(adminKey, 'audio_speeches', startTime, endTime).catch(() => null),
  ]);

  // Aggregate the data
  const totalRequests = aggregateRequests(completions);
  const totalTokens = aggregateTokens(completions);
  const totalCost = estimateCost(completions);

  // Calculate reset info
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return {
    valid: true,
    provider: 'OpenAI',
    usage: totalRequests,
    tokens: totalTokens,
    cost: totalCost,
    resetDate: nextMonth.toISOString(),
    resetPeriod: 'monthly',
    lastFetchedAt: now.toISOString(),
    breakdown: {
      completions: completions ? aggregateRequests(completions) : 0,
      images: images ? aggregateRequests(images) : 0,
      embeddings: embeddings ? aggregateRequests(embeddings) : 0,
      audio: audio ? aggregateRequests(audio) : 0,
    },
    tokenBreakdown: totalTokens,
    modelBreakdown: completions ? groupByModel(completions) : {},
    dashboardUrl: 'https://platform.openai.com/usage',
  };
}

/**
 * Fetch a specific usage endpoint
 */
async function fetchUsageEndpoint(adminKey, type, startTime, endTime) {
  const url = `https://api.openai.com/v1/organization/usage/${type}?start_time=${startTime}&end_time=${endTime}&bucket_width=1d`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${adminKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));

    if (response.status === 401) {
      const err = new Error('Invalid or unauthorized admin key');
      err.status = 401;
      throw err;
    }

    if (response.status === 403) {
      const err = new Error('Admin key does not have permission to access usage data');
      err.status = 403;
      err.details = 'You need an organization admin key, not a regular API key';
      throw err;
    }

    // Some endpoints may not exist for all accounts
    if (response.status === 404) {
      return null;
    }

    const err = new Error(error.error?.message || `Failed to fetch ${type} usage`);
    err.status = response.status;
    throw err;
  }

  return response.json();
}

/**
 * Aggregate total requests from usage data
 */
function aggregateRequests(data) {
  if (!data || !data.data) return 0;

  return data.data.reduce((total, bucket) => {
    // Handle different result structures
    if (bucket.results && Array.isArray(bucket.results)) {
      return total + bucket.results.reduce((sum, r) => sum + (r.num_model_requests || 0), 0);
    }
    return total + (bucket.num_model_requests || bucket.n_requests || 0);
  }, 0);
}

/**
 * Aggregate tokens from usage data
 */
function aggregateTokens(data) {
  if (!data || !data.data) return { input: 0, output: 0, total: 0 };

  let input = 0;
  let output = 0;

  data.data.forEach(bucket => {
    if (bucket.results && Array.isArray(bucket.results)) {
      bucket.results.forEach(r => {
        input += r.num_context_tokens_total || r.input_tokens || 0;
        output += r.num_generated_tokens_total || r.output_tokens || 0;
      });
    } else {
      input += bucket.num_context_tokens_total || bucket.input_tokens || 0;
      output += bucket.num_generated_tokens_total || bucket.output_tokens || 0;
    }
  });

  return { input, output, total: input + output };
}

/**
 * Group usage by model
 */
function groupByModel(data) {
  if (!data || !data.data) return {};

  const modelUsage = {};

  data.data.forEach(bucket => {
    if (bucket.results && Array.isArray(bucket.results)) {
      bucket.results.forEach(r => {
        const model = r.model || 'unknown';
        if (!modelUsage[model]) {
          modelUsage[model] = { requests: 0, inputTokens: 0, outputTokens: 0 };
        }
        modelUsage[model].requests += r.num_model_requests || 0;
        modelUsage[model].inputTokens += r.num_context_tokens_total || r.input_tokens || 0;
        modelUsage[model].outputTokens += r.num_generated_tokens_total || r.output_tokens || 0;
      });
    }
  });

  return modelUsage;
}

/**
 * Estimate cost based on token usage and models
 * Note: These are approximate rates and may not match exact billing
 */
function estimateCost(data) {
  if (!data || !data.data) return 0;

  // Approximate pricing per 1M tokens (input/output)
  const pricing = {
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4-turbo': { input: 10.00, output: 30.00 },
    'gpt-4': { input: 30.00, output: 60.00 },
    'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
    'o1': { input: 15.00, output: 60.00 },
    'o1-mini': { input: 3.00, output: 12.00 },
    'default': { input: 5.00, output: 15.00 }
  };

  let totalCost = 0;

  data.data.forEach(bucket => {
    if (bucket.results && Array.isArray(bucket.results)) {
      bucket.results.forEach(r => {
        const model = r.model || 'default';
        const rates = pricing[model] || pricing.default;

        const inputTokens = r.num_context_tokens_total || r.input_tokens || 0;
        const outputTokens = r.num_generated_tokens_total || r.output_tokens || 0;

        totalCost += (inputTokens / 1_000_000) * rates.input;
        totalCost += (outputTokens / 1_000_000) * rates.output;
      });
    }
  });

  return Math.round(totalCost * 100) / 100; // Round to 2 decimal places
}
