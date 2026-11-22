/* Modo diurno / noturno. Carregue no <head> (sem defer) para não piscar ao abrir. */
(function () {
  var CHAVE = "concursos-tema";
  var raiz = document.documentElement;
  try {
    var salvo = localStorage.getItem(CHAVE);
    if (salvo === "dark" || salvo === "light") raiz.dataset.theme = salvo;
  } catch (e) {}

  function atual() {
    if (raiz.dataset.theme) return raiz.dataset.theme;
    return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  var SOL = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.2M12 19.8V22M2 12h2.2M19.8 12H22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"/></svg>';
  var LUA = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z"/></svg>';

  function pintaBotoes() {
    var escuro = atual() === "dark";
    document.querySelectorAll("[data-tema-btn]").forEach(function (b) {
      b.innerHTML = (escuro ? SOL : LUA) + '<span class="tema-rotulo">' + (escuro ? "Modo diurno" : "Modo noturno") + "</span>";
      b.setAttribute("aria-label", escuro ? "Mudar para o modo diurno" : "Mudar para o modo noturno");
      b.title = escuro ? "Modo diurno" : "Modo noturno";
    });
  }

  function alternar() {
    var novo = atual() === "dark" ? "light" : "dark";
    raiz.dataset.theme = novo;
    try { localStorage.setItem(CHAVE, novo); } catch (e) {}
    pintaBotoes();
  }

  document.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest("[data-tema-btn]")) alternar();
  });
  document.addEventListener("DOMContentLoaded", pintaBotoes);
  window.Tema = { atual: atual, alternar: alternar };
})();
