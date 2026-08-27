// Backend de exemplo para o endpoint /interpretar usado pelo
// CloudIntentClient (lib/services/cloud_intent_client.dart).
//
// Propósito: é ESTE servidor que guarda a chave da IA, nunca a app. A
// app só fala com este backend por HTTPS normal, sem nenhuma
// credencial sensível embutida.
//
// PROVIDER (fase de testes vs. comercialização):
//   LLM_PROVIDER=gemini (omissão) → usa o Google Gemini, GRÁTIS,
//     ideal para testar agora. Precisa de GEMINI_API_KEY.
//   LLM_PROVIDER=claude → usa a API Claude (paga), a trocar quando o
//     produto entrar na fase de comercialização. Precisa de
//     ANTHROPIC_API_KEY.
// A troca faz-se só mudando esta variável de ambiente — o resto do
// código (o prompt, o formato de resposta esperado pela app) é igual
// para os dois, graças aos ficheiros em providers/.
//
// Como correr localmente:
//   npm install
//   LLM_PROVIDER=gemini GEMINI_API_KEY=AIzaSy... node server.js
//
// Como obter uma chave Gemini grátis: ver GUIA_V2.md.
//
// Como publicar (grátis/barato, escolhe um):
//   - Firebase Functions (recomendado, já está na stack tecnológica)
//   - Render.com / Railway.app (deploy direto a partir do Git)
//
// Depois de publicado, atualiza o `backendUrl` em cloud_intent_client.dart
// para o URL público deste servidor + "/interpretar".

const express = require('express');
const { interpretWithGemini } = require('./providers/gemini');
const { interpretWithClaude } = require('./providers/claude');
const { interpretWithGroq } = require('./providers/groq');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'gemini';

// Mesma lista de capacidades que a app conhece — mantém sincronizado
// com o enum VoiceActionType (lib/models/voice_action.dart) e com o
// mapa knownApps (lib/services/action_dispatcher.dart).
const SYSTEM_PROMPT = `
Decompoes pedidos em português de utilizadores de uma app de automação
por voz chamada Infocom Voice, em uma ou mais ações estruturadas.

Responde APENAS com um array JSON válido, sem texto antes ou depois,
sem markdown. Cada item deve ter exatamente esta forma:
{
  "type": "sendSms" | "createNote" | "deleteLastNote" | "openApp" | "closeApp",
  "params": { ... },
  "confirmationPhrase": "frase em PT a dizer ao utilizador antes de executar",
  "requiresConfirmation": true | false
}

Regras por tipo:
- sendSms: params = {"contactName": "...", "message": "..."}. O campo
  "message" só deve ser preenchido quando o CONTEÚDO da mensagem já
  vier explícito no pedido do utilizador (ex.: pedidos compostos como
  "manda mensagem à Maria a dizer que chego em 20 minutos" → message =
  "Chego em 20 minutos"). Se o pedido só disser para enviar uma
  mensagem sem dizer o conteúdo, OMITE o campo "message" (a app pede o
  conteúdo depois, por voz). requiresConfirmation SEMPRE true (é uma
  ação irreversível).
- createNote: params = {"content": "..."}; requiresConfirmation false.
- deleteLastNote: params = {}; requiresConfirmation true.
- openApp: params = {"appName": "..."}; requiresConfirmation false. Só usa
  nomes de apps conhecidas: whatsapp, youtube, gmail, calendário, mapas,
  facebook, instagram, spotify, chrome.
- closeApp: params = {}; requiresConfirmation false.

Se o pedido não corresponder a nenhuma destas ações, responde com um
array vazio: []

Exemplo de pedido composto:
"Estou a sair de casa. Manda uma mensagem à Maria a dizer que chego em
20 minutos, depois abre o Maps."
Resposta esperada:
[
  {"type":"sendSms","params":{"contactName":"Maria","message":"Chego em 20 minutos"},"confirmationPhrase":"Vou enviar 'Chego em 20 minutos' a Maria. Confirma?","requiresConfirmation":true},
  {"type":"openApp","params":{"appName":"mapas"},"confirmationPhrase":"","requiresConfirmation":false}
]
`;

app.post('/interpretar', async (req, res) => {
  const { texto } = req.body;
  if (!texto || typeof texto !== 'string') {
    return res.status(400).json([]);
  }

  try {
    let rawText;

    if (LLM_PROVIDER === 'claude') {
      rawText = await interpretWithClaude(texto, SYSTEM_PROMPT, process.env.ANTHROPIC_API_KEY);
    } else if (LLM_PROVIDER === 'groq') {
      rawText = await interpretWithGroq(texto, SYSTEM_PROMPT, process.env.GROQ_API_KEY);
    } else {
      rawText = await interpretWithGemini(texto, SYSTEM_PROMPT, process.env.GEMINI_API_KEY);
    }

    let cleaned = rawText.replace(/^```json/, '').replace(/```$/, '').trim();

    // Alguns modelos (sobretudo os de "raciocínio", como os usados no
    // Groq) por vezes acrescentam texto antes/depois do array JSON,
    // apesar da instrução para não o fazerem. Em vez de desistir logo,
    // tenta extrair só o troço entre o primeiro "[" e o último "]".
    if (!cleaned.startsWith('[')) {
      const start = cleaned.indexOf('[');
      const end = cleaned.lastIndexOf(']');
      if (start !== -1 && end !== -1 && end > start) {
        cleaned = cleaned.slice(start, end + 1);
      }
    }

    // Log sempre visível (não só em erro) — ajuda a diagnosticar, nos
    // logs do Render, exatamente o que a IA respondeu para cada pedido,
    // enquanto estivermos a afinar isto.
    console.log(`[${LLM_PROVIDER}] pedido: "${texto}" → resposta bruta:`, rawText);

    let actions;
    try {
      actions = JSON.parse(cleaned);
    } catch (e) {
      console.error('Resposta da IA não é JSON válido:', rawText);
      return res.json([]);
    }

    return res.json(actions);
  } catch (error) {
    console.error(`Erro ao chamar a IA (provider=${LLM_PROVIDER}):`, error);
    return res.status(502).json([]);
  }
});

app.listen(PORT, () => {
  console.log(`Backend Infocom Voice a correr na porta ${PORT} (provider: ${LLM_PROVIDER})`);
});
