const https = require('https');

/**
 * Call Claude API to generate social media caption + hashtags
 * for a given event.
 *
 * @param {Object} event  - { name, description, date, location, type }
 * @returns {Promise<{ description: string, hashtags: string[] }>}
 */
async function generateEventCaption(event) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[Claude Fallback] ANTHROPIC_API_KEY not set. Using dummy caption.');
    return {
      description: `Thanks for joining us at ${event.name}! What an incredible time. #eventify`,
      hashtags: ['eventify', 'memories', 'celebration', 'fun', 'moments']
    };
  }

  const prompt = `You are a social media expert. Generate a compelling social media post caption and 5 relevant hashtags for the following event.

Event name: ${event.name}
Date: ${event.date || 'TBD'}
Location: ${event.location || 'TBD'}
Description: ${event.description || 'No description provided.'}

Requirements:
- Caption: 1-3 sentences, engaging, suitable for TikTok / Instagram / Facebook / X / YouTube
- Hashtags: exactly 5, no # prefix, lowercase, no spaces (use camelCase or single words)
- Keep it professional yet exciting

Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{"description":"your caption here","hashtags":["tag1","tag2","tag3","tag4","tag5"]}`;

  const body = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) return reject(new Error(parsed.error.message));
            const text = parsed.content?.[0]?.text || '';
            const result = JSON.parse(text.trim());
            resolve(result);
          } catch (e) {
            reject(new Error('Failed to parse Claude response: ' + data));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { generateEventCaption };
