/* Calendário de estudo: dias estudados, dias perdidos e sequência contínua. */
import { hojeISO, marcarDia } from "./app.js";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const SEMANA = ["D","S","T","Q","Q","S","S"];
const FOGO = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M13.5 1.5s.9 3.1-1.4 6.1C10.4 9.8 8 11.4 8 15a4 4 0 0 0 8 0c0-1.6-.7-2.8-.7-2.8s2.2 1 2.2 4.3A5.6 5.6 0 0 1 12 22a6.5 6.5 0 0 1-6.5-6.6c0-4.6 3.2-6.8 5-9.2 1.6-2 3-4.7 3-4.7z"/></svg>';

function addDias(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

export function calcular(dias) {
  const hoje = new Date(); hoje.setHours(12, 0, 0, 0);
  const estudou = iso => dias[iso] === true;
  // Sequência atual: conta para trás a partir de hoje; se hoje ainda não estudou, a partir de ontem.
  let d = estudou(hojeISO(hoje)) ? hoje : addDias(hoje, -1), atual = 0;
  while (estudou(hojeISO(d))) { atual++; d = addDias(d, -1); }
  const marcados = Object.keys(dias).filter(estudou).sort();
  let melhor = 0, corrida = 0, anterior = null;
  for (const iso of marcados) {
    const dt = new Date(iso + "T12:00:00");
    corrida = anterior && hojeISO(addDias(anterior, 1)) === iso ? corrida + 1 : 1;
    melhor = Math.max(melhor, corrida); anterior = dt;
  }
  return { atual, melhor, total: marcados.length, primeiro: marcados[0] || null, estudouHoje: estudou(hojeISO(hoje)) };
}

/* provas: [{ data: "AAAA-MM-DD", nome: "Oficial de Justiça" }] */
export function montarSequencia(el, dados, provas = []) {
  const porData = {};
  for (const p of provas) (porData[p.data] = porData[p.data] || []).push(p.nome);
  const dias = dados.dias;
  const ref = new Date(); let ano = ref.getFullYear(), mes = ref.getMonth();

  function desenhar() {
    const s = calcular(dias), hoje = hojeISO();
    const inicio = s.primeiro && s.primeiro < hoje ? s.primeiro : hoje;
    const primeiroDia = new Date(ano, mes, 1).getDay(), nDias = new Date(ano, mes + 1, 0).getDate();
    let cels = SEMANA.map(l => `<span class="sq-dow" aria-hidden="true">${l}</span>`).join("");
    for (let i = 0; i < primeiroDia; i++) cels += `<span></span>`;
    for (let n = 1; n <= nDias; n++) {
      const iso = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
      const futuro = iso > hoje, fez = dias[iso] === true, perdeu = !fez && !futuro && iso >= inicio && iso < hoje;
      const prova = porData[iso];
      const cls = (fez ? "fez" : perdeu ? "perdeu" : futuro ? "futuro" : "") + (prova ? " prova" : "");
      const rot = `${n} de ${MESES[mes]}: ` + (prova ? `dia da prova (${prova.join(", ")})` : fez ? "estudou" : perdeu ? "não estudou" : futuro ? "ainda não chegou" : "sem estudo marcado");
      cels += `<button type="button" class="sq-dia ${cls}${iso === hoje ? " hoje" : ""}" data-dia="${iso}" ${futuro ? "disabled" : ""} aria-pressed="${fez}" aria-label="${rot}" title="${rot}">${n}</button>`;
    }
    const noMesAtual = ano === ref.getFullYear() && mes === ref.getMonth();
    const provasDoMes = Object.keys(porData).filter(iso => iso.startsWith(`${ano}-${String(mes + 1).padStart(2, "0")}`)).sort();
    const avisoProva = provasDoMes.map(iso => `<p class="sq-aviso-prova"><strong>${iso.slice(8)}/${iso.slice(5, 7)} é o dia da prova</strong> · ${porData[iso].join(" e ")}</p>`).join("");
    el.innerHTML = `
      <div class="sq-topo">
        <div class="sq-fogo${s.atual ? " aceso" : ""}">${FOGO}</div>
        <div><div class="sq-num">${s.atual} ${s.atual === 1 ? "dia seguido" : "dias seguidos"}</div>
        <div class="sq-sub">${s.estudouHoje ? "Hoje já conta. Continue amanhã!" : s.atual ? "Estude hoje para não perder a sequência." : "Marque um assunto para começar."}</div></div>
      </div>
      <div class="sq-stats"><span><strong>${s.melhor}</strong> melhor sequência</span><span><strong>${s.total}</strong> ${s.total === 1 ? "dia estudado" : "dias estudados"}</span></div>
      <div class="sq-nav">
        <button type="button" class="sq-seta" data-nav="-1" aria-label="Mês anterior">‹</button>
        <span class="sq-mes">${MESES[mes]} ${ano}${noMesAtual ? "" : ' <button type="button" class="sq-hoje" data-hoje>Hoje</button>'}</span>
        <button type="button" class="sq-seta" data-nav="1" aria-label="Próximo mês">›</button>
      </div>
      <div class="sq-grade">${cels}</div>
      ${avisoProva}
      <div class="sq-leg"><span><i class="fez"></i>Estudou</span><span><i class="perdeu"></i>Não estudou</span>${provas.length ? '<span><i class="prova"></i>Dia da prova</span>' : ""}</div>
      <p class="sq-dica">O dia é marcado sozinho quando você marca um assunto. Toque num dia para corrigir.</p>`;
  }

  el.addEventListener("click", e => {
    if (e.target.closest("[data-hoje]")) { ano = ref.getFullYear(); mes = ref.getMonth(); desenhar(); return; }
    const nav = e.target.closest("[data-nav]");
    if (nav) { mes += +nav.dataset.nav; if (mes < 0) { mes = 11; ano--; } if (mes > 11) { mes = 0; ano++; } desenhar(); return; }
    const b = e.target.closest("button[data-dia]");
    if (b && !b.disabled) { const iso = b.dataset.dia; marcarDia(iso, dias[iso] !== true); desenhar(); }
  });
  desenhar();
  return { atualizar: desenhar };
}

/* Marca hoje como estudado (chamado ao marcar um assunto). */
export function registrarEstudoHoje(dados, seq) {
  const hoje = hojeISO();
  if (dados.dias[hoje] === true) return;
  marcarDia(hoje, true);
  if (seq) seq.atualizar();
}
