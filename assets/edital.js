/* Edital verticalizado: checklist, gráficos, filtros e sequência de estudo.
   Cada página de concurso define window.EDITAL = { DISC, ITENS } e chama iniciarEdital(id). */
import { iniciarPagina, salvarProgresso } from "./app.js";
import { montarSequencia, registrarEstudoHoje } from "./sequencia.js";

function mostrarProva(iso) {
  const el = document.getElementById("prova");
  if (!el) return;
  const [a, m, d] = iso.split("-").map(Number);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const falta = Math.round((new Date(a, m - 1, d) - hoje) / 86400000);
  const data = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${a}`;
  el.innerHTML = falta > 0 ? `Prova em ${data} · <strong>faltam ${falta} ${falta === 1 ? "dia" : "dias"}</strong>`
    : falta === 0 ? `<strong>A prova é hoje (${data})!</strong>` : `Prova realizada em ${data}`;
  el.hidden = false;
}

export async function iniciarEdital(CONCURSO) {
  const { DISC, ITENS } = window.EDITAL;
  const { dados } = await iniciarPagina();
  const seq = montarSequencia(document.getElementById("sq"), dados);
  const ETAPAS = ["PDFs","Lei Seca","Videoaulas","Questões"];
  const N_ETAPAS = ETAPAS.length, TODAS = (1 << N_ETAPAS) - 1;
  const LS_KEY = "edital-filtros:" + CONCURSO;
  const info = (window.CONCURSOS || []).find(c => c.id === CONCURSO);
  if (info && info.prova) mostrarProva(info.prova);

  let estado = { ...(dados.progresso[CONCURSO] || {}) };   // id -> bits (PDF, lei seca, videoaula, questões)


  const $ = s => document.querySelector(s);
  const fMat = $("#f-mat"), fCrit = $("#f-crit"), fSit = $("#f-sit"), fBusca = $("#f-busca");

  fMat.innerHTML = '<option value="">Todas as matérias</option>' + DISC.map(d => `<option value="${d.id}">${d.nome}</option>`).join("");
  try { const f = JSON.parse(localStorage.getItem(LS_KEY) || "null"); if (f) { fMat.value = f.mat || ""; fCrit.value = f.crit || "estudo"; fSit.value = f.sit || "todos"; } } catch(e) {}

  function bits(id){ return (estado[id] | 0) & TODAS; }
  function visto(id){
    const b = bits(id), c = fCrit.value;
    if (c === "estudo") return (b & 0b111) !== 0;
    if (c === "tudo") return b === TODAS;
    return (b >> (+c)) & 1;
  }
  function norm(s){ return s.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase(); }

  function render(){
    const mat = fMat.value, sit = fSit.value, q = norm(fBusca.value.trim());
    const corpo = $("#corpo");
    let html = "", ultimoBloco = "", mostrados = 0;
    for (const d of DISC){
      if (mat && d.id !== mat) continue;
      const itens = ITENS.filter(i => i.d === d.id);
      const feitos = itens.filter(i => visto(i.id)).length;
      const visiveis = itens.filter(i => {
        if (sit === "falta" && visto(i.id)) return false;
        if (sit === "visto" && !visto(i.id)) return false;
        if (q && !norm(i.t + " " + i.a + " " + i.p + " " + i.o).includes(q)) return false;
        return true;
      });
      if (!visiveis.length) continue;
      if (d.bloco !== ultimoBloco){ html += `<tr class="bloco"><td colspan="5">${d.bloco}</td></tr>`; ultimoBloco = d.bloco; }
      html += `<tr class="disc"><td colspan="5">${d.nome}<span class="prog">${feitos} de ${itens.length} vistos</span></td></tr>`;
      for (const i of visiveis){
        mostrados++;
        const b = bits(i.id);
        html += `<tr class="item${visto(i.id) ? " ok" : ""}" data-id="${i.id}"><td class="c"><span class="tema">${i.t}</span><span class="ass">${i.a}</span><span class="disp">${i.p}</span>${i.o ? `<span class="obs">Obs.: ${i.o}</span>` : ""}</td>`;
        for (let k = 0; k < N_ETAPAS; k++){
          const cid = `${i.id}-${k}`;
          html += `<td class="cb"><label for="${cid}"><input type="checkbox" id="${cid}" data-k="${k}" ${(b >> k) & 1 ? "checked" : ""} aria-label="${ETAPAS[k]}: ${i.a.replace(/"/g,"&quot;")}"></label></td>`;
        }
        html += "</tr>";
      }
    }
    corpo.innerHTML = mostrados ? html : `<tr><td colspan="5" class="vazio">Nenhum assunto com esses filtros.</td></tr>`;
    graficos();
  }

  function graficos(){
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
    if (!mat){
      $("#tit-barras").textContent = "Por matéria";
      $("#dica-barras").textContent = "Toque numa matéria para ver os temas dela e filtrar a lista.";
      $("#voltar-geral").hidden = true;
      linhas = DISC.map(d => { const it = ITENS.filter(i => i.d === d.id); return {k:d.id, nome:d.nome, f:it.filter(i => visto(i.id)).length, t:it.length}; });
    } else {
      $("#tit-barras").textContent = "Por tema · " + nomeMat;
      $("#dica-barras").textContent = "";
      $("#voltar-geral").hidden = false;
      const temas = [];
      for (const i of base){ let g = temas.find(x => x.nome === i.t); if (!g){ g = {k:"", nome:i.t, f:0, t:0}; temas.push(g); } g.t++; if (visto(i.id)) g.f++; }
      linhas = temas;
    }
    $("#barras").innerHTML = linhas.map(l => {
      const p = l.t ? Math.round(l.f / l.t * 100) : 0;
      const tag = l.k ? "button" : "div";
      return `<${tag} class="barra${l.k ? "" : " static"}" ${l.k ? `type="button" data-mat="${l.k}"` : ""} title="${l.nome}: ${l.f} de ${l.t}"><span class="nome">${l.nome}</span><span class="trilho"><span style="width:${p}%"></span></span><span class="pct">${l.f}/${l.t} · ${p}%</span></${tag}>`;
    }).join("");
  }

  function guardaFiltros(){ try { localStorage.setItem(LS_KEY, JSON.stringify({mat:fMat.value, crit:fCrit.value, sit:fSit.value})); } catch(e) {} }
  [fMat, fCrit, fSit].forEach(el => el.addEventListener("change", () => { guardaFiltros(); render(); }));
  fBusca.addEventListener("input", render);
  $("#limpar").addEventListener("click", () => { fMat.value = ""; fSit.value = "todos"; fBusca.value = ""; guardaFiltros(); render(); });
  $("#voltar-geral").addEventListener("click", () => { fMat.value = ""; guardaFiltros(); render(); });
  $("#barras").addEventListener("click", e => {
    const b = e.target.closest("button[data-mat]"); if (!b) return;
    fMat.value = b.dataset.mat; guardaFiltros(); render();
    document.querySelector(".filtros").scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block:"start"});
  });

  $("#corpo").addEventListener("change", e => {
    const cb = e.target; if (!cb.matches("input[type=checkbox]")) return;
    const tr = cb.closest("tr.item"), id = tr.dataset.id, k = +cb.dataset.k;
    let b = bits(id); b = cb.checked ? (b | (1 << k)) : (b & ~(1 << k));
    estado[id] = b;
    if (cb.checked) registrarEstudoHoje(dados, seq);
    tr.classList.toggle("ok", !!visto(id));
    atualizaContagemDisc(id);
    graficos();
    salvar();
  });
  function atualizaContagemDisc(id){
    const it = ITENS.find(i => i.id === id), d = it.d;
    const all = ITENS.filter(i => i.d === d), f = all.filter(i => visto(i.id)).length;
    const nome = DISC.find(x => x.id === d).nome;
    document.querySelectorAll("tr.disc td").forEach(td => { if (td.firstChild && td.firstChild.textContent === nome) td.querySelector(".prog").textContent = `${f} de ${all.length} vistos`; });
  }

  function salvar(){ salvarProgresso(CONCURSO, estado); }
  render();
}
