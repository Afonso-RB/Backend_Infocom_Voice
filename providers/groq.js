// Provider Groq — gratuito, chave estável (gsk_...), sem os problemas
// de formato de chave que a Google tem tido.

async function interpretWithGroq(texto, systemPrompt, apiKey) {
  // "llama-3.3-70b-versatile" foi descontinuado pela Groq — trocado
  // para o substituto atual recomendado por eles. "openai/gpt-oss-20b"
  // é rápido e mais do que suficiente para esta tarefa; se precisares
  // de mais qualidade em pedidos mais complexos, troca para
  // "openai/gpt-oss-120b" através da variável de ambiente GROQ_MODEL.
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 1000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: texto },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Erro da API Groq:', response.status, errorBody);
    throw new Error(`groq_http_${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '[]';
}

module.exports = { interpretWithGroq };
