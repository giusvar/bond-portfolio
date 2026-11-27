// Aggiorna prices.json leggendo le schede di Borsa Italiana.
// Logica portata da bond_portfolio_v4_ip156.ino (nome, prezzo, variazione).
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ISINS = ["DE0001135275","XS2647979181","FR001400QMF9","ES0000012P33","IT0005442089","IT0005491250","IT0005518128","IT0005547390","IT0005583478","IT0005594483","LU1681047236","IT0000380706","IT0003409213","IT0004097405","IT0005379083","IT0005218380","IT0005696338","IT0005684888","IT0005713539"];

const B = "https://www.borsaitaliana.it/borsa/";
const BTP = (c) => `${B}obbligazioni/mot/btp/scheda/${c}-MOTX.html?lang=it`;
const SPECIALI = {
  IT0005442089: BTP("IT0005442097"),
  IT0005547390: BTP("IT0005547408"),
  IT0005583478: BTP("IT0005583486"),
  IT0005594483: BTP("IT0005594483"),
  IT0005696338: BTP("IT0005696338"),
  IT0005713539: BTP("IT0005713539"),
  IT0005379083: B + "fondi/dettaglio/1FADB542293.html",
  IT0000380706: B + "fondi/dettaglio/1VISC.html",
  IT0003409213: B + "fondi/dettaglio/1ETVRBI.html",
  IT0004097405: B + "fondi/dettaglio/1ETVRAZ.html",
  IT0005218380: `${B}azioni/scheda/IT0005218380-MTAA.html?lang=it`,
};
const url = (i) => SPECIALI[i] || (i.startsWith("LU")
  ? `${B}etf/scheda/${i}-ETFP.html?lang=it`
  : `${B}obbligazioni/mot/euro-obbligazioni/scheda/${i}-MOTX.html?lang=it`);

function parse(h) {
  let nome = "";
  const h1 = h.indexOf("<h1");
  if (h1 !== -1) {
    const a = h.indexOf(">", h1) + 1, b = h.indexOf("</", a);
    if (b !== -1) {
      nome = h.substring(a, b).trim();
      let k = nome.indexOf(">"); if (k !== -1) nome = nome.substring(k + 1);
      k = nome.indexOf("</a>"); if (k !== -1) nome = nome.substring(0, k);
    }
  }
  const st = []; let pos = 0;
  while (st.length < 30) {
    let a = h.indexOf("<strong>", pos); if (a === -1) break; a += 8;
    const b = h.indexOf("</strong>", a); if (b === -1) break;
    st.push(h.substring(a, b).replaceAll("&nbsp;", " ").trim());
    pos = b + 9;
  }
  let prezzo = "";
  if (st.length > 1 && st[1] && st[1] !== "+0,00%" && st[1] !== "-0,00%") prezzo = st[1];
  else {
    let r = h.indexOf("<strong>Prezzo di riferimento</strong>");
    if (r !== -1) {
      r = h.indexOf("</tr>", r);
      let t = h.lastIndexOf("<td>", r);
      if (t !== -1 && t > r - 200) {
        t = h.indexOf(">", t + 4);
        if (t !== -1) { t++; const e = h.indexOf("<", t); if (e !== -1) prezzo = h.substring(t, e).replace(/&nbsp;|\s/g, "").trim(); }
      }
    }
  }
  let variazione = st.length > 2 ? st[2] : "";
  if ((variazione === "" || variazione === "0,00%") && st.length > 0 && (st[0].includes("+") || st[0].includes("-"))) variazione = st[0];
  return { nome, prezzo, variazione };
}

let prev = {};
if (existsSync("prices.json")) {
  const j = JSON.parse(readFileSync("prices.json", "utf8"));
  if (!j._test) prev = j.prices || {};
}

const out = {}; let ok = 0;
for (const i of ISINS) {
  try {
    const r = await fetch(url(i), { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const d = parse(await r.text());
    if (!d.prezzo) throw new Error("prezzo non trovato");
    out[i] = { ...d, ok: true }; ok++;
    console.log("OK ", i, "|", d.nome, "|", d.prezzo, "|", d.variazione);
  } catch (e) {
    const p = prev[i] || {};
    out[i] = { nome: p.nome || "", prezzo: p.prezzo || "", variazione: p.variazione || "", ok: false };
    console.log("ERR", i, "|", e.message);
  }
  await new Promise((r) => setTimeout(r, 1000));
}

console.log(`Titoli letti: ${ok}/${ISINS.length}`);
if (ok === 0) { console.error("Nessun titolo letto: prices.json non modificato."); process.exit(1); }
writeFileSync("prices.json", JSON.stringify({ updated: new Date().toISOString(), prices: out }, null, 1) + "\n");
