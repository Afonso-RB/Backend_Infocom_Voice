// Provider Gemini (Google AI Studio). ATENÇÃO: contas novas podem
// receber chaves no formato "AQ." que não funcionam com este método
// de chamada — problema atual e generalizado do lado da Google. Se
// isso acontecer, usa o Groq em vez deste.

async function interpretWithGemini(texto, systemPrompt, apiKey) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\nPedido do utilizador: "${texto}"` }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1000,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Erro da API Gemini:', response.status, errorBody);
    throw new Error(`gemini_http_${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
  return text;
}

module.exports = { interpretWithGemini };
