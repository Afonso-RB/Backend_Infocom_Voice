// Provider Groq — alternativa ao Gemini, para usar se a tua conta
// Google só emitir chaves no formato novo "AQ." (problema atual e
// generalizado do lado da Google, incompatível com o método de chamada
// usado neste backend — ver GUIA_V2.md).
//
// O Groq usa o mesmo formato de pedido da OpenAI (mais um "standard" da
// indústria), a chave é sempre no formato "gsk_...", sem os problemas
// que a Google está a ter agora.

async function interpretWithGroq(texto, systemPrompt, apiKey) {
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

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
