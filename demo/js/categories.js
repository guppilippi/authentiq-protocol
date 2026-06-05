"use strict";

const STORAGE_KEY = "categories.json"; // name in AQ storage
let data = [];                         // root array
let selPath = null;                    // array of indices, or null

const $ = (id) => document.getElementById(id);

const statusEl = $("status");
const treeEl = $("tree");
const nameEl = $("name");
const descEl = $("desc");
const selInfoEl = $("selInfo");
const exportOutEl = $("exportOut");

const btnAddRoot = $("btnAddRoot");
const btnAddChild = $("btnAddChild");
const btnDelete = $("btnDelete");
const btnSave = $("btnSave");
const btnExport = $("btnExport");
const btnImport = $("btnImport");
const importFileEl = $("importFile");

function setStatus(s) { statusEl.textContent = s || ""; }

function pathToStr(p) { return p ? p.join("/") : ""; }
function strToPath(s) { return (typeof s === "string" && s.length) ? s.split("/").map(x => Number(x)) : null; }

function getNodeByPath(p) {
  if (!p || !p.length) return null;
  let cur = data;
  let node = null;
  for (const i of p) {
    if (!Array.isArray(cur) || i < 0 || i >= cur.length) return null;
    node = cur[i];
    cur = node && node.c;
  }
  return node || null;
}

function getParentArrayAndIndex(p) {
  if (!p || !p.length) return { arr: null, idx: -1 };
  if (p.length === 1) return { arr: data, idx: p[0] };
  const parent = getNodeByPath(p.slice(0, -1));
  if (!parent || !Array.isArray(parent.c)) return { arr: null, idx: -1 };
  return { arr: parent.c, idx: p[p.length - 1] };
}

function normalizeName(s) {
  s = String(s ?? "").replace(/\r?\n/g, " "); // egysoros
  s = s.trim();
  return s;
}

function mkNode() { return { n: "", d: "", c: [] }; }

function renderTree() {
  treeEl.innerHTML = "";
  const rootUl = document.createElement("ul");
  treeEl.appendChild(rootUl);

  const renderArr = (arr, basePath, ul) => {
    for (let i = 0; i < arr.length; i++) {
      const node = arr[i];
      const p = basePath.concat([i]);
      const li = document.createElement("li");

      const row = document.createElement("div");
      row.className = "node";

      const a = document.createElement("a");
      a.href = "#";
      a.dataset.path = pathToStr(p);
      a.textContent = node && node.n ? node.n : "(névtelen)";
      if (selPath && pathToStr(selPath) === pathToStr(p)) a.classList.add("sel");

      const meta = document.createElement("span");
      meta.className = "small";
      meta.textContent = node && Array.isArray(node.c) && node.c.length ? `(${node.c.length})` : "";

      row.appendChild(a);
      row.appendChild(meta);

      li.appendChild(row);

      if (node && Array.isArray(node.c) && node.c.length) {
        const sub = document.createElement("ul");
        li.appendChild(sub);
        renderArr(node.c, p, sub);
      }

      ul.appendChild(li);
    }
  };

  renderArr(data, [], rootUl);
}

function syncFormFromSelection() {
  const node = getNodeByPath(selPath);
  const has = !!node;

  btnAddChild.disabled = !has;
  btnDelete.disabled = !has;

  if (!has) {
    nameEl.value = "";
    descEl.value = "";
    selInfoEl.textContent = "Nincs kiválasztva.";
    return;
  }

  nameEl.value = String(node.n ?? "");
  descEl.value = String(node.d ?? "");
  selInfoEl.textContent = `Path: ${pathToStr(selPath)}`;
}

let saveTimer = null;
function scheduleSave(ms = 250) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; saveToStorage(); }, ms);
}

let editTimer = null;
function scheduleEditApply(ms = 250) {
  if (editTimer) clearTimeout(editTimer);
  editTimer = setTimeout(() => {
    editTimer = null;
    applyEditsToSelected(); 
  }, ms);
}

let _inited = false;
let _loaded = false;
async function saveToStorage() {
  if (!_inited || !_loaded) return;
  try {
    const text = JSON.stringify(data);
    await aq.storagePut(STORAGE_KEY, { text });
    setStatus("Mentve.");
  } catch (e) {
    console.error(e);
    setStatus("Mentési hiba: " + (e?.message || e));
  }
}

async function loadFromStorage() {
  try {
    const r = await aq.storageGet(STORAGE_KEY);
	if (r === true) throw new Error("storageGet: invalid result");
    const t = r && typeof r === "object" ? String(r.text ?? "") : "";
    if (!t.trim()) { data = []; setStatus("Üres."); return; }
    const j = JSON.parse(t);
    if (!Array.isArray(j)) throw new Error("root nem []");
    data = j;
    setStatus("Betöltve storage-ból.");
  } catch (e) {
    console.error(e);
    data = [];
    setStatus("Betöltési hiba: " + (e?.message || e));
  }
}

function applyEditsToSelected() {
  const node = getNodeByPath(selPath);
  if (!node) return;

  const nn = normalizeName(nameEl.value);
  if (!nn) {
    setStatus("Név kötelező (trim után).");
    return;
  }

  node.n = nn;
  node.d = String(descEl.value ?? "");
  renderTree();
  scheduleSave();
}

function addRoot() {
  const n = mkNode();
  n.n = "Új kategória";
  data.push(n);
  selPath = [data.length - 1];
  renderTree();
  syncFormFromSelection();
  scheduleSave();
}

function addChild() {
  const node = getNodeByPath(selPath);
  if (!node) return;
  if (!Array.isArray(node.c)) node.c = [];
  const n = mkNode();
  n.n = "Új kategória";
  node.c.push(n);
  selPath = selPath.concat([node.c.length - 1]);
  renderTree();
  syncFormFromSelection();
  scheduleSave();
}

function delSelected() {
  const p = selPath;
  const { arr, idx } = getParentArrayAndIndex(p);
  if (!arr || idx < 0 || idx >= arr.length) return;
  arr.splice(idx, 1);
  selPath = null;
  renderTree();
  syncFormFromSelection();
  scheduleSave();
}

async function exportUuid() {
  exportOutEl.textContent = "";
  try {
    const text = JSON.stringify(data, null, 2);
    const blob = new Blob([text], { type: "application/json" });
    const ts = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const fname =  "categories-" + ts.getFullYear() + pad(ts.getMonth() + 1) + pad(ts.getDate()) + "-" + pad(ts.getHours()) + pad(ts.getMinutes()) + pad(ts.getSeconds()) + ".json";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);

    exportOutEl.textContent = fname;
    setStatus("Export OK (fájl).");
  } catch (e) {
    console.error(e);
    setStatus("Export hiba: " + (e?.message || e));
  }
}

async function importFromFile(file) {
  exportOutEl.textContent = "";
  try {
    if (!file) { setStatus("Válassz fájlt."); return; }
    const text = await file.text();
    const j = JSON.parse(text);
    if (!Array.isArray(j)) throw new Error("import root nem []");

    data = j;
    selPath = null;
    renderTree();
    syncFormFromSelection();
    await aq.storagePut(STORAGE_KEY, { text: JSON.stringify(data) });
    setStatus("Import OK (felülírva, mentve).");
  } catch (e) {
    console.error(e);
    setStatus("Import hiba: " + (e?.message || e));
  }
}

// UI events
treeEl.addEventListener("click", (ev) => {
  const a = ev.target && ev.target.closest && ev.target.closest("a[data-path]");
  if (!a) return;
  ev.preventDefault();
  selPath = strToPath(a.dataset.path);
  renderTree();
  syncFormFromSelection();
});

nameEl.addEventListener("input", () => scheduleEditApply(250));
descEl.addEventListener("input", () => scheduleEditApply(250));

nameEl.addEventListener("blur", applyEditsToSelected);
descEl.addEventListener("blur", applyEditsToSelected);

btnAddRoot.addEventListener("click", addRoot);
btnAddChild.addEventListener("click", addChild);
btnDelete.addEventListener("click", delSelected);
btnSave.addEventListener("click", () => { applyEditsToSelected(); saveToStorage(); });
btnExport.addEventListener("click", exportUuid);
btnImport.addEventListener("click", () => { try { importFileEl.value = ""; importFileEl.click(); } catch {} });
importFileEl.addEventListener("change", async () => {
  const f = importFileEl.files && importFileEl.files[0] ? importFileEl.files[0] : null;
  await importFromFile(f);
});

(async () => {
  _inited = true;
  await loadFromStorage();
  _loaded = true;
  renderTree();
  syncFormFromSelection();
})();