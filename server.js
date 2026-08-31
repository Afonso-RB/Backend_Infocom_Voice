// Backend de exemplo para o endpoint /interpretar usado pelo
// CloudIntentClient (lib/services/cloud_intent_client.dart).
//
// Propósito: é ESTE servidor que guarda a chave da IA, nunca a app. A
// app só fala com este backend por HTTPS normal, sem nenhuma
// credencial sensível embutida.
//
// PROVIDER (fase de testes vs. comercialização):
//   LLM_PROVIDER=groq (recomendado agora) → grátis, chave estável.
//   LLM_PROVIDER=gemini → grátis, mas contas novas podem receber
//     chaves no formato "AQ." que não funcionam com este método de
//     chamada (problema atual e generalizado do lado da Google).
//   LLM_PROVIDER=claude → paga, trocar na fase de comercialização.
// A troca faz-se só mudando esta variável de ambiente.
//
// Como correr localmente:
//   npm install
//   $env:LLM_PROVIDER="groq"; $env:GROQ_API_KEY="gsk_..."; node server.js

const express = require('express');
const { interpretWithGemini } = require('./providers/gemini');
const { interpretWithClaude } = require('./providers/claude');
const { interpretWithGroq } = require('./providers/groq');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'groq';

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
  ATENÇÃO: quando a frase tiver "e depois" a seguir ao conteúdo da
  mensagem, isso marca o INÍCIO DE UM PEDIDO SEGUINTE, não faz parte da
  mensagem. Ex.: "manda mensagem ao Caetano a dizer que chego tarde e
  depois abre o Spotify" → message = "chego tarde" (para em "e depois"),
  seguido de um segundo item openApp para o Spotify.
- createNote: params = {"content": "..."}; requiresConfirmation false.
- deleteLastNote: params = {}; requiresConfirmation true.
- openApp: params = {"appName": "..."}; requiresConfirmation false. Só
  usa nomes de apps conhecidas: whatsapp, youtube, gmail, calendário,
  mapas, facebook, instagram, spotify, chrome. O nome da app NUNCA
  inclui palavras de outro pedido (ex.: "e depois", "manda mensagem",
  etc.) — corta o nome da app assim que aparecer qualquer um desses
  marcadores.
- closeApp: params = {}; requiresConfirmation false.

Se o pedido não corresponder a nenhuma destas ações (ex.: perguntas
sobre o estado da app, tipo "quantas notas tens guardadas" — a app
ainda não sabe responder a isso), responde com um array vazio: []

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
    } else if (LLM_PROVIDER === 'gemini') {
      rawText = await interpretWithGemini(texto, SYSTEM_PROMPT, process.env.GEMINI_API_KEY);
    } else {
      rawText = await interpretWithGroq(texto, SYSTEM_PROMPT, process.env.GROQ_API_KEY);
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
    // logs do Render, exatamente o que a IA respondeu para cada pedido.
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
