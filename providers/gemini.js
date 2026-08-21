// Provider Gemini (Google AI Studio) — usa a chave gratuita obtida em
// aistudio.google.com. Ver GUIA_V2.md para o passo a passo de como
// obter a chave.

async function interpretWithGemini(texto, systemPrompt, apiKey) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      // A API Gemini não tem um campo "system" separado como a Claude
      // — o mais fiável é prefixar o próprio prompt do utilizador.
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
