/* Login básico: contas guardadas no navegador deste aparelho (localStorage).
   A senha nunca é guardada em texto: só um hash SHA-256 com sal. */
(function () {
  var KU = "concursos-usuarios", KS = "concursos-sessao";
  var script = document.currentScript;
  var RAIZ = new URL("../", script ? script.src : location.href).href; // pasta do site

  function ler() {
    try { var u = JSON.parse(localStorage.getItem(KU) || "{}"); return u && typeof u === "object" ? u : {}; }
    catch (e) { return {}; }
  }
  function gravar(u) { localStorage.setItem(KU, JSON.stringify(u)); }
  function chave(nome) { return String(nome || "").trim().toLowerCase(); }
  function hex(buf) { return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join(""); }

  async function hash(senha, sal) {
    var dados = new TextEncoder().encode(sal + ":" + senha);
    return hex(await crypto.subtle.digest("SHA-256", dados));
  }

  function erro(msg) { var e = new Error(msg); e.amigavel = true; return e; }

  function validar(nome, senha) {
    nome = String(nome || "").trim();
    if (nome.length < 3) throw erro("O nome de usuário precisa ter pelo menos 3 caracteres.");
    if (nome.length > 30) throw erro("O nome de usuário pode ter no máximo 30 caracteres.");
    if (!/^[\p{L}\p{N}._-]+$/u.test(nome)) throw erro("Use só letras, números, ponto, hífen ou sublinhado no nome de usuário (sem espaços).");
    if (String(senha || "").length < 4) throw erro("A senha precisa ter pelo menos 4 caracteres.");
  }

  async function cadastrar(nome, senha) {
    validar(nome, senha);
    var us = ler(), k = chave(nome);
    if (us[k]) throw erro("Esse nome de usuário já está cadastrado neste aparelho. Escolha outro ou entre.");
    var sal = hex(crypto.getRandomValues(new Uint8Array(16)));
    us[k] = { nome: String(nome).trim(), sal: sal, hash: await hash(senha, sal), criado: Date.now() };
    try { gravar(us); } catch (e) { throw erro("Este navegador não deixa salvar dados (modo anônimo?)."); }
    localStorage.setItem(KS, k);
    return { id: k, nome: us[k].nome };
  }

  async function entrar(nome, senha) {
    var us = ler(), k = chave(nome), u = us[k];
    if (!u || (await hash(senha, u.sal)) !== u.hash) throw erro("Usuário ou senha incorretos.");
    localStorage.setItem(KS, k);
    return { id: k, nome: u.nome };
  }

  function usuario() {
    var k = null;
    try { k = localStorage.getItem(KS); } catch (e) {}
    var u = k && ler()[k];
    return u ? { id: k, nome: u.nome } : null;
  }

  function sair() {
    try { localStorage.removeItem(KS); } catch (e) {}
    location.href = RAIZ + "index.html";
  }

  /* Em páginas protegidas: manda para o login se ninguém entrou. */
  function exigir() {
    var u = usuario();
    if (!u) location.replace(RAIZ + "index.html?volta=" + encodeURIComponent(location.href));
    return u;
  }

  /* Só volta para páginas deste mesmo site. */
  function destinoSeguro(volta) {
    try {
      var url = new URL(volta, location.href);
      if ((url.protocol === "https:" || url.protocol === "http:" || url.protocol === "file:") &&
          url.origin === location.origin && url.href.indexOf(RAIZ) === 0) return url.href;
    } catch (e) {}
    return RAIZ + "concursos.html";
  }

  /* Preenche [data-usuario] com o nome e liga [data-sair]. */
  document.addEventListener("DOMContentLoaded", function () {
    var u = usuario();
    document.querySelectorAll("[data-usuario]").forEach(function (el) { el.textContent = u ? u.nome : ""; });
    document.querySelectorAll("[data-sair]").forEach(function (b) { b.addEventListener("click", sair); });
  });

  window.Auth = { cadastrar: cadastrar, entrar: entrar, usuario: usuario, sair: sair, exigir: exigir, destinoSeguro: destinoSeguro, RAIZ: RAIZ };
})();
