// functions/api/desenho.js
// Recebe o número, valida o token do Google e devolve o SVG assinado.

import { gerarDesenho, numeroValido } from "../../lib/desenho.js";

function resposta(texto, status) {
  return new Response(texto, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function onRequest(context) {
  const { request, env } = context;

  // 1. Aceita somente POST.
  if (request.method !== "POST") {
    return resposta("Método não permitido.", 405);
  }

  // 2. Verifica se o corpo contém JSON válido.
  let corpo;

  try {
    corpo = await request.json();
  } catch {
    return resposta("Corpo JSON inválido.", 400);
  }

  // 3. Valida o número recebido.
  if (
    !corpo ||
    typeof corpo !== "object" ||
    !Object.prototype.hasOwnProperty.call(corpo, "numero") ||
    !numeroValido(corpo.numero)
  ) {
    return resposta("Informe um inteiro entre 1 e 100.", 400);
  }

  // 4. Obtém o token enviado pelo navegador.
  const autorizacao = request.headers.get("Authorization") || "";
  const correspondencia = autorizacao.match(/^Bearer\s+(.+)$/i);

  if (!correspondencia) {
    return resposta("Token do Google ausente ou inválido.", 401);
  }

  const idToken = correspondencia[1].trim();

  if (!idToken) {
    return resposta("Token do Google ausente ou inválido.", 401);
  }

  // 5. Confere o token com o serviço oficial do Google.
  let dadosGoogle;

  try {
    const parametros = new URLSearchParams({ id_token: idToken });

    const verificacao = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?${parametros.toString()}`
    );

    if (!verificacao.ok) {
      return resposta("Token do Google inválido ou expirado.", 401);
    }

    dadosGoogle = await verificacao.json();
  } catch {
    return resposta("Não foi possível verificar o token do Google.", 401);
  }

  // 6. Confere se o token pertence a este aplicativo.
  if (
    !env.GOOGLE_CLIENT_ID ||
    dadosGoogle.aud !== env.GOOGLE_CLIENT_ID
  ) {
    return resposta("Token não pertence a este aplicativo.", 401);
  }

  // 7. Exige um e-mail verificado pelo Google.
  if (
    dadosGoogle.email_verified !== "true" ||
    typeof dadosGoogle.email !== "string" ||
    !dadosGoogle.email.trim()
  ) {
    return resposta("O Google não confirmou o e-mail da conta.", 401);
  }

  // 8. Gera o desenho usando o e-mail verificado pelo Google.
  // O e-mail nunca é aceito a partir do corpo enviado pelo navegador.
  try {
    const svg = gerarDesenho(corpo.numero, dadosGoogle.email);

    return new Response(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return resposta("Não foi possível gerar o desenho.", 500);
  }
}