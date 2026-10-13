// public/script.js
// O navegador faz login com o Google e solicita o desenho ao servidor.

const formulario = document.getElementById("formulario");
const campoNumero = document.getElementById("numero");
const area = document.getElementById("desenho");
const mensagem = document.getElementById("mensagem");
const botaoBaixar = document.getElementById("baixar");
const statusLogin = document.getElementById("status-login");

let idToken = "";
let svgAtual = "";

const GOOGLE_CLIENT_ID = "26522937916-ghl68n70hcr1g6gp83uib5k3iq8d51k3.apps.googleusercontent.com";

// Recebe o token de identidade enviado pelo Google após o login.
function receberTokenGoogle(resposta) {
  idToken = resposta.credential;

  statusLogin.textContent = "Login realizado com sucesso. Você já pode desenhar.";
  mensagem.textContent = "";
}

// Inicializa o botão do Google quando a biblioteca estiver disponível.
function iniciarGoogle() {
  if (window.google?.accounts?.id) {
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: receberTokenGoogle
    });

    window.google.accounts.id.renderButton(
      document.getElementById("google-login"),
      {
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular"
      }
    );

    return;
  }

  setTimeout(iniciarGoogle, 250);
}

// Envia o número e o token para a Pages Function.
formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  mensagem.textContent = "";
  area.replaceChildren();
  botaoBaixar.hidden = true;
  svgAtual = "";

  if (!idToken) {
    mensagem.textContent = "Faça login com o Google antes de desenhar.";
    return;
  }

  const numero = Number(campoNumero.value);

  if (!Number.isInteger(numero) || numero < 1 || numero > 100) {
    mensagem.textContent = "Digite um inteiro entre 1 e 100.";
    return;
  }

  try {
    const resposta = await fetch("/api/desenho", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify({ numero })
    });

    if (!resposta.ok) {
      if (resposta.status === 400) {
        mensagem.textContent =
          "Erro:400 - Pedido inválido. Digite um inteiro entre 1 e 100.";
      } else if (resposta.status === 401) {
        mensagem.textContent =
          "Erro:401 - Autenticação inválida ou expirada. Faça login novamente com o Google.";
      } else if (resposta.status === 405) {
        mensagem.textContent =
          "Erro:405 - Método não permitido para gerar o desenho.";
      } else {
        mensagem.textContent =
          `Não foi possível gerar o desenho. Erro ${resposta.status}.`;
      }

      return;
    }

    svgAtual = await resposta.text();

    if (!svgAtual.trim()) {
      mensagem.textContent = "O servidor retornou um desenho vazio.";
      svgAtual = "";
      return;
    }

    // O SVG é produzido pela função do nosso próprio servidor.
    const documento = new DOMParser().parseFromString(
      svgAtual,
      "image/svg+xml"
    );

    if (documento.querySelector("parsererror") ||
        documento.documentElement.localName !== "svg") {
      mensagem.textContent = "O servidor retornou um SVG inválido.";
      svgAtual = "";
      return;
    }

    area.replaceChildren(
      document.importNode(documento.documentElement, true)
    );

    botaoBaixar.hidden = false;
    mensagem.textContent = "Desenho gerado com sucesso.";
  } catch (erro) {
    mensagem.textContent =
      "Não foi possível conectar ao servidor. Tente novamente.";
    console.error(erro);
  }
});

// Baixa o SVG recebido do servidor.
botaoBaixar.addEventListener("click", () => {
  if (!svgAtual) {
    return;
  }

  const arquivo = new Blob([svgAtual], {
    type: "image/svg+xml"
  });

  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");

  link.href = url;
  link.download = "exemplo.svg";
  link.click();

  URL.revokeObjectURL(url);
});

iniciarGoogle();
