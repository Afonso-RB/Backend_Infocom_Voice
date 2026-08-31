// Provider Claude (Anthropic) — usar na fase de comercialização.

async function interpretWithClaude(texto, systemPrompt, apiKey) {
  const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: texto }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Erro da API Claude:', response.status, errorBody);
    throw new Error(`claude_http_${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text ?? '[]';
}

module.exports = { interpretWithClaude };
