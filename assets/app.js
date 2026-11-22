/* Contas e dados na nuvem (Firebase): login com usuário e senha ou com Google,
   progresso dos editais e dias de estudo salvos na conta do estudante. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  updateProfile, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = "pt";
const db = getFirestore(app);

export const RAIZ = new URL("../", import.meta.url).href;
const DOMINIO_USUARIOS = "usuarios.meusconcursos.app";

function erro(msg) { const e = new Error(msg); e.amigavel = true; return e; }

/* "Gabriel Dutra" -> "gabriel.dutra@usuarios.meusconcursos.app". Um e-mail digitado é usado como está. */
function emailDe(usuario) {
  const u = String(usuario || "").trim();
  if (u.includes("@")) return u.toLowerCase();
  const slug = u.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/\s+/g, ".").replace(/[^a-z0-9._-]/g, "").replace(/^[._-]+|[._-]+$/g, "");
  if (slug.length < 3) throw erro("O nome de usuário precisa ter pelo menos 3 letras ou números.");
  return slug + "@" + DOMINIO_USUARIOS;
}

const MENSAGENS = {
  "auth/email-already-in-use": "Esse nome de usuário já está em uso. Escolha outro ou entre.",
  "auth/invalid-credential": "Usuário ou senha incorretos.",
  "auth/wrong-password": "Usuário ou senha incorretos.",
  "auth/user-not-found": "Usuário ou senha incorretos.",
  "auth/invalid-email": "Nome de usuário inválido. Use letras, números e espaços.",
  "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
  "auth/missing-password": "Digite a senha.",
  "auth/too-many-requests": "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.",
  "auth/network-request-failed": "Sem conexão com a internet. Verifique e tente de novo.",
  "auth/popup-blocked": "O navegador bloqueou a janela do Google. Libere pop-ups para este site.",
  "auth/unauthorized-domain": "Este endereço ainda não foi liberado para login no Firebase.",
  "auth/operation-not-allowed": "Esse tipo de login ainda não foi ativado no Firebase."
};
export function mensagemDeErro(e) {
  if (e && e.amigavel) return e.message;
  if (e && (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request")) return "";
  return (e && MENSAGENS[e.code]) || "Não foi possível concluir. Tente de novo.";
}

export async function cadastrar(usuario, senha) {
  const nome = String(usuario || "").trim();
  if (nome.length > 40) throw erro("O nome de usuário pode ter no máximo 40 caracteres.");
  if (String(senha || "").length < 6) throw erro("A senha precisa ter pelo menos 6 caracteres.");
  const cred = await createUserWithEmailAndPassword(auth, emailDe(nome), senha);
  await updateProfile(cred.user, { displayName: nome });
  await setDoc(doc(db, "usuarios", cred.user.uid), { nome, criado: serverTimestamp() }, { merge: true });
  return cred.user;
}

export async function entrar(usuario, senha) {
  if (!senha) throw erro("Digite a senha.");
  return (await signInWithEmailAndPassword(auth, emailDe(usuario), senha)).user;
}

export async function entrarComGoogle() {
  const prov = new GoogleAuthProvider();
  prov.setCustomParameters({ prompt: "select_account" });
  try { return (await signInWithPopup(auth, prov)).user; }
  catch (e) {
    if (e.code === "auth/popup-blocked") { await signInWithRedirect(auth, prov); return null; }
    throw e;
  }
}

export async function sair() {
  await signOut(auth);
  location.href = RAIZ + "index.html";
}

/* Espera o Firebase dizer quem está logado (ou null). */
export function usuarioAtual() {
  return new Promise(res => { const off = onAuthStateChanged(auth, u => { off(); res(u); }); });
}

export function nomeDe(user, dados) {
  return user.displayName || (dados && dados.nome) || (user.email || "").split("@")[0];
}

/* Só volta para páginas deste mesmo site. */
export function destinoSeguro(volta) {
  try {
    const url = new URL(volta, location.href);
    if (url.origin === location.origin && url.href.startsWith(RAIZ)) return url.href;
  } catch (e) {}
  return RAIZ + "concursos.html";
}

/* Páginas protegidas: manda para o login se ninguém entrou; senão carrega os dados. */
export async function iniciarPagina() {
  const user = await usuarioAtual();
  if (!user) {
    location.replace(RAIZ + "index.html?volta=" + encodeURIComponent(location.href));
    return new Promise(() => {});
  }
  const dados = await carregarDados(user);
  const nome = nomeDe(user, dados);
  document.querySelectorAll("[data-usuario]").forEach(el => el.textContent = nome);
  document.querySelectorAll("[data-sair]").forEach(b => b.addEventListener("click", sair));
  document.documentElement.classList.remove("carregando");
  return { user, dados, nome };
}

/* ---------- Dados do estudante: usuarios/{uid} = { nome, progresso: {concurso: {item: bits}}, dias: {"AAAA-MM-DD": true} } ---------- */
let ref = null, dadosAtuais = null;

async function carregarDados(user) {
  ref = doc(db, "usuarios", user.uid);
  let snap;
  try { snap = await getDoc(ref); }
  catch (e) { aviso("Não consegui carregar seus dados. Verifique a internet e recarregue a página."); throw e; }
  dadosAtuais = snap.exists() ? snap.data() : {};
  dadosAtuais.progresso = dadosAtuais.progresso || {};
  dadosAtuais.dias = dadosAtuais.dias || {};
  if (!snap.exists() || !dadosAtuais.nome) {
    dadosAtuais.nome = user.displayName || (user.email || "").split("@")[0];
    setDoc(ref, { nome: dadosAtuais.nome, criado: serverTimestamp() }, { merge: true }).catch(() => {});
  }
  return dadosAtuais;
}

const pendentes = {};
let timer = null;
function gravarPendentes() {
  clearTimeout(timer); timer = null;
  const lote = {};
  for (const [cid, estado] of Object.entries(pendentes)) { lote[cid] = estado; delete pendentes[cid]; }
  if (!Object.keys(lote).length) return;
  setDoc(ref, { progresso: lote }, { merge: true })
    .catch(() => aviso("Não consegui salvar. Verifique a internet: o que você marcar agora pode se perder."));
}
export function salvarProgresso(concursoId, estado) {
  pendentes[concursoId] = { ...estado };
  clearTimeout(timer); timer = setTimeout(gravarPendentes, 700);
}
addEventListener("pagehide", gravarPendentes);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") gravarPendentes(); });

export function hojeISO(d = new Date()) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
export function marcarDia(dia, estudou) {
  dadosAtuais.dias[dia] = !!estudou;
  return setDoc(ref, { dias: { [dia]: !!estudou } }, { merge: true })
    .catch(() => aviso("Não consegui salvar o dia no calendário. Verifique a internet."));
}

/* Aviso discreto no rodapé da tela (só para problemas). */
function aviso(texto) {
  let el = document.getElementById("aviso-app");
  if (!el) {
    el = document.createElement("div"); el.id = "aviso-app"; el.setAttribute("role", "alert");
    el.style.cssText = "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);max-width:calc(100% - 32px);background:#b3261e;color:#fff;padding:10px 14px;border-radius:4px;font:14px Arial,sans-serif;z-index:99;box-shadow:0 4px 14px rgba(0,0,0,.25)";
    document.body.appendChild(el);
  }
  el.textContent = texto;
  clearTimeout(aviso.t); aviso.t = setTimeout(() => el.remove(), 7000);
}
