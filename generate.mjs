#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const WM = process.env.WM || 'T2CSW';
const API = `https://chaturbate.com/api/public/affiliates/onlinerooms/?wm=${WM}&client_ip=request_ip&limit=500`;
const OUT = path.resolve(process.env.OUT_DIR || 'dist');
const TARGET_PAGES = parseInt(process.env.TARGET_PAGES || '200', 10);
const THEME = process.env.THEME || 'oxblood';

const SITE_NAME = process.env.SITE_NAME || 'CamIndex';
const SITE_DESC = 'Live cam room index, sorted by tag, country and language. Compare viewers, HD streams, languages, and locations across thousands of live broadcasters in one dense, scannable table.';
const SITE_URL = process.env.SITE_URL || 'https://livecamrooms.github.io/LiveCam';

// ---- file naming helpers ----
const slugify = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const tagFile = (slug) => `tag-${slug}.html`;
const countryFile = (code) => `country-${slugify(code)}.html`;
const langFile = (code) => `lang-${slugify(code)}.html`;
const genderFile = (g) => `gender-${g}.html`;
const tagGenderFile = (slug, g) => `tag-${slug}-${g}.html`;
const tagCountryFile = (slug, code) => `tag-${slug}-in-${slugify(code)}.html`;
const tagLangFile = (slug, lang) => `tag-${slug}-lang-${slugify(lang)}.html`;
const genderCountryFile = (g, code) => `gender-${g}-in-${slugify(code)}.html`;
const genderLangFile = (g, lang) => `gender-${g}-lang-${slugify(lang)}.html`;
const countryLangFile = (code, lang) => `country-${slugify(code)}-lang-${slugify(lang)}.html`;

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtNum(n) { if (n == null) return ''; if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k'; return String(n); }
function fmtDuration(sec) { if (!sec || sec < 0) return ''; const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); if (h > 0) return `${h}h ${m}m`; return `${m}m`; }
function genderLabel(g) { return ({ f: 'Female', m: 'Male', c: 'Couple', t: 'Trans', s: 'Couple' })[g] || 'Other'; }
function revshareUrl(room) {
  if (room.chat_room_url_revshare) return room.chat_room_url_revshare;
  return `https://chaturbate.com/in/?tour=LQps&campaign=${WM}&track=default&room=${encodeURIComponent(room.username)}`;
}

// ---- themes ----
const THEMES = {
  oxblood: `
:root{
  --bg:#0c0708;--panel:#150a0c;--panel2:#1c0e10;--row:#130809;--rowAlt:#170a0c;
  --border:#2a1418;--text:#ece2e2;--mute:#8a7a7c;--accent:#6b0f1a;--accent2:#8b1a24;
  --link:#c4848a;--ok:#3ddc84;--warn:#d4a04a;--bad:#ff5a5a;--cta-text:#fff;
}`,
  black: `
:root{
  --bg:#000000;--panel:#0a0a0a;--panel2:#111111;--row:#070707;--rowAlt:#0d0d0d;
  --border:#1f1f1f;--text:#ededed;--mute:#7d7d7d;--accent:#ffffff;--accent2:#cfcfcf;
  --link:#bdbdbd;--ok:#9dd6a8;--warn:#d4c79a;--bad:#e09a9a;--cta-text:#000;
}`,
};

const CSS = (theme) => `
${THEMES[theme] || THEMES.oxblood}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--text);font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
a{color:var(--link);text-decoration:none}
a:hover{text-decoration:underline}
header{background:var(--panel);border-bottom:1px solid var(--border);padding:10px 16px}
header .row{display:flex;align-items:center;gap:14px;flex-wrap:wrap;max-width:1600px;margin:0 auto}
header h1{margin:0;font-size:18px;letter-spacing:.5px}
header h1 a{color:var(--text)}
header .crumb{color:var(--accent);font-weight:600}
header .age{margin-left:auto;font-size:11px;color:var(--accent2);border:1px solid var(--accent2);padding:2px 6px;border-radius:3px;letter-spacing:.5px}
nav.tags{background:var(--panel2);border-bottom:1px solid var(--border);padding:8px 16px;font-size:12px}
nav.tags .wrap{max-width:1600px;margin:0 auto;display:flex;flex-wrap:wrap;gap:6px 10px}
nav.tags a{color:var(--mute)}
nav.tags a:hover{color:var(--link)}
nav.tags strong{color:var(--text);margin-right:8px}
.intro{max-width:1600px;margin:0 auto;padding:14px 16px;color:var(--mute);font-size:13px}
.intro h2{color:var(--text);margin:0 0 6px;font-size:15px}
main{max-width:1600px;margin:0 auto;padding:0 8px 40px}
table{width:100%;border-collapse:collapse;font-size:12.5px;background:var(--panel)}
thead th{position:sticky;top:0;background:var(--panel2);color:var(--mute);text-align:left;font-weight:600;
  padding:7px 8px;border-bottom:1px solid var(--border);white-space:nowrap;cursor:pointer;user-select:none}
thead th .arr{opacity:.4;margin-left:3px}
thead th.sorted .arr{opacity:1;color:var(--accent)}
tbody tr{border-bottom:1px solid var(--border)}
tbody tr:nth-child(odd){background:var(--row)}
tbody tr:nth-child(even){background:var(--rowAlt)}
tbody tr:hover{background:var(--panel2)}
td{padding:6px 8px;vertical-align:middle;white-space:nowrap}
td.thumb{padding:4px 6px;width:130px}
td.thumb img{display:block;width:120px;height:90px;object-fit:cover;border-radius:3px;background:#000;border:1px solid var(--border)}
td.thumb a{display:block;line-height:0}
td.subj{white-space:normal;max-width:420px;color:var(--mute);font-size:12px}
td.name a{font-weight:600;color:var(--text)}
td.name a:hover{color:var(--link)}
td.num{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;text-align:right}
td.cta a{display:inline-block;background:var(--accent);color:var(--cta-text);font-weight:700;padding:5px 10px;border-radius:3px;font-size:12px;border:1px solid var(--accent2)}
td.cta a:hover{background:var(--accent2);text-decoration:none}
.badge{display:inline-block;font-size:10px;padding:1px 5px;border-radius:2px;border:1px solid var(--border);color:var(--mute);margin-left:4px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.badge.hd{color:var(--ok);border-color:var(--ok)}
.badge.new{color:var(--warn);border-color:var(--warn)}
.badge.g-f{color:#ff7eb6;border-color:#5c2742}
.badge.g-m{color:#7cc4ff;border-color:#1f4a6b}
.badge.g-c{color:#c084fc;border-color:#4b2470}
.badge.g-t{color:#fbbf24;border-color:#5c4720}
.controls{display:flex;gap:8px;align-items:center;padding:10px 8px;flex-wrap:wrap}
.controls input,.controls select{background:var(--panel2);color:var(--text);border:1px solid var(--border);padding:6px 8px;border-radius:3px;font:inherit}
.controls input{flex:1;min-width:200px;max-width:400px}
.controls .count{color:var(--mute);font-size:12px;margin-left:auto}
section.browse{max-width:1600px;margin:24px auto 0;padding:0 16px}
section.browse h2{font-size:14px;color:var(--text);border-bottom:1px solid var(--border);padding-bottom:6px;margin:18px 0 0}
section.browse .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:4px 14px;font-size:12px;padding:10px 0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
section.browse .grid a{color:var(--link)}
section.browse .grid .c{color:#555}
footer{max-width:1600px;margin:30px auto 0;padding:20px 16px;color:var(--mute);font-size:11px;border-top:1px solid var(--border);line-height:1.6}
footer h3{color:var(--text);margin:18px 0 6px;font-size:13px}
footer p{margin:6px 0}
footer a{color:var(--mute);text-decoration:underline}
.empty{padding:40px;text-align:center;color:var(--mute)}
@media(max-width:900px){
  td.subj{max-width:240px}
  .hide-sm{display:none}
}
`;

const JS = `
(function(){
  const tbody=document.querySelector('table tbody');if(!tbody)return;
  const rows=Array.from(tbody.querySelectorAll('tr'));
  const search=document.getElementById('q'),genderSel=document.getElementById('g'),countEl=document.getElementById('count');
  const ths=document.querySelectorAll('thead th[data-sort]');let sortKey=null,sortDir=1;
  function update(){const q=(search.value||'').toLowerCase(),g=genderSel.value;let s=0;
    for(const r of rows){const ok=(!q||r.dataset.search.includes(q))&&(!g||r.dataset.gender===g);r.style.display=ok?'':'none';if(ok)s++;}
    countEl.textContent=s+' of '+rows.length+' rooms';}
  search.addEventListener('input',update);genderSel.addEventListener('change',update);
  ths.forEach(th=>th.addEventListener('click',()=>{const k=th.dataset.sort;
    if(sortKey===k)sortDir=-sortDir;else{sortKey=k;sortDir=th.dataset.dir==='asc'?1:-1;}
    ths.forEach(t=>t.classList.remove('sorted'));th.classList.add('sorted');
    const sorted=rows.slice().sort((a,b)=>{const av=a.dataset[k],bv=b.dataset[k],an=parseFloat(av),bn=parseFloat(bv);
      if(!isNaN(an)&&!isNaN(bn))return(an-bn)*sortDir;return String(av).localeCompare(String(bv))*sortDir;});
    const f=document.createDocumentFragment();sorted.forEach(r=>f.appendChild(r));tbody.appendChild(f);}));
  update();
})();
`;

function renderHead(title, desc) {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="rating" content="adult">
<meta name="RATING" content="RTA-5042-1996-1400-1577-RTA">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index,follow">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<style>${CSS(THEME)}</style>
</head><body>`;
}

function renderHeader(crumbHtml) {
  return `<header><div class="row">
<h1><a href="index.html">${SITE_NAME}</a>${crumbHtml ? ` <span style="color:var(--mute);font-weight:400">/</span> <span class="crumb">${crumbHtml}</span>` : ''}</h1>
<span class="age">18+ ADULTS ONLY</span>
</div></header>`;
}

function renderTagNav(allTags, currentSlug) {
  const top = allTags.slice(0, 60);
  return `<nav class="tags"><div class="wrap"><strong>Browse tags:</strong>
${top.map(t => t.slug === currentSlug
    ? `<span style="color:var(--accent);font-weight:600">#${esc(t.slug)}</span>`
    : `<a href="${esc(tagFile(t.slug))}">#${esc(t.slug)}</a>`).join('')}
<a href="index.html#all-tags" style="color:var(--link);margin-left:8px">all tags →</a>
</div></nav>`;
}

function renderControls() {
  return `<div class="controls">
<input id="q" type="search" placeholder="Filter by name, tag, location, language…">
<select id="g">
  <option value="">All genders</option><option value="f">Female</option><option value="m">Male</option>
  <option value="c">Couple</option><option value="t">Trans</option>
</select>
<span class="count" id="count"></span>
</div>`;
}

function renderTable(rooms) {
  if (!rooms.length) return `<div class="empty">No live rooms found right now. Check back shortly — broadcasters come online around the clock.</div>`;
  const head = `<thead><tr>
<th>Cam</th>
<th data-sort="viewers" data-dir="desc" class="sorted">Viewers <span class="arr">▼</span></th>
<th data-sort="name" data-dir="asc">Broadcaster <span class="arr">↕</span></th>
<th data-sort="gender" data-dir="asc" class="hide-sm">Gender <span class="arr">↕</span></th>
<th data-sort="age" data-dir="asc" class="hide-sm">Age <span class="arr">↕</span></th>
<th data-sort="country" data-dir="asc" class="hide-sm">Country <span class="arr">↕</span></th>
<th data-sort="lang" data-dir="asc" class="hide-sm">Language <span class="arr">↕</span></th>
<th data-sort="online" data-dir="desc" class="hide-sm">Online <span class="arr">↕</span></th>
<th data-sort="followers" data-dir="desc" class="hide-sm">Followers <span class="arr">↕</span></th>
<th>Topic / Tags</th>
<th>Watch</th>
</tr></thead>`;
  const body = rooms.map(r => {
    const url = revshareUrl(r);
    const gender = r.gender || '';
    const tags = (r.tags || []).slice(0, 6);
    const search = [r.username, r.display_name, r.country, r.location, r.spoken_languages, ...(r.tags || []), r.room_subject].filter(Boolean).join(' ').toLowerCase();
    return `<tr
data-search="${esc(search)}" data-gender="${esc(gender)}"
data-viewers="${r.num_users || 0}" data-followers="${r.num_followers || 0}"
data-age="${r.age || 0}" data-online="${r.seconds_online || 0}"
data-name="${esc((r.username || '').toLowerCase())}"
data-country="${esc(r.country || '')}" data-lang="${esc(r.spoken_languages || '')}">
<td class="thumb"><a href="${esc(url)}" rel="nofollow sponsored noopener" target="_blank"><img src="${esc(r.image_url || '')}" alt="${esc(r.username)} live cam thumbnail" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'"></a></td>
<td class="num"><strong>${fmtNum(r.num_users)}</strong></td>
<td class="name"><a href="${esc(url)}" rel="nofollow sponsored noopener" target="_blank">${esc(r.display_name || r.username)}</a>
  ${r.is_hd ? '<span class="badge hd">HD</span>' : ''}${r.is_new ? '<span class="badge new">NEW</span>' : ''}</td>
<td class="hide-sm"><span class="badge g-${esc(gender)}">${esc(genderLabel(gender))}</span></td>
<td class="num hide-sm">${r.age || ''}</td>
<td class="hide-sm">${esc(r.country || '')}</td>
<td class="hide-sm">${esc((r.spoken_languages || '').split('/')[0] || '')}</td>
<td class="num hide-sm">${esc(fmtDuration(r.seconds_online))}</td>
<td class="num hide-sm">${fmtNum(r.num_followers)}</td>
<td class="subj">${esc((r.room_subject || '').slice(0, 140))}<br>${tags.map(t => `<a href="${esc(tagFile(slugify(t)))}" style="color:var(--mute);font-size:11px">#${esc(t)}</a>`).join(' ')}</td>
<td class="cta"><a href="${esc(url)}" rel="nofollow sponsored noopener" target="_blank">Open Cam →</a></td>
</tr>`;
  }).join('\n');
  return `<table>${head}<tbody>${body}</tbody></table>`;
}

function renderFooter() {
  return `<footer>
<h3>About this index</h3>
<p>${SITE_NAME} is an independent, automatically-generated directory of public live cam rooms from Chaturbate.com. Data is refreshed at build time from Chaturbate's public affiliate API. Listings, viewer counts, tags, and broadcaster information are pulled directly from that feed and may change at any moment. Clicking any listing opens the broadcaster's room on Chaturbate.com in a new tab.</p>
<h3>Affiliate disclosure</h3>
<p>${SITE_NAME} participates in the Chaturbate Affiliate Program. All outbound links on this site are affiliate links. If you sign up, purchase tokens, or become a paying member through one of our links, we may earn a revenue-share commission from Chaturbate at no additional cost to you. We are an independent third party and are not owned, operated, or endorsed by Chaturbate, Multi Media LLC, or any of its affiliates. All trademarks are the property of their respective owners.</p>
<h3>18 U.S.C. § 2257 compliance statement</h3>
<p>${SITE_NAME} is not a producer (primary or secondary) of any of the visual content found on this website or on the third-party sites linked from it. With respect to records as per 18 U.S.C. § 2257 for any and all visual content found on this site, please direct your request to the site for which the content was produced. ${SITE_NAME} hosts no images, video, or live streams; we link to publicly listed rooms on Chaturbate.com, which maintains its own 2257 records.</p>
<h3>Adults only — 18+ / 21+ where required</h3>
<p>This website and the sites it links to contain sexually explicit material intended solely for consenting adults. By accessing this site you affirm under penalty of perjury that you are at least 18 years of age (or 21 where required by your jurisdiction), that viewing such material is legal in your community, and that you wish to view such material for your own personal use. If any of these conditions do not apply, you must leave this site immediately.</p>
<p>Parents: ${SITE_NAME} is labeled with the Restricted To Adults (RTA) website label to better enable parental filtering. For more information about protecting minors online see <a href="https://www.rtalabel.org/" rel="nofollow noopener" target="_blank">RTALabel.org</a>, <a href="https://www.asacp.org/" rel="nofollow noopener" target="_blank">ASACP.org</a>, and tools such as <a href="https://www.netnanny.com/" rel="nofollow noopener" target="_blank">Net Nanny</a> or <a href="https://www.cybersitter.com/" rel="nofollow noopener" target="_blank">CyberSitter</a>.</p>
<h3>No solicitation, no underage content</h3>
<p>${SITE_NAME} has a zero-tolerance policy against any form of child sexual abuse material (CSAM) and against non-consensual content. All broadcasters appearing in listings have been age-verified by Chaturbate.com under its own broadcaster verification and 18 U.S.C. § 2257 procedures. If you believe any link on this site points to material that violates this policy, report it immediately to Chaturbate's compliance team and to the <a href="https://report.cybertip.org/" rel="nofollow noopener" target="_blank">National Center for Missing &amp; Exploited Children</a>.</p>
<h3>Data &amp; privacy</h3>
<p>${SITE_NAME} is a static site. We do not run analytics, set cookies, or collect any personally identifiable information from visitors of this site. Outbound clicks open Chaturbate.com, which has its own <a href="https://chaturbate.com/privacy/" rel="nofollow noopener" target="_blank">privacy policy</a> and <a href="https://chaturbate.com/terms/" rel="nofollow noopener" target="_blank">terms of service</a>. Affiliate attribution (campaign code <code>${WM}</code>) is appended to outbound URLs so Chaturbate can credit referrals to this site.</p>
<h3>DMCA</h3>
<p>${SITE_NAME} does not host any user-uploaded media. All visual content visible after clicking an outbound link is hosted by Chaturbate.com. DMCA notices for content displayed on Chaturbate must be sent to Chaturbate's designated DMCA agent, per the procedure published at <a href="https://chaturbate.com/dmca/" rel="nofollow noopener" target="_blank">chaturbate.com/dmca</a>.</p>
<p style="margin-top:18px;color:#555">${esc(SITE_NAME)} · static directory · built ${new Date().toISOString().slice(0, 10)} · <a href="index.html#all-tags">all tags</a> · <a href="https://chaturbate.com/affiliates/in/?campaign=${WM}" rel="nofollow sponsored noopener" target="_blank">become an affiliate</a></p>
</footer>`;
}

async function main() {
  console.log(`Fetching API… (theme=${THEME}, target=${TARGET_PAGES})`);
  const res = await fetch(API);
  const json = await res.json();
  const rooms = json.results || [];
  console.log(`Got ${rooms.length} rooms`);

  // ---- aggregate dimensions ----
  const tagMap = new Map();
  const countryMap = new Map();
  const langMap = new Map();
  const genderMap = new Map();
  const tagGenderMap = new Map();
  const tagCountryMap = new Map();
  const tagLangMap = new Map();
  const genderCountryMap = new Map();
  const genderLangMap = new Map();
  const countryLangMap = new Map();

  for (const r of rooms) {
    const g = r.gender || 'o';
    const country = r.country || '';
    const langs = (r.spoken_languages || '').split('/').map(s => s.trim()).filter(Boolean);

    if (!genderMap.has(g)) genderMap.set(g, { key: g, label: genderLabel(g), rooms: [] });
    genderMap.get(g).rooms.push(r);

    if (country) {
      if (!countryMap.has(country)) countryMap.set(country, { key: country, label: country, rooms: [] });
      countryMap.get(country).rooms.push(r);
      const gcKey = `${g}|${country}`;
      if (!genderCountryMap.has(gcKey)) genderCountryMap.set(gcKey, { gender: g, country, label: `${genderLabel(g)} in ${country}`, rooms: [] });
      genderCountryMap.get(gcKey).rooms.push(r);
    }
    for (const l of langs) {
      if (!langMap.has(l)) langMap.set(l, { key: l, label: l, rooms: [] });
      langMap.get(l).rooms.push(r);
      const glKey = `${g}|${l}`;
      if (!genderLangMap.has(glKey)) genderLangMap.set(glKey, { gender: g, lang: l, label: `${genderLabel(g)} · ${l}`, rooms: [] });
      genderLangMap.get(glKey).rooms.push(r);
      if (country) {
        const clKey = `${country}|${l}`;
        if (!countryLangMap.has(clKey)) countryLangMap.set(clKey, { country, lang: l, label: `${l} in ${country}`, rooms: [] });
        countryLangMap.get(clKey).rooms.push(r);
      }
    }

    const seenTags = new Set();
    for (const t of (r.tags || [])) {
      const slug = slugify(t);
      if (!slug || seenTags.has(slug)) continue;
      seenTags.add(slug);
      if (!tagMap.has(slug)) tagMap.set(slug, { slug, label: t, rooms: [] });
      tagMap.get(slug).rooms.push(r);

      const tgKey = `${slug}|${g}`;
      if (!tagGenderMap.has(tgKey)) tagGenderMap.set(tgKey, { slug, gender: g, label: `#${slug} · ${genderLabel(g)}`, rooms: [] });
      tagGenderMap.get(tgKey).rooms.push(r);

      if (country) {
        const tcKey = `${slug}|${country}`;
        if (!tagCountryMap.has(tcKey)) tagCountryMap.set(tcKey, { slug, country, label: `#${slug} in ${country}`, rooms: [] });
        tagCountryMap.get(tcKey).rooms.push(r);
      }
      for (const l of langs) {
        const tlKey = `${slug}|${l}`;
        if (!tagLangMap.has(tlKey)) tagLangMap.set(tlKey, { slug, lang: l, label: `#${slug} · ${l}`, rooms: [] });
        tagLangMap.get(tlKey).rooms.push(r);
      }
    }
  }

  const allTagsSorted = Array.from(tagMap.values()).sort((a, b) => b.rooms.length - a.rooms.length);
  const allCountries = Array.from(countryMap.values()).sort((a, b) => b.rooms.length - a.rooms.length);
  const allLangs = Array.from(langMap.values()).sort((a, b) => b.rooms.length - a.rooms.length);
  const allGenders = Array.from(genderMap.values()).sort((a, b) => b.rooms.length - a.rooms.length);
  const tagGenders = Array.from(tagGenderMap.values()).sort((a, b) => b.rooms.length - a.rooms.length);
  const tagCountries = Array.from(tagCountryMap.values()).sort((a, b) => b.rooms.length - a.rooms.length);
  const tagLangs = Array.from(tagLangMap.values()).sort((a, b) => b.rooms.length - a.rooms.length);
  const genderCountries = Array.from(genderCountryMap.values()).sort((a, b) => b.rooms.length - a.rooms.length);
  const genderLangs = Array.from(genderLangMap.values()).sort((a, b) => b.rooms.length - a.rooms.length);
  const countryLangs = Array.from(countryLangMap.values()).sort((a, b) => b.rooms.length - a.rooms.length);

  console.log(`Tags=${allTagsSorted.length} Countries=${allCountries.length} Langs=${allLangs.length} TG=${tagGenders.length} TC=${tagCountries.length} TL=${tagLangs.length} GC=${genderCountries.length} GL=${genderLangs.length} CL=${countryLangs.length}`);

  // ---- build page list to TARGET_PAGES ----
  const pages = []; // {file, title, desc, rooms, crumb}

  // 1. Index
  pages.push({ file: 'index.html', kind: 'index' });

  // 2. Tag pages (all)
  for (const t of allTagsSorted) {
    pages.push({
      file: tagFile(t.slug),
      kind: 'tag',
      crumb: `#${esc(t.slug)}`,
      title: `#${t.slug} live cams — ${t.rooms.length} rooms · ${SITE_NAME}`,
      desc: `Live broadcasters tagged #${t.slug} on Chaturbate, sorted by viewer count. ${t.rooms.length} rooms currently online.`,
      h2: `#${esc(t.slug)} live cams`,
      lede: `${t.rooms.length} broadcasters currently live with the <strong>#${esc(t.slug)}</strong> tag.`,
      rooms: t.rooms,
    });
    if (pages.length >= TARGET_PAGES) break;
  }

  // 3. Country pages
  if (pages.length < TARGET_PAGES) {
    for (const c of allCountries) {
      pages.push({
        file: countryFile(c.key),
        kind: 'country',
        crumb: `country: ${esc(c.label)}`,
        title: `Live cams from ${c.label} — ${c.rooms.length} rooms · ${SITE_NAME}`,
        desc: `Live broadcasters from ${c.label} on Chaturbate, sorted by viewer count. ${c.rooms.length} rooms currently online.`,
        h2: `Live cams from ${esc(c.label)}`,
        lede: `${c.rooms.length} broadcasters currently live from <strong>${esc(c.label)}</strong>.`,
        rooms: c.rooms,
      });
      if (pages.length >= TARGET_PAGES) break;
    }
  }

  // 4. Language pages
  if (pages.length < TARGET_PAGES) {
    for (const l of allLangs) {
      pages.push({
        file: langFile(l.key),
        kind: 'lang',
        crumb: `language: ${esc(l.label)}`,
        title: `${l.label}-speaking live cams — ${l.rooms.length} rooms · ${SITE_NAME}`,
        desc: `Live broadcasters speaking ${l.label} on Chaturbate, sorted by viewer count.`,
        h2: `${esc(l.label)}-speaking live cams`,
        lede: `${l.rooms.length} broadcasters currently live speaking <strong>${esc(l.label)}</strong>.`,
        rooms: l.rooms,
      });
      if (pages.length >= TARGET_PAGES) break;
    }
  }

  // 5. Gender pages
  if (pages.length < TARGET_PAGES) {
    for (const g of allGenders) {
      pages.push({
        file: genderFile(g.key),
        kind: 'gender',
        crumb: `${esc(g.label)}`,
        title: `${g.label} live cams — ${g.rooms.length} rooms · ${SITE_NAME}`,
        desc: `${g.label} live broadcasters on Chaturbate, sorted by viewer count.`,
        h2: `${esc(g.label)} live cams`,
        lede: `${g.rooms.length} <strong>${esc(g.label)}</strong> broadcasters currently live.`,
        rooms: g.rooms,
      });
      if (pages.length >= TARGET_PAGES) break;
    }
  }

  // 6. Tag × Gender combos
  if (pages.length < TARGET_PAGES) {
    for (const tg of tagGenders) {
      pages.push({
        file: tagGenderFile(tg.slug, tg.gender),
        kind: 'tag-gender',
        crumb: `#${esc(tg.slug)} · ${esc(genderLabel(tg.gender))}`,
        title: `${genderLabel(tg.gender)} #${tg.slug} live cams — ${tg.rooms.length} rooms · ${SITE_NAME}`,
        desc: `${genderLabel(tg.gender)} broadcasters tagged #${tg.slug}, sorted by viewers.`,
        h2: `${esc(genderLabel(tg.gender))} <span style="color:var(--mute)">·</span> #${esc(tg.slug)}`,
        lede: `${tg.rooms.length} <strong>${esc(genderLabel(tg.gender))}</strong> broadcasters live with the <strong>#${esc(tg.slug)}</strong> tag.`,
        rooms: tg.rooms,
      });
      if (pages.length >= TARGET_PAGES) break;
    }
  }

  // 7. Tag × Country combos
  if (pages.length < TARGET_PAGES) {
    for (const tc of tagCountries) {
      pages.push({
        file: tagCountryFile(tc.slug, tc.country),
        kind: 'tag-country',
        crumb: `#${esc(tc.slug)} in ${esc(tc.country)}`,
        title: `#${tc.slug} live cams in ${tc.country} — ${tc.rooms.length} rooms · ${SITE_NAME}`,
        desc: `Broadcasters from ${tc.country} tagged #${tc.slug}, sorted by viewers.`,
        h2: `#${esc(tc.slug)} live cams in ${esc(tc.country)}`,
        lede: `${tc.rooms.length} broadcasters live from <strong>${esc(tc.country)}</strong> with the <strong>#${esc(tc.slug)}</strong> tag.`,
        rooms: tc.rooms,
      });
      if (pages.length >= TARGET_PAGES) break;
    }
  }

  // 8. Tag × Language combos
  if (pages.length < TARGET_PAGES) {
    for (const tl of tagLangs) {
      pages.push({
        file: tagLangFile(tl.slug, tl.lang),
        kind: 'tag-lang',
        crumb: `#${esc(tl.slug)} · ${esc(tl.lang)}`,
        title: `${tl.lang}-speaking #${tl.slug} cams — ${tl.rooms.length} rooms · ${SITE_NAME}`,
        desc: `${tl.lang}-speaking broadcasters tagged #${tl.slug}, sorted by viewers.`,
        h2: `${esc(tl.lang)}-speaking #${esc(tl.slug)} cams`,
        lede: `${tl.rooms.length} <strong>${esc(tl.lang)}-speaking</strong> broadcasters live with the <strong>#${esc(tl.slug)}</strong> tag.`,
        rooms: tl.rooms,
      });
      if (pages.length >= TARGET_PAGES) break;
    }
  }

  // 9. Gender × Country combos
  if (pages.length < TARGET_PAGES) {
    for (const gc of genderCountries) {
      pages.push({
        file: genderCountryFile(gc.gender, gc.country),
        kind: 'gender-country',
        crumb: `${esc(genderLabel(gc.gender))} in ${esc(gc.country)}`,
        title: `${genderLabel(gc.gender)} live cams from ${gc.country} — ${gc.rooms.length} rooms · ${SITE_NAME}`,
        desc: `${genderLabel(gc.gender)} broadcasters from ${gc.country}, sorted by viewers.`,
        h2: `${esc(genderLabel(gc.gender))} live cams from ${esc(gc.country)}`,
        lede: `${gc.rooms.length} <strong>${esc(genderLabel(gc.gender))}</strong> broadcasters live from <strong>${esc(gc.country)}</strong>.`,
        rooms: gc.rooms,
      });
      if (pages.length >= TARGET_PAGES) break;
    }
  }

  // 10. Gender × Language combos
  if (pages.length < TARGET_PAGES) {
    for (const gl of genderLangs) {
      pages.push({
        file: genderLangFile(gl.gender, gl.lang),
        kind: 'gender-lang',
        crumb: `${esc(genderLabel(gl.gender))} · ${esc(gl.lang)}`,
        title: `${gl.lang}-speaking ${genderLabel(gl.gender)} cams — ${gl.rooms.length} rooms · ${SITE_NAME}`,
        desc: `${gl.lang}-speaking ${genderLabel(gl.gender)} broadcasters, sorted by viewers.`,
        h2: `${esc(gl.lang)}-speaking ${esc(genderLabel(gl.gender))} cams`,
        lede: `${gl.rooms.length} <strong>${esc(gl.lang)}-speaking ${esc(genderLabel(gl.gender))}</strong> broadcasters live now.`,
        rooms: gl.rooms,
      });
      if (pages.length >= TARGET_PAGES) break;
    }
  }

  // 11. Country × Language combos
  if (pages.length < TARGET_PAGES) {
    for (const cl of countryLangs) {
      pages.push({
        file: countryLangFile(cl.country, cl.lang),
        kind: 'country-lang',
        crumb: `${esc(cl.lang)} in ${esc(cl.country)}`,
        title: `${cl.lang}-speaking cams from ${cl.country} — ${cl.rooms.length} rooms · ${SITE_NAME}`,
        desc: `${cl.lang}-speaking broadcasters from ${cl.country}, sorted by viewers.`,
        h2: `${esc(cl.lang)}-speaking cams from ${esc(cl.country)}`,
        lede: `${cl.rooms.length} <strong>${esc(cl.lang)}-speaking</strong> broadcasters live from <strong>${esc(cl.country)}</strong>.`,
        rooms: cl.rooms,
      });
      if (pages.length >= TARGET_PAGES) break;
    }
  }

  console.log(`Planned ${pages.length} pages (target ${TARGET_PAGES})`);

  // ---- write ----
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  // browse sections (used on index)
  const browseSections = `
<section class="browse">
  <h2>All ${allTagsSorted.length} live tags</h2>
  <div class="grid">${allTagsSorted.map(t => `<a href="${esc(tagFile(t.slug))}">#${esc(t.slug)} <span class="c">(${t.rooms.length})</span></a>`).join('')}</div>
  <h2>Browse by country (${allCountries.length})</h2>
  <div class="grid">${allCountries.map(c => `<a href="${esc(countryFile(c.key))}">${esc(c.label)} <span class="c">(${c.rooms.length})</span></a>`).join('')}</div>
  <h2>Browse by language (${allLangs.length})</h2>
  <div class="grid">${allLangs.map(l => `<a href="${esc(langFile(l.key))}">${esc(l.label)} <span class="c">(${l.rooms.length})</span></a>`).join('')}</div>
  <h2>Browse by gender</h2>
  <div class="grid">${allGenders.map(g => `<a href="${esc(genderFile(g.key))}">${esc(g.label)} <span class="c">(${g.rooms.length})</span></a>`).join('')}</div>
</section>`;

  const indexRooms = rooms.slice().sort((a, b) => (b.num_users || 0) - (a.num_users || 0));
  const indexTitle = `${SITE_NAME} — Live Cam Room Index (${rooms.length.toLocaleString()} rooms, ${pages.length} pages)`;

  const indexHtml = renderHead(indexTitle, SITE_DESC) +
    renderHeader(null) +
    renderTagNav(allTagsSorted, null) +
    `<section class="intro"><h2>Live cam room index — sorted, tagged, and revshare-linked</h2>
<p>${esc(SITE_DESC)} Currently indexing <strong>${rooms.length.toLocaleString()} live rooms</strong> across <strong>${allTagsSorted.length} tags</strong>, <strong>${allCountries.length} countries</strong>, and <strong>${allLangs.length} languages</strong> — ${pages.length} total pages. Tap any column header to re-sort. Filter by name, country, language, or tag.</p></section>` +
    `<main>` + renderControls() + renderTable(indexRooms) + `</main>` +
    `<a id="all-tags"></a>` + browseSections +
    renderFooter() + `<script>${JS}</script></body></html>`;
  fs.writeFileSync(path.join(OUT, 'index.html'), indexHtml);

  // sub-pages
  for (const p of pages) {
    if (p.kind === 'index') continue;
    const sortedRooms = p.rooms.slice().sort((a, b) => (b.num_users || 0) - (a.num_users || 0));
    const html = renderHead(p.title, p.desc) +
      renderHeader(p.crumb) +
      renderTagNav(allTagsSorted, p.kind === 'tag' ? p.rooms[0] && allTagsSorted.find(t => t.rooms === p.rooms)?.slug : null) +
      `<section class="intro"><h2>${p.h2}</h2><p>${p.lede} Sorted by viewers by default. Click any column header to re-sort, or use the filter to narrow by country, language, or keyword. Listings update each time the site rebuilds.</p></section>` +
      `<main>` + renderControls() + renderTable(sortedRooms) + `</main>` +
      renderFooter() + `<script>${JS}</script></body></html>`;
    fs.writeFileSync(path.join(OUT, p.file), html);
  }

  // sitemap, robots, .nojekyll, README
  const urls = pages.map(p => p.file);
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `<url><loc>${SITE_URL}/${u}</loc><changefreq>hourly</changefreq><priority>${u === 'index.html' ? '1.0' : '0.6'}</priority></url>`).join('\n')}
</urlset>`);
  fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL || ''}/sitemap.xml\n`);
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

  fs.writeFileSync(path.join(OUT, 'README.md'),
    `# ${SITE_NAME}\n\nStatic adult cam directory generated from the Chaturbate public affiliate API. ${pages.length} pages. All outbound links use revshare campaign code \`${WM}\`.\n\n## Deploy with auto-rebuild (recommended)\n\n1. Create a public GitHub repo.\n2. Upload **only** \`generate.mjs\` and the \`.github/\` folder from this archive.\n3. In Settings → Pages, set Source to **GitHub Actions**.\n4. In the Actions tab, run the **Build and Deploy** workflow once. After that it rebuilds every 6 hours.\n\n## Manual deploy\n\nUpload everything except \`generate.mjs\` and \`.github/\` to a repo and enable Pages from branch root.\n\n## Settings\n\nEnvironment variables for \`generate.mjs\`:\n- \`TARGET_PAGES\` (default ${TARGET_PAGES})\n- \`THEME\` (\`oxblood\` or \`black\`, default \`${THEME}\`)\n- \`WM\` (campaign code, default ${WM})\n- \`SITE_URL\` (your live URL for sitemap/canonicals)\n`);

  // include workflow
  const wfDir = path.join(OUT, '.github', 'workflows');
  fs.mkdirSync(wfDir, { recursive: true });
  fs.writeFileSync(path.join(wfDir, 'build.yml'), `name: Build and Deploy
on:
  schedule:
    - cron: '0 */6 * * *'
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    env:
      TARGET_PAGES: '${TARGET_PAGES}'
      THEME: '${THEME}'
      WM: '${WM}'
      SITE_NAME: '${SITE_NAME}'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: node generate.mjs
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
      - id: deployment
        uses: actions/deploy-pages@v4
`);

  // copy generate.mjs into output for re-runs
  fs.copyFileSync(path.resolve(process.argv[1]), path.join(OUT, 'generate.mjs'));

  console.log(`Done. Wrote ${pages.length} pages to ${OUT}/`);
}

main().catch(e => { console.error(e); process.exit(1); });
