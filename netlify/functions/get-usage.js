const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  const providers = [
    { id: 'openai', key: process.env.OPENAI_API_KEY, url: 'https://api.openai.com/v1/usage' }, // Example endpoint
    { id: 'anthropic', key: process.env.ANTHROPIC_API_KEY },
    { id: 'perplexity', key: process.env.PERPLEXITY_API_KEY },
    { id: 'gemini', key: process.env.GEMINI_API_KEY },
    { id: 'huggingface', key: process.env.VITE_HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_API_KEY },
  ];

  const usageData = {};

  // Mocking the fetch logic because real usage endpoints vary wildly or don't exist in this simple form
  // In a real implementation, you would have specific logic for each provider
  
  for (const provider of providers) {
    if (provider.key) {
      // Simulate fetching data
      // const response = await fetch(provider.url, { headers: { Authorization: `Bearer ${provider.key}` } });
      // const data = await response.json();
      
      // For now, return a mock value to prove we accessed the key
      usageData[provider.id] = Math.floor(Math.random() * 1000); 
      console.log(`Fetched usage for ${provider.id}`);
    } else {
      usageData[provider.id] = 0;
      console.log(`No key found for ${provider.id}`);
    }
  }

  usageData.last_updated = new Date().toISOString();

  return {
    statusCode: 200,
    body: JSON.stringify(usageData),
    headers: {
      'Content-Type': 'application/json'
    }
  };
};
