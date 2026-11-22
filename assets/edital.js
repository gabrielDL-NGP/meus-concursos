/* Edital verticalizado: checklist, gráficos, filtros, edição do conteúdo e sequência de estudo.
   Cada página de concurso define window.EDITAL = { DISC, ITENS } e chama iniciarEdital(id). */
import { iniciarPagina, salvarProgresso, salvarEdicoes } from "./app.js";
import { montarSequencia, registrarEstudoHoje } from "./sequencia.js";

const LAPIS = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
const LIXEIRA = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>';

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function mostrarProva(iso) {
  const el = document.getElementById("prova");
  if (!el || !window.textoProva) return;
  const t = window.textoProva(iso);
  el.innerHTML = `Prova em ${t.data} · <strong>${t.resumo}</strong>`;
  el.hidden = false;
}

/* Aplica as alterações do estudante (renomear, excluir, adicionar) sobre o edital original. */
export function aplicarEdicoes(originais, ed) {
  const excl = new Set(ed.excluidos || []), ren = ed.renomear || {};
  const lista = originais.filter(i => !excl.has(i.id)).map(i => ren[i.id] ? { ...i, ...ren[i.id] } : i);
  return lista.concat((ed.adicionados || []).map(i => ({ p: "", o: "", ...i, novo: true })));
}

export async function iniciarEdital(CONCURSO) {
  const { DISC } = window.EDITAL, ORIGINAIS = window.EDITAL.ITENS;
  const { dados } = await iniciarPagina();
  const info = (window.CONCURSOS || []).find(c => c.id === CONCURSO);
  const seq = montarSequencia(document.getElementById("sq"), dados, info && info.prova ? [{ data: info.prova, nome: info.cargo }] : []);
  const ETAPAS = ["PDFs", "Lei Seca", "Videoaulas", "Questões"];
  const N_ETAPAS = ETAPAS.length, TODAS = (1 << N_ETAPAS) - 1;
  const LS_KEY = "edital-filtros:" + CONCURSO;
  if (info && info.prova) mostrarProva(info.prova);

  let estado = { ...(dados.progresso[CONCURSO] || {}) };   // id -> bits (PDF, lei seca, videoaula, questões)
  const ed = JSON.parse(JSON.stringify((dados.edicoes || {})[CONCURSO] || {}));
  ed.renomear = ed.renomear || {}; ed.excluidos = ed.excluidos || []; ed.adicionados = ed.adicionados || [];
  let ITENS = aplicarEdicoes(ORIGINAIS, ed);
  let editando = false;

  const $ = s => document.querySelector(s);
  const fMat = $("#f-mat"), fCrit = $("#f-crit"), fSit = $("#f-sit"), fBusca = $("#f-busca");

  /* Caneta no cabeçalho "Conteúdo" e barra do modo de edição */
  const th = $("th.conteudo");
  th.innerHTML = `<span class="th-in">Conteúdo <button type="button" class="lapis" id="lapis" aria-pressed="false" title="Editar conteúdo">${LAPIS}<span>Editar</span></button></span>`;
  const barra = document.createElement("div");
  barra.className = "barra-edicao"; barra.hidden = true;
  barra.innerHTML = `<div><strong>Modo de edição.</strong> Mude o nome do tópico ou do conteúdo, exclua com a lixeira ou adicione no fim de cada matéria. Tudo fica salvo na sua conta.</div>
    <div class="be-acoes"><button type="button" class="btn sec" id="restaurar">Restaurar edital original</button><button type="button" class="btn" id="concluir">Concluir edição</button></div>`;
  $(".tabwrap").before(barra);
  const legenda = document.createElement("div");
  legenda.className = "legenda-linhas";
  legenda.innerHTML = `<span><i class="lg-iniciado"></i>Em andamento</span><span><i class="lg-completo"></i>Concluído (as 4 etapas)</span>`;
  barra.before(legenda);

  fMat.innerHTML = '<option value="">Todas as matérias</option>' + DISC.map(d => `<option value="${d.id}">${esc(d.nome)}</option>`).join("");
  try { const f = JSON.parse(localStorage.getItem(LS_KEY) || "null"); if (f) { fMat.value = f.mat || ""; fCrit.value = f.crit || "estudo"; fSit.value = f.sit || "todos"; } } catch (e) {}

  function bits(id) { return (estado[id] | 0) & TODAS; }
  function visto(id) {
    const b = bits(id), c = fCrit.value;
    if (c === "estudo") return (b & 0b111) !== 0;
    if (c === "tudo") return b === TODAS;
    return (b >> (+c)) & 1;
  }
  function situacao(id) { const b = bits(id); return b === TODAS ? "completo" : b ? "iniciado" : ""; }
  function norm(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }

  function linhaItem(i) {
    const b = bits(i.id);
    let c;
    if (editando) {
      c = `<td class="c"><div class="ed">
        <label class="ed-l">Tópico<input class="ed-t" data-campo="t" value="${esc(i.t)}" maxlength="120"></label>
        <label class="ed-l">Conteúdo<textarea class="ed-a" data-campo="a" rows="2" maxlength="600">${esc(i.a)}</textarea></label>
        ${i.p ? `<span class="disp">${esc(i.p)}</span>` : ""}
        <button type="button" class="excluir" data-excluir title="Excluir este conteúdo">${LIXEIRA}<span>Excluir</span></button></div></td>`;
    } else {
      c = `<td class="c"><span class="tema">${esc(i.t)}</span><span class="ass">${esc(i.a)}</span>${i.p ? `<span class="disp">${esc(i.p)}</span>` : ""}${i.o ? `<span class="obs">Obs.: ${esc(i.o)}</span>` : ""}</td>`;
    }
    let h = `<tr class="item ${situacao(i.id)}" data-id="${esc(i.id)}">${c}`;
    for (let k = 0; k < N_ETAPAS; k++) {
      const cid = `${i.id}-${k}`;
      h += `<td class="cb"><label for="${esc(cid)}"><input type="checkbox" id="${esc(cid)}" data-k="${k}" ${(b >> k) & 1 ? "checked" : ""} aria-label="${esc(ETAPAS[k] + ": " + i.a)}"></label></td>`;
    }
    return h + "</tr>";
  }

  function render() {
    const mat = fMat.value, sit = fSit.value, q = norm(fBusca.value.trim());
    let html = "", ultimoBloco = "", mostrados = 0;
    for (const d of DISC) {
      if (mat && d.id !== mat) continue;
      const itens = ITENS.filter(i => i.d === d.id);
      const feitos = itens.filter(i => visto(i.id)).length;
      const visiveis = itens.filter(i => {
        if (sit === "falta" && visto(i.id)) return false;
        if (sit === "visto" && !visto(i.id)) return false;
        if (q && !norm(i.t + " " + i.a + " " + i.p + " " + i.o).includes(q)) return false;
        return true;
      });
      if (!visiveis.length && !editando) continue;
      if (d.bloco !== ultimoBloco) { html += `<tr class="bloco"><td colspan="5">${esc(d.bloco)}</td></tr>`; ultimoBloco = d.bloco; }
      html += `<tr class="disc" data-disc="${d.id}"><td colspan="5">${esc(d.nome)}<span class="prog">${feitos} de ${itens.length} vistos</span></td></tr>`;
      for (const i of visiveis) { mostrados++; html += linhaItem(i); }
      if (editando) html += `<tr class="add"><td colspan="5"><button type="button" class="adicionar" data-add="${d.id}">+ Adicionar conteúdo em ${esc(d.nome)}</button></td></tr>`;
    }
    $("#corpo").innerHTML = (mostrados || editando) ? html : `<tr><td colspan="5" class="vazio">Nenhum assunto com esses filtros.</td></tr>`;
    graficos();
  }

  function graficos() {
    const mat = fMat.value;
    const base = mat ? ITENS.filter(i => i.d === mat) : ITENS;
    const feitos = base.filter(i => visto(i.id)).length, total = base.length;
    const pct = total ? feitos / total : 0, circ = 2 * Math.PI * 78;
    $("#arco").setAttribute("stroke-dasharray", `${(pct * circ).toFixed(1)} ${circ.toFixed(1)}`);
    $("#donut-pct").textContent = Math.round(pct * 100) + "%";
    $("#donut-txt").textContent = `${feitos} de ${total} assuntos`;
    const nomeMat = mat ? DISC.find(d => d.id === mat).nome : "";
    $("#tit-donut").textContent = mat ? nomeMat : "Progresso geral";

    let linhas;
    if (!mat) {
      $("#tit-barras").textContent = "Por matéria";
      $("#dica-barras").textContent = "Toque numa matéria para ver os temas dela e filtrar a lista.";
      $("#voltar-geral").hidden = true;
      linhas = DISC.map(d => { const it = ITENS.filter(i => i.d === d.id); return { k: d.id, nome: d.nome, f: it.filter(i => visto(i.id)).length, t: it.length }; });
    } else {
      $("#tit-barras").textContent = "Por tema · " + nomeMat;
      $("#dica-barras").textContent = "";
      $("#voltar-geral").hidden = false;
      const temas = [];
      for (const i of base) { let g = temas.find(x => x.nome === i.t); if (!g) { g = { k: "", nome: i.t, f: 0, t: 0 }; temas.push(g); } g.t++; if (visto(i.id)) g.f++; }
      linhas = temas;
    }
    $("#barras").innerHTML = linhas.map(l => {
      const p = l.t ? Math.round(l.f / l.t * 100) : 0;
      const tag = l.k ? "button" : "div";
      return `<${tag} class="barra${l.k ? "" : " static"}" ${l.k ? `type="button" data-mat="${l.k}"` : ""} title="${esc(l.nome)}: ${l.f} de ${l.t}"><span class="nome">${esc(l.nome)}</span><span class="trilho"><span style="width:${p}%"></span></span><span class="pct">${l.f}/${l.t} · ${p}%</span></${tag}>`;
    }).join("");
  }

  function guardaFiltros() { try { localStorage.setItem(LS_KEY, JSON.stringify({ mat: fMat.value, crit: fCrit.value, sit: fSit.value })); } catch (e) {} }
  [fMat, fCrit, fSit].forEach(el => el.addEventListener("change", () => { guardaFiltros(); render(); }));
  fBusca.addEventListener("input", render);
  $("#limpar").addEventListener("click", () => { fMat.value = ""; fSit.value = "todos"; fBusca.value = ""; guardaFiltros(); render(); });
  $("#voltar-geral").addEventListener("click", () => { fMat.value = ""; guardaFiltros(); render(); });
  $("#barras").addEventListener("click", e => {
    const b = e.target.closest("button[data-mat]"); if (!b) return;
    fMat.value = b.dataset.mat; guardaFiltros(); render();
    document.querySelector(".filtros").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  });

  /* Marcar etapas */
  $("#corpo").addEventListener("change", e => {
    const cb = e.target; if (!cb.matches("input[type=checkbox]")) return;
    const tr = cb.closest("tr.item"), id = tr.dataset.id, k = +cb.dataset.k;
    let b = bits(id); b = cb.checked ? (b | (1 << k)) : (b & ~(1 << k));
    estado[id] = b;
    if (cb.checked) registrarEstudoHoje(dados, seq);
    tr.classList.remove("iniciado", "completo");
    if (situacao(id)) tr.classList.add(situacao(id));
    atualizaContagemDisc(id);
    graficos();
    salvarProgresso(CONCURSO, estado);
  });
  function atualizaContagemDisc(id) {
    const it = ITENS.find(i => i.id === id), d = it.d;
    const all = ITENS.filter(i => i.d === d), f = all.filter(i => visto(i.id)).length;
    const td = document.querySelector(`tr.disc[data-disc="${d}"] .prog`);
    if (td) td.textContent = `${f} de ${all.length} vistos`;
  }

  /* ---------- Edição do conteúdo ---------- */
  function gravarEdicoes() { ITENS = aplicarEdicoes(ORIGINAIS, ed); salvarEdicoes(CONCURSO, ed); }
  function alternarEdicao(on) {
    editando = on;
    $("#lapis").setAttribute("aria-pressed", on);
    $("#lapis").classList.toggle("ativo", on);
    barra.hidden = !on;
    render();
  }
  $("#lapis").addEventListener("click", () => alternarEdicao(!editando));
  $("#concluir").addEventListener("click", () => { alternarEdicao(false); barra.scrollIntoView({ block: "nearest" }); });
  $("#restaurar").addEventListener("click", () => {
    if (!confirm("Desfazer todas as suas alterações neste edital (nomes, exclusões e conteúdos adicionados)? As marcações de estudo dos conteúdos originais continuam.")) return;
    ed.renomear = {}; ed.excluidos = []; ed.adicionados = [];
    gravarEdicoes(); render();
  });

  // Renomear: salva ao sair do campo
  $("#corpo").addEventListener("input", e => {
    const campo = e.target.closest("[data-campo]"); if (!campo) return;
    const id = campo.closest("tr.item").dataset.id, chave = campo.dataset.campo, valor = campo.value.trim();
    if (!valor) return;
    const novo = ed.adicionados.find(i => i.id === id);
    if (novo) novo[chave] = valor;
    else {
      const orig = ORIGINAIS.find(i => i.id === id);
      const r = { ...(ed.renomear[id] || {}) };
      if (valor === orig[chave]) delete r[chave]; else r[chave] = valor;
      if (Object.keys(r).length) ed.renomear[id] = r; else delete ed.renomear[id];
    }
    gravarEdicoes();
  });

  $("#corpo").addEventListener("click", e => {
    const exc = e.target.closest("[data-excluir]");
    if (exc) {
      const tr = exc.closest("tr.item"), id = tr.dataset.id, item = ITENS.find(i => i.id === id);
      if (!confirm(`Excluir este conteúdo?\n\n“${item.a}”`)) return;
      const idx = ed.adicionados.findIndex(i => i.id === id);
      if (idx >= 0) ed.adicionados.splice(idx, 1); else ed.excluidos.push(id);
      delete ed.renomear[id];
      if (estado[id]) { estado[id] = 0; salvarProgresso(CONCURSO, estado); }
      gravarEdicoes(); render();
      return;
    }
    const add = e.target.closest("[data-add]");
    if (add) {
      const d = add.dataset.add;
      const id = `${d}-u${Date.now().toString(36)}`;
      const ultimo = ITENS.filter(i => i.d === d).pop();
      ed.adicionados.push({ id, d, t: ultimo ? ultimo.t : "Novo tópico", a: "Novo conteúdo" });
      gravarEdicoes();
      if (fSit.value !== "todos" || fBusca.value) { fSit.value = "todos"; fBusca.value = ""; guardaFiltros(); }
      render();
      const campo = document.querySelector(`tr.item[data-id="${id}"] .ed-a`);
      if (campo) { campo.focus(); campo.select(); }
    }
  });

  render();
}
