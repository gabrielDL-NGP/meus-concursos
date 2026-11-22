/* Lista de concursos. Para incluir um novo, copie um bloco, troque os dados
   e crie a página dele dentro da pasta "concursos/" (o "id" identifica o progresso salvo).
   "prova" é a data da prova no formato AAAA-MM-DD. */
window.CONCURSOS = [
  {
    id: "tjsp-oficial-2026",
    sigla: "TJSP",
    orgao: "Tribunal de Justiça de São Paulo",
    cargo: "Oficial de Justiça",
    ano: 2026,
    descricao: "Edital verticalizado com checklist de PDFs, lei seca, videoaulas e questões.",
    materias: 11,
    assuntos: 219,
    prova: "2027-03-14",
    pagina: "concursos/tjsp-oficial-2026.html"
  },
  {
    id: "tjsp-escrevente-2026",
    sigla: "TJSP",
    orgao: "Tribunal de Justiça de São Paulo",
    cargo: "Escrevente Técnico Judiciário",
    ano: 2026,
    descricao: "Edital verticalizado com checklist de PDFs, lei seca, videoaulas e questões.",
    materias: 11,
    assuntos: 205,
    prova: "2027-03-14",
    pagina: "concursos/tjsp-escrevente-2026.html"
  }
];

/* Texto da contagem regressiva até a prova. */
window.textoProva = function (iso) {
  const [a, m, d] = iso.split("-").map(Number);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const falta = Math.round((new Date(a, m - 1, d) - hoje) / 86400000);
  const data = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${a}`;
  if (falta > 0) return { data, resumo: `faltam ${falta} ${falta === 1 ? "dia" : "dias"}` };
  if (falta === 0) return { data, resumo: "é hoje!" };
  return { data, resumo: "prova realizada" };
};
