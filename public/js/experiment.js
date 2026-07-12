/**
 * BBFL Experiment Framework
 *
 * Left: 2×2 cells (Accept | Reject per machine); each cell stacks up to N element rows.
 * Right: machine rows + optional element overlays (one per machine slot: 1 | 2 | 3).
 */

/** @type {readonly string[]} Major element classes; each has minor variants 1-4 (e.g. "A1" … "A4"). */
const ELEMENT_IDS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
  "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T",
];

/** PNG path for an element id, e.g. "A3" -> img/elem_A3.png, "OutT" -> img/elem_OutT.png */
function elementSrc(id) {
  return `img/elem_${id}.png`;
}

/* Shared display-label registry — mutated by Experiment.setElementDisplayLabels */
const _displayLabelMap = {};

function _getDisplayLabel(elemId) {
  if (!elemId) return elemId;
  const upper = String(elemId).trim().toUpperCase();
  if (upper === "OUTT" || upper === "OUTF" || upper === "ENERGY") return "Energy";
  return _displayLabelMap[upper] ?? upper;
}

/* ════════════════════════════════════════════════════════
   Element Grid  (left panel, 3×3)
   ════════════════════════════════════════════════════════ */
const ElementGrid = (() => {
  const boxes = document.querySelectorAll(".element-box");
  const grid = {};

  boxes.forEach((box) => {
    const r = Number(box.dataset.row);
    const c = Number(box.dataset.col);
    grid[`${r},${c}`] = box;
  });

  function getStack(row, col) {
    const box = grid[`${row},${col}`];
    return box?.querySelector(".element-cell-stack") ?? null;
  }

  /**
   * Sizing tiers so a crowded cell shrinks its thumbnails/labels and spills
   * into additional columns rather than overflowing or requiring scroll.
   */
  const DENSITY_TIERS = [
    { max: 4,  thumb: 66, label: 1.10, rowGap: 8, innerGap: 14, col: "100%" },
    { max: 6,  thumb: 52, label: 0.95, rowGap: 6, innerGap: 10, col: "130px" },
    { max: 10, thumb: 40, label: 0.82, rowGap: 5, innerGap: 8,  col: "100px" },
    { max: 16, thumb: 30, label: 0.72, rowGap: 4, innerGap: 6,  col: "80px" },
    { max: Infinity, thumb: 22, label: 0.62, rowGap: 3, innerGap: 5, col: "62px" },
  ];

  const cellCounts = {};

  function computeCellHeightBudget() {
    const el = document.getElementById("element-grid");
    if (!el) return null;
    const h = el.getBoundingClientRect().height;
    if (h < 30) return null;
    return (h - 16) / 3; // 3 rows, 2 × 8px row-gap
  }

  function applyDensity(box, count) {
    const tier = DENSITY_TIERS.find((t) => count <= t.max);
    let thumb  = tier.thumb;
    let label  = tier.label;
    let rowGap = tier.rowGap;

    // In single-column mode, shrink thumbnails so all items fit without scrolling
    if (count > 0 && tier.col === "100%") {
      const budget = computeCellHeightBudget();
      if (budget) {
        const available = budget - 42 - 12; // approx title height + box padding
        const needed    = count * (thumb + rowGap);
        if (needed > available && available > 0) {
          const scale = available / needed;
          thumb  = Math.max(18, Math.floor(thumb  * scale));
          label  = Math.max(0.55, +(label  * scale).toFixed(2));
          rowGap = Math.max(2,    Math.floor(rowGap * scale));
        }
      }
    }

    box.style.setProperty("--element-thumb-size",    `${thumb}px`);
    box.style.setProperty("--element-label-size",    `${label}rem`);
    box.style.setProperty("--element-cell-row-gap",  `${rowGap}px`);
    box.style.setProperty("--element-row-inner-gap", `${tier.innerGap}px`);
    box.style.setProperty("--element-col-width",     tier.col);
  }

  function setCellTitle(row, col, text) {
    const box = grid[`${row},${col}`];
    const el = box?.querySelector(".element-cell-title");
    // Titles are controlled by our code; allow markup (e.g., bold machine name).
    if (el) el.innerHTML = String(text);
  }

  /**
   * @param {number} row
   * @param {number} col
   * @param {Array<{ id: string, label?: string, src?: string }>} items
   * @param {{ maxRows?: number }} [options]
   */
  function setCellItems(row, col, items, options = {}) {
    const box = grid[`${row},${col}`];
    const stack = getStack(row, col);
    if (!box || !stack) return;
    stack.innerHTML = "";
    const slice = items;
    slice.forEach((item) => {
      const id = String(item.id).toUpperCase();
      const rowEl = document.createElement("div");
      rowEl.className = "element-slot-row";
      rowEl.dataset.elemId = id;
      const img = document.createElement("img");
      img.src = item.src ?? elementSrc(id);
      img.alt = id;
      img.draggable = false;
      const lab = document.createElement("span");
      lab.className = "element-slot-label";
      lab.textContent = item.label ?? id;
      rowEl.appendChild(img);
      rowEl.appendChild(lab);
      stack.appendChild(rowEl);
    });
    applyDensity(box, slice.length);
    cellCounts[`${row},${col}`] = slice.length;
    box.classList.toggle("has-content", slice.length > 0);
  }

  /** Single image in a cell (legacy helper). */
  function setImage(row, col, src) {
    setCellItems(row, col, [{ id: "X", label: "", src }]);
  }

  function setLabel(row, col, text) {
    const box = grid[`${row},${col}`];
    if (!box) return;
    const stack = getStack(row, col);
    if (stack) stack.innerHTML = "";
    setCellTitle(row, col, text);
    box.classList.remove("has-content");
    applyDensity(box, 0);
  }

  function clearCell(row, col) {
    const box = grid[`${row},${col}`];
    const stack = getStack(row, col);
    if (stack) stack.innerHTML = "";
    box?.classList.remove("has-content");
    if (box) applyDensity(box, 0);
    cellCounts[`${row},${col}`] = 0;
  }

  function clearAll() {
    boxes.forEach((box) => {
      const stack = box.querySelector(".element-cell-stack");
      if (stack) stack.innerHTML = "";
      box.classList.remove("has-content");
      applyDensity(box, 0);
    });
    Object.keys(cellCounts).forEach((k) => { cellCounts[k] = 0; });
  }

  // Reapply density on panel/window resize so items never overflow
  if (typeof ResizeObserver !== "undefined") {
    const _gridEl = document.getElementById("element-grid");
    if (_gridEl) {
      new ResizeObserver(() => {
        Object.entries(grid).forEach(([key, box]) => {
          const count = cellCounts[key] ?? 0;
          if (count > 0) applyDensity(box, count);
        });
      }).observe(_gridEl);
    }
  }

  return {
    setCellItems,
    setCellTitle,
    setImage,
    setLabel,
    clearCell,
    clearAll,
    elementSrc,
    ELEMENT_IDS,
  };
})();

/* ════════════════════════════════════════════════════════
   Machine Canvas  (right panel, one-column row stack)
   ════════════════════════════════════════════════════════ */
const MachineCanvas = (() => {
  const canvas = document.getElementById("machine-canvas");
  const rowWrap =
    document.getElementById("machine-rows-wrapper") || canvas;
  const layers = {};
  const rows = {};
  /** @type {'three' | 'two'} */
  let defaultRowLayout = "three";

  /** @param {number|string} slot */
  function normalizeMachineSlot(slot) {
    const n = Number(slot);
    if (n === 1 || n === 2 || n === 3) return n;
    throw new Error(`Machine slot must be 1, 2, or 3 (got ${slot})`);
  }

  function applyRowLayoutClass(row, layout) {
    const mode = layout === "two" ? "two" : "three";
    row.classList.toggle("machine-row--two-cols", mode === "two");
    row.dataset.machineLayout = mode;
  }

  /**
   * New rows use this layout until changed with setRowLayout.
   * @param {'three' | 'two'} layout — 'two' = slots 1 and 3 only (slot 2 hidden)
   */
  function setDefaultRowLayout(layout) {
    defaultRowLayout = layout === "two" ? "two" : "three";
  }

  /**
   * @param {number} rowIndex
   * @param {'three' | 'two'} layout
   */
  function setRowLayout(rowIndex, layout) {
    ensureRow(rowIndex);
    const entry = rows[rowIndex];
    if (entry) applyRowLayoutClass(entry.row, layout);
  }

  /** @returns {HTMLElement} The inner strip (layers append here; strip is centered in the row). */
  function ensureRow(rowIndex) {
    if (rows[rowIndex]) return rows[rowIndex].strip;
    const row = document.createElement("div");
    row.className = "machine-row";
    row.dataset.row = String(rowIndex);
    const strip = document.createElement("div");
    strip.className = "machine-row-strip";
    const caption = document.createElement("div");
    caption.className = "machine-row-caption hidden";
    caption.setAttribute("role", "note");
    row.appendChild(strip);
    row.appendChild(caption);
    applyRowLayoutClass(row, defaultRowLayout);
    rowWrap.appendChild(row);
    rows[rowIndex] = { row, strip, caption };
    return strip;
  }

  /**
   * Caption under a canvas row. Plain string, or an array of segments for inline element art.
   *
   * Segments:
   *   - string → literal text
   *   - { type: "text", text: "…" }
   *   - { type: "element", id: "A" } — uses `img/elem_A.png` via elementSrc (optional `src` override)
   *   - { type: "machine", text: "M1" } — bold machine label
   *   - { type: "status", tone: "good"|"bad", text: "…" } — colored feedback text
   *
   * @param {number} rowIndex
   * @param {string | Array<string | { type: string, text?: string, id?: string, src?: string }>} [content]
   */
  function setRowCaption(rowIndex, content) {
    ensureRow(rowIndex);
    const entry = rows[rowIndex];
    if (!entry?.caption) return;
    const cap = entry.caption;
    cap.innerHTML = "";

    if (content == null) {
      cap.classList.add("hidden");
      return;
    }

    if (typeof content === "string") {
      const t = content.trim();
      cap.textContent = t;
      cap.classList.toggle("hidden", t === "");
      return;
    }

    if (Array.isArray(content)) {
      if (content.length === 0) {
        cap.classList.add("hidden");
        return;
      }
      for (const part of content) {
        if (typeof part === "string") {
          cap.appendChild(document.createTextNode(part));
        } else if (part && typeof part === "object") {
          if (part.type === "text" && part.text != null) {
            cap.appendChild(document.createTextNode(String(part.text)));
          } else if (part.type === "machine" && part.text != null) {
            const strong = document.createElement("strong");
            strong.className = "caption-machine";
            strong.textContent = String(part.text);
            cap.appendChild(strong);
          } else if (part.type === "status" && part.text != null) {
            const span = document.createElement("span");
            const tone = String(part.tone ?? "").toLowerCase();
            span.className = `caption-status ${tone === "good" ? "caption-status--good" : "caption-status--bad"}`;
            span.textContent = String(part.text);
            cap.appendChild(span);
          } else if (part.type === "element" && (part.id != null || part.src != null)) {
            const eid = String(part.id ?? "").trim().toUpperCase();
            const chip = document.createElement("span");
            chip.className = "caption-elem-chip";
            if (eid) chip.dataset.elemId = eid;
            const img = document.createElement("img");
            img.className = "machine-caption-inline-img";
            img.src = part.src ?? elementSrc(part.id);
            img.alt = part.alt != null ? String(part.alt) : eid;
            img.draggable = false;
            const label = document.createElement("span");
            label.className = "caption-elem-label";
            label.textContent = _getDisplayLabel(eid);
            chip.appendChild(label);
            chip.appendChild(img);
            cap.appendChild(chip);
          }
        }
      }
      cap.classList.remove("hidden");
    }
  }

  /**
   * Machine PNG layer. Prefer `slot: 1 | 2 | 3` (classes `.machine-layer.slot-N`).
   * You can still pass `className` for custom classes.
   * @param {object} [opts]
   * @param {number} [opts.rowIndex]
   * @param {1|2|3} [opts.slot]
   * @param {string} [opts.className]
   */
  function setLayer(id, src, opts = {}) {
    const rowIndex = opts.rowIndex ?? 0;
    const parent = ensureRow(rowIndex);
    let img = layers[id];
    if (!img) {
      img = document.createElement("img");
      img.draggable = false;
      parent.appendChild(img);
      layers[id] = img;
    }

    if (img.parentElement !== parent) {
      parent.appendChild(img);
    }

    img.src = src;
    img.style.zIndex = opts.zIndex ?? "";
    img.style.opacity = opts.opacity ?? "";
    img.classList.remove("hidden");

    if (opts.slot != null) {
      const n = normalizeMachineSlot(opts.slot);
      img.className = `machine-layer slot-${n}`;
    } else if (opts.className) {
      img.className = `machine-layer ${opts.className}`.trim();
    }
  }

  const elemYVar = {
    1: "--elem-slot-1-y",
    2: "--elem-slot-2-y",
    3: "--elem-slot-3-y",
  };

  /**
   * Superimpose an element PNG on a machine slot (1, 2, or 3).
   * Position: CSS vars --elem-slot-N-x / --elem-slot-N-y on .machine-row, or centerX / centerY overrides.
   * @param {number} rowIndex
   * @param {1|2|3|number|string} slot
   * @param {string} src
   * @param {{
   *   id?: string,
   *   centerX?: number|string,
   *   centerY?: string,
   *   centerYOffset?: number,
   *   zIndex?: number,
   * }} [opts]
   */
  function setMachineElement(rowIndex, slot, src, opts = {}) {
    const sn = normalizeMachineSlot(slot);
    const id = opts.id ?? `mel_${rowIndex}_${sn}`;
    const parent = ensureRow(rowIndex);
    let img = layers[id];
    if (!img) {
      img = document.createElement("img");
      img.className = `machine-element-layer slot-${sn}`;
      img.draggable = false;
      parent.appendChild(img);
      layers[id] = img;
    }

    if (img.parentElement !== parent) {
      parent.appendChild(img);
    }

    img.src = src;
    img.className = `machine-element-layer slot-${sn}`;
    img.classList.remove("hidden");
    if (opts.elemId != null) {
      const eid = String(opts.elemId).toUpperCase();
      img.dataset.elemId = eid;
      img.setAttribute("data-elem-id", eid);
    } else {
      img.removeAttribute("data-elem-id");
    }

    if (opts.centerX != null) {
      img.style.left =
        typeof opts.centerX === "number"
          ? `${opts.centerX}px`
          : String(opts.centerX);
    } else {
      img.style.left = "";
    }

    if (opts.centerY != null) {
      img.style.top = String(opts.centerY);
    } else if (opts.centerYOffset != null) {
      const yVar = elemYVar[sn] ?? "--elem-slot-1-y";
      img.style.top = `calc(50% + var(--state-nudge, 0px) + var(${yVar}, 0px) + ${opts.centerYOffset}px)`;
    } else {
      img.style.top = "";
    }

    if (opts.zIndex != null) {
      img.style.zIndex = String(opts.zIndex);
    } else {
      img.style.zIndex = "";
    }

    if (opts.opacity != null) {
      img.style.opacity = String(opts.opacity);
    } else {
      img.style.opacity = "";
    }
  }

  function removeLayer(id) {
    if (!layers[id]) return;
    layers[id].remove();
    delete layers[id];
  }

  function clearAll() {
    Object.keys(layers).forEach(removeLayer);
    Object.values(rows).forEach((entry) => entry.row.remove());
    Object.keys(rows).forEach((key) => delete rows[key]);
  }

  function setColumnHeight(px) {
    canvas.style.minHeight = px != null ? `${px}px` : "";
  }

  function getRowElement(rowIndex) {
    return rows[rowIndex]?.row ?? null;
  }

  return {
    setLayer,
    setMachineElement,
    setRowLayout,
    setDefaultRowLayout,
    setRowCaption,
    normalizeMachineSlot,
    removeLayer,
    clearAll,
    setColumnHeight,
    getRowElement,
  };
})();

/* ════════════════════════════════════════════════════════
   Data helper — post trial data to the server
   ════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════
   Session state
   ════════════════════════════════════════════════════════ */
let _pid = null;
let _sessionStart = null;

function getProlificParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    PROLIFIC_PID: params.get("PROLIFIC_PID"),
    STUDY_ID:     params.get("STUDY_ID"),
    SESSION_ID:   params.get("SESSION_ID"),
  };
}

async function initSession() {
  _sessionStart = Date.now();
  const params = new URLSearchParams(window.location.search);
  const forcedPid = params.get("pid") || null;  // ?pid=test-alice overrides server-generated uuid
  try {
    const res = await fetch("/api/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prolific: getProlificParams(), forcedPid }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    _pid = data.pid;
    return { blockOrder: data.blockOrder ?? [0, 1, 2, 3] };
  } catch (err) {
    console.warn("Session init failed (offline?), using default order:", err);
    _pid = forcedPid ?? "local-" + Math.random().toString(36).slice(2, 10);
    return { blockOrder: [0, 1, 2, 3] };
  }
}

async function saveElementMapping(blockNum, blockCondition, roleToElementId, displayLabels) {
  if (!_pid) return;
  const mappings = Object.entries(roleToElementId).map(([role, elemId]) => ({
    role,
    elementId: elemId,
    displayLabel: displayLabels[String(elemId).toUpperCase()] ?? elemId,
    majorClass: String(elemId).replace(/\d+$/, ""),
    minorVariant: parseInt(String(elemId).match(/\d+$/)?.[0] ?? "1", 10),
  }));
  try {
    await fetch("/api/element-mapping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pid: _pid, blockNum, blockCondition, mappings }),
    });
  } catch (err) {
    console.error("Failed to save element mapping:", err);
  }
}

async function completeSession(terminated = false) {
  if (!_pid) return;
  try {
    await fetch("/api/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pid: _pid,
        totalTimeMs: _sessionStart ? Date.now() - _sessionStart : null,
        terminated,
      }),
    });
  } catch (err) {
    console.error("Failed to complete session:", err);
  }
}

/* ════════════════════════════════════════════════════════
   Per-trial save
   ════════════════════════════════════════════════════════ */
const SCALE_CODE = [2, 1, -1, -2];  // scale value 1="Definitely Active"=+2

async function saveTrial(entry) {
  if (!_pid) return;

  let responseCoded = null;
  let correct = null;

  if (entry.trialType === "prediction") {
    const raw = entry.response;
    if (typeof raw === "number" && raw >= 1 && raw <= 4) responseCoded = SCALE_CODE[raw - 1];
    correct = entry.predictionCorrect ?? null;
  } else if (entry.trialType === "attention_check") {
    correct = entry.attentionPassed ?? null;
    responseCoded = correct === null ? null : (correct ? 1 : 0);
  }

  const meta = entry._meta ?? {};
  try {
    await fetch("/api/trial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pid:            _pid,
        blockNum:       meta.blockNum       ?? null,
        blockCondition: meta.blockCondition ?? null,
        trialNum:       meta.trialNum       ?? null,
        trialType:      entry.trialType,
        machineSlot:    entry.machine       ?? null,
        elementRole:    meta.role           ?? null,
        elementId:      meta.elemId         ?? null,
        displayLabel:   meta.displayLabel   ?? null,
        correctAnswer:  meta.correctAnswer  ?? null,
        responseRaw:    entry.response != null ? String(entry.response) : null,
        responseCoded,
        correct,
        critical:       meta.critical       ?? false,
        rtMs:           Math.round(entry.continueRT ?? entry.nextRT ?? 0),
        firstResponseMs: entry.firstScaleTime != null ? Math.round(entry.firstScaleTime) : null,
        hoverLog:        entry.hoverLog?.length ? JSON.stringify(entry.hoverLog) : null,
      }),
    });
  } catch (err) {
    console.error("Failed to save trial:", err);
  }
}

/* ════════════════════════════════════════════════════════
   Experiment  (high-level: mode switching + trial rendering)

   Element chain rules:
     - null in elems → no element given to that machine (neutral slot).
    - Tokens render on the canvas but never appear in the left-hand table.

   Three-machine mode:
     - Long trials wrap to additional canvas rows (up to 3 machines per row).
   Two-machine mode:
     - Up to 2 machines per canvas row (slots 1 and 3). Intended use: one process
       machine (m1..m6) plus `res` only — e.g. machines: ["m4", "res"].

   Left table: 3 rows × 2 columns — Accept and Reject only (no Produce column).

   Grid memory persists across trials. Use Experiment.wipeLeftTable() to reset the table.
   setMode() clears the canvas but preserves the grid unless { clearGrid: true }.

   Usage:
     Experiment.setMode("three", ["m4", "m5", "res"]);
     Experiment.setMode("two", ["m4", "res"]);
     Experiment.renderTrial({ machines: [...], states: [...], elems: [...] });
     Experiment.wipeLeftTable();
   ════════════════════════════════════════════════════════ */
const Experiment = (() => {
  const gridEl = document.getElementById("element-grid");

  /** @type {'three'|'two'} */
  let mode = "three";
  // The knowledge table tracks exactly 3 process machines per block.
  let processMachines = ["m1", "m2", "m3"];
  let machineNames = [...processMachines];
  let machineRowMap = {};
  const cellHistory = {};
  let canvasRowCounter = 0;

  function rebuildRowMap() {
    machineRowMap = {};
    processMachines.forEach((name, i) => { machineRowMap[name] = i; });
  }
  rebuildRowMap();

  const COL_LABELS = ["Active", "Idle"];

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /** Machines are numbered 1-12, e.g. "m4" -> "Machine 4". */
  function machineDisplayName(name) {
    const key = String(name).trim().toLowerCase();
    const m = /^m(\d+)$/.exec(key);
    return m ? `Machine ${m[1]}` : capitalize(key);
  }

  function setElementDisplayLabels(map) {
    Object.keys(_displayLabelMap).forEach((k) => delete _displayLabelMap[k]);
    Object.entries(map).forEach(([id, label]) => {
      _displayLabelMap[String(id).trim().toUpperCase()] = label;
    });
  }

  function getDisplayLabel(elemId) {
    return _getDisplayLabel(elemId);
  }

  function isNull(e) {
    return e == null || e === "";
  }

  /** Tokens are canvas-only; they must not appear in the knowledge table. */
  function isTableElement(elemId) {
    if (isNull(elemId)) return false;
    const u = String(elemId).trim().toLowerCase();
    return u !== "outt" && u !== "outf" && u !== "energy";
  }

  /** PNG path for a machine in a given state, e.g. "img/M4_a.png". */
  function machineSrc(name, state) {
    // Machines are stored as capitalized PNGs (M1_a.png ... M12_r.png)
    if (/^m\d+$/i.test(String(name))) {
      const n = String(name).trim().toUpperCase(); // m4 -> M4
      return `img/${n}_${state}.png`;
    }
    return `img/${name}_${state}.png`;
  }

  function slotIndexInChunk(mode, localIndex, chunkLen) {
    if (mode === "three") return localIndex + 1;
    if (chunkLen === 1) return 1;
    return localIndex === 0 ? 1 : 3;
  }

  /**
   * @param {'three'|'two'} newMode
   * @param {string[]} machines — ignored (kept for backward compatibility)
   * @param {{ clearGrid?: boolean }} [options] — default: preserve left table
   */
  function setMode(newMode, machines, options = {}) {
    mode = newMode === "two" ? "two" : "three";
    machineNames = [...processMachines];

    MachineCanvas.setDefaultRowLayout(mode);

    machineNames.forEach((name, row) => {
      COL_LABELS.forEach((label, col) => {
        ElementGrid.setCellTitle(
          row,
          col,
          `<strong>${machineDisplayName(name)}</strong> — ${label}`,
        );
      });
    });

    MachineCanvas.clearAll();
    canvasRowCounter = 0;

    if (options.clearGrid) {
      wipeLeftTable();
    }
  }

  /**
   * Switch the block — sets which process machines are tracked by the left table.
   * Clears both the canvas and the table.
   * @param {string[]} machines — e.g. ["m1", "m2", "m3"]
   */
  function setBlock(machines) {
    processMachines = [...machines];
    machineNames = [...processMachines];
    rebuildRowMap();
    setMode("two", [machines[0], "res"], { clearGrid: true });
  }

  /** Rich caption: text + inline element images for each non-empty elem. */
  function describeCanvasRowChunkSegments(machines, states, elems, start, end) {
    const parts = [];
    for (let i = start; i < end; i++) {
      if (i > start) parts.push({ type: "text", text: "; " });
      const st = states[i];
      const verb = st === "a" ? "activates with" : st === "r" ? "stays idle with" : "idle with";
      parts.push({ type: "text", text: `${machineDisplayName(machines[i])} ${verb} ` });
      if (elems[i] == null || elems[i] === "") {
        parts.push({ type: "text", text: "(no element)" });
      } else {
        parts.push({ type: "element", id: String(elems[i]).trim() });
      }
    }
    return parts;
  }

  function addToCell(row, col, elemId, label) {
    if (!isTableElement(elemId)) return;
    const normElemId = String(elemId).trim().toUpperCase();
    const key = `${row},${col}`;
    if (!cellHistory[key]) cellHistory[key] = [];
    // Prevent duplicates: if this element is already in this cell, don't add again.
    if (cellHistory[key].some((it) => String(it.id).trim().toUpperCase() === normElemId)) {
      return;
    }
    cellHistory[key].push({ id: normElemId, label: label ?? getDisplayLabel(normElemId) });
    ElementGrid.setCellItems(row, col, cellHistory[key]);
  }

  /**
   * Render one trial. Any number of machines; canvas wraps to new rows as needed.
   * Left table accumulates unless you call wipeLeftTable().
   *
   * @param {object} trial
   * @param {string[]} trial.machines
   * @param {string[]} trial.states
   * @param {(string|null)[]} trial.elems
   * @param {number} [trial.canvasRow] — base row for the first chunk only (auto if omitted)
   * @param {string | Array} [trial.caption] — plain string, or segment array (see MachineCanvas.setRowCaption). For multi-chunk trials, applies to the first chunk unless `captions` is set.
   * @param {Array<string | Array>} [trial.captions] — one entry per canvas row: string or segment array
   * @returns {{ firstRow: number, lastRow: number }} canvas row range used
   */
  function renderTrial({ machines, states, elems, canvasRow, caption, captions }) {
    const n = machines.length;
    if (n === 0) {
      throw new Error("renderTrial: at least one machine is required");
    }
    if (states.length !== n || elems.length !== n) {
      throw new Error("machines, states, and elems must have the same length");
    }

    const chunkSize = mode === "two" ? 2 : 3;
    const numChunks = Math.ceil(n / chunkSize);
    let firstRow;
    let lastRow;
    let chunkIdx = 0;

    for (let offset = 0; offset < n; offset += chunkSize) {
      const end = Math.min(offset + chunkSize, n);
      const chunkLen = end - offset;

      let rowIdx;
      if (offset === 0) {
        rowIdx = canvasRow != null ? canvasRow : canvasRowCounter++;
      } else {
        rowIdx = canvasRowCounter++;
      }
      if (offset === 0) firstRow = rowIdx;
      lastRow = rowIdx;

      for (let i = offset; i < end; i++) {
        const local = i - offset;
        const slot = slotIndexInChunk(mode, local, chunkLen);

        MachineCanvas.setLayer(
          `machine_s${slot}_r${rowIdx}_i${i}`,
          machineSrc(machines[i], states[i]),
          { rowIndex: rowIdx, slot, zIndex: slot },
        );

        if (!isNull(elems[i])) {
          MachineCanvas.setMachineElement(rowIdx, slot, elementSrc(elems[i]), {
            id: `mel_r${rowIdx}_s${slot}_i${i}`,
            zIndex: 10,
            elemId: elems[i],
          });
        }
      }

      const autoSegments = () =>
        describeCanvasRowChunkSegments(machines, states, elems, offset, end);

      let captionPayload;

      if (Array.isArray(captions) && captions[chunkIdx] != null) {
        const c = captions[chunkIdx];
        if (Array.isArray(c) && c.length > 0) {
          captionPayload = c;
        } else if (typeof c === "string" && c.trim() !== "") {
          captionPayload = c.trim();
        }
      }

      if (captionPayload == null && caption != null) {
        if (typeof caption === "string" && caption.trim() !== "") {
          if (numChunks === 1 || chunkIdx === 0) {
            captionPayload = caption.trim();
          }
        } else if (Array.isArray(caption) && caption.length > 0) {
          if (numChunks === 1 || chunkIdx === 0) {
            captionPayload = caption;
          }
        }
      }

      if (captionPayload == null) {
        captionPayload = autoSegments();
      }

      MachineCanvas.setRowCaption(rowIdx, captionPayload);
      chunkIdx += 1;
    }

    for (let i = 0; i < n; i++) {
      if (isNull(elems[i])) continue;
      const gridRow = machineRowMap[machines[i]];
      if (gridRow == null) continue;
      const state = states[i];
      if (state === "a") {
        addToCell(gridRow, 0, elems[i]);
      } else if (state === "r") {
        addToCell(gridRow, 1, elems[i]);
      }
    }

    return { firstRow, lastRow };
  }

  function clearCanvas() {
    MachineCanvas.clearAll();
    canvasRowCounter = 0;
  }

  function clearGrid() {
    wipeLeftTable();
  }

  /** Clear the left knowledge table only (canvas unchanged). */
  function wipeLeftTable() {
    Object.keys(cellHistory).forEach((k) => delete cellHistory[k]);
    ElementGrid.clearAll();
    machineNames.forEach((name, row) => {
      COL_LABELS.forEach((label, col) => {
        ElementGrid.setCellTitle(
          row,
          col,
          `<strong>${machineDisplayName(name)}</strong> — ${label}`,
        );
      });
    });
  }

  function clearAll() {
    clearCanvas();
    wipeLeftTable();
  }

  /** Build a segment for `caption` / `captions` rich arrays. */
  function captionTextPart(text) {
    return { type: "text", text: String(text) };
  }

  /** Build an inline element image segment (uses `img/elem_<ID>.png`). */
  function captionElementPart(id, opts = {}) {
    return {
      type: "element",
      id: String(id).trim(),
      ...opts,
    };
  }

  return {
    setMode,
    setBlock,
    renderTrial,
    clearCanvas,
    clearGrid,
    wipeLeftTable,
    clearAll,
    machineSrc,
    isTableElement,
    captionTextPart,
    captionElementPart,
    machineDisplayName,
    setElementDisplayLabels,
    getDisplayLabel,
    get mode() {
      return mode;
    },
    get machineNames() {
      return [...machineNames];
    },
  };
})();

/* ════════════════════════════════════════════════════════
   TrialRunner  (trial-based flow with header, preamble, next button)

   Two trial types:

   1. Display trial (default):
   {
     title:    "Trial 3",
     preamble: "Alpha receives element A …",
     specs: [ { machines, states, elems, caption? } ],
     wipeTable: false,
   }

   2. Question trial (type: "question"):
   {
     type:     "question",
     title:    "Question 1",
     preamble: "Predict the machine's behavior.",
     question: {
      machine: "m4",         // process machine (shown greyed-out)
       elem:    "G",           // element placed on the left machine
      caption: "Will M4 accept G?" | [...segments],   // question text below machines
     },
     specs: [ ... ],           // result phase (rendered after participant responds)
     wipeTable: false,
   }

   Question trials have two phases:
     Phase 1 ("question"): machines greyed out, element visible, 5-point scale shown,
       "Continue" button disabled until a response is selected.
     Phase 2 ("result"): scale hidden, machines + elements rendered normally (same as display),
       grid is updated, button reverts to "Next Trial".

   Usage:
     TrialRunner.load([trial1, trial2, …]);
     TrialRunner.responses;   // array of { trialIndex, response, trial }
   ════════════════════════════════════════════════════════ */
const TrialRunner = (() => {
  const titleEl = document.getElementById("trial-title");
  const preambleEl = document.getElementById("trial-preamble");
  const nextBtn = document.getElementById("next-trial-btn");
  const scaleContainer = document.getElementById("response-scale-container");
  const scaleRadios = Array.from(
    document.querySelectorAll('input[name="scale-response"]'),
  );
  const binaryContainer = document.getElementById("binary-response-container");
  const binaryBtns = Array.from(
    document.querySelectorAll(".binary-btn"),
  );

  const trialBottomEl = document.getElementById("trial-bottom");

  let queue = [];
  let currentIndex = -1;

  /** @type {'question'|'result'|null} */
  let questionPhase = null;
  let currentResponse = null;
  const responses = [];
  let attentionFailCount = 0;
  let attentionFailLimit = 1;

  let trialOnsetTime = 0;
  let firstScaleTime = null;
  let scaleChangeLog = [];

  /** @type {((trial: object, index: number) => void) | null} */
  let onTrialStart = null;
  /** @type {(() => void) | null} */
  let onAllDone = null;
  /** @type {((entry: object) => void) | null} */
  let onTrialComplete = null;
  /** @type {(() => void) | null} */
  let onTerminated = null;

  function now() { return performance.now(); }

  function updateHeader(trial, index) {
    titleEl.textContent = trial.title ?? `Trial ${index + 1}`;
    preambleEl.textContent = trial.preamble ?? "";
  }

  function resetScale() {
    scaleRadios.forEach((r) => (r.checked = false));
    currentResponse = null;
    firstScaleTime = null;
    scaleChangeLog = [];
  }

  function resetBinary() {
    binaryBtns.forEach((b) => { b.classList.remove("selected"); b.disabled = false; });
    currentResponse = null;
    firstScaleTime = null;
  }

  function showScale() {
    resetScale();
    scaleContainer.classList.remove("scale-off");
    binaryContainer.classList.add("scale-off");
  }

  function showBinary() {
    resetBinary();
    binaryContainer.classList.remove("scale-off");
    scaleContainer.classList.add("scale-off");
  }

  function hideAllInputs() {
    scaleContainer.classList.add("scale-off");
    binaryContainer.classList.add("scale-off");
  }

  scaleRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      const t = now() - trialOnsetTime;
      currentResponse = Number(radio.value);
      if (firstScaleTime == null) firstScaleTime = t;
      scaleChangeLog.push({ value: currentResponse, t });
      if (questionPhase === "question") nextBtn.disabled = false;
    });
  });

  binaryBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = now() - trialOnsetTime;
      binaryBtns.forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      currentResponse = btn.dataset.value;
      if (firstScaleTime == null) firstScaleTime = t;
      scaleChangeLog.push({ value: currentResponse, t });
      if (questionPhase === "question") nextBtn.disabled = false;
    });
  });

  function renderQuestionPhase(trial) {
    questionPhase = "question";
    const q = trial.question;

    const rowIdx = 0;
    // Show both machines in their inactive (blue) state — the default before any outcome.
    MachineCanvas.setLayer("q_machine_0", Experiment.machineSrc(q.machine, "r"), {
      rowIndex: rowIdx,
      slot: 1,
      zIndex: 1,
    });
    MachineCanvas.setLayer("q_res_0", Experiment.machineSrc("res", "r"), {
      rowIndex: rowIdx,
      slot: 3,
      zIndex: 3,
    });
    const rowEl = MachineCanvas.getRowElement(rowIdx);
    if (rowEl) rowEl.classList.add("question-phase");

    if (q.elem) {
      MachineCanvas.setMachineElement(rowIdx, 1, elementSrc(q.elem), {
        id: "q_elem_0",
        zIndex: 10,
        elemId: q.elem,
      });
    }

    const caption =
      q.caption ?? "Will this machine accept this element?";
    MachineCanvas.setRowCaption(rowIdx, caption);

    if (trial._trialType === "attention_check") {
      showBinary();
      if (trial._lockedAnswer) {
        const forcedSide = trial._lockedAnswer;
        binaryBtns.forEach((b) => {
          if (b.dataset.value !== forcedSide) b.disabled = true;
        });
      }
    } else {
      showScale();
    }
    nextBtn.textContent = "Continue";
    nextBtn.disabled = true;
  }

  function transitionToResult(trial) {
    const rt = now() - trialOnsetTime;
    const trialType = trial._trialType ?? "question";

    const responseEntry = {
      trialIndex: currentIndex,
      trialType,
      machine: trial.question?.machine ?? null,
      elem: trial.question?.elem ?? null,
      response: currentResponse,
      firstScaleTime,
      continueRT: rt,
      scaleChangeLog: [...scaleChangeLog],
      specs: (trial.specs ?? []).map((s) => ({
        machines: s.machines,
        states: s.states,
        elems: s.elems,
      })),
      hoverLog: _getHoverLog(),
      _meta: trial._meta ?? null,
    };

    if (trialType === "attention_check") {
      const correctState = (trial.specs ?? [])[0]?.states?.[0] ?? "a";
      const passed = currentResponse === (correctState === "a" ? "accept" : "reject");
      responseEntry.attentionPassed = passed;

      if (!passed) {
        responses.push(responseEntry);
        onTrialComplete?.(responseEntry);

        if (trial._isTutorial) {
          window.alert(
            "Incorrect memory check — this is what a failure looks like.\n\n" +
            "In the real experiment you can fail at most two memory checks before the experiment ends.\n\n" +
            "(The tutorial does not count towards this limit.)"
          );
          if (currentIndex >= queue.length - 1) { onAllDone?.(); return; }
          currentIndex++;
          renderCurrentTrial();
          return;
        }

        attentionFailCount++;
        responseEntry.attentionFailCount = attentionFailCount;

        if (attentionFailCount > attentionFailLimit) {
          onTerminated?.();
          Introduction.showEndScreen(
            `<h2>Experiment Ended</h2>
             <p>Unfortunately, the experiment cannot continue because too many
             memory-check questions were answered incorrectly.</p>
             <p>Thank you for your time.</p>`
          );
          return;
        }

        // First failure: warn and force a retry (do not reveal the correct answer).
        window.alert(
          "Memory check incorrect. Please try again.\n\n(If you miss more than one memory check, the experiment will end.)"
        );
        currentResponse = null;
        resetBinary();
        nextBtn.disabled = true;
        return;
      }

      // Passed: log and move on immediately (no answer reveal for attention checks).
      responses.push(responseEntry);
      onTrialComplete?.(responseEntry);
      if (currentIndex >= queue.length - 1) {
        if (typeof onAllDone === "function") onAllDone();
        return;
      }
      currentIndex++;
      renderCurrentTrial();
      return;
    }

    responses.push(responseEntry);

    questionPhase = "result";
    Experiment.clearCanvas();
    hideAllInputs();
    if (trialBottomEl) trialBottomEl.classList.add("no-divider");

    let firstRowUsed = 0;
    (trial.specs ?? []).forEach((spec, idx) => {
      const range = Experiment.renderTrial(spec);
      if (idx === 0 && range?.firstRow != null) firstRowUsed = range.firstRow;
    });

    // Prediction feedback: highlight whether the participant's prediction matched the outcome.
    if (
      responseEntry.trialType === "prediction"
      && typeof currentResponse === "number"
      && (trial.specs?.[0]?.states?.[0] === "a" || trial.specs?.[0]?.states?.[0] === "r")
    ) {
      const actual = trial.specs[0].states[0];
      const predicted = currentResponse <= 2 ? "a" : "r"; // 4-point forced-choice: 1-2 accept, 3-4 reject
      const ok = predicted === actual;
      responseEntry.predictionCorrect = ok;
      PredictionScore.record(ok);
      const base = trial.specs?.[0]?.caption;
      if (Array.isArray(base)) {
        MachineCanvas.setRowCaption(firstRowUsed, [
          ...base,
          {
            type: "status",
            tone: ok ? "good" : "bad",
            text: ok ? "Your prediction is correct!" : "Your prediction is incorrect.",
          },
        ]);
      }
    }
    onTrialComplete?.(responseEntry);

    const isLast = currentIndex >= queue.length - 1;
    nextBtn.textContent = isLast ? "Finish" : "Next Trial";
    nextBtn.disabled = false;

    const machineCanvas = document.getElementById("machine-canvas");
    if (machineCanvas) machineCanvas.scrollTop = 0;
  }

  function renderCurrentTrial() {
    const trial = queue[currentIndex];
    if (!trial) return;

    // Clear obs highlight from previous trial
    document.querySelectorAll(".element-slot-row.elem-obs-highlight")
      .forEach((el) => el.classList.remove("elem-obs-highlight"));
    document.querySelectorAll(".element-box.elem-obs-highlight-box")
      .forEach((el) => el.classList.remove("elem-obs-highlight-box"));
    clearTimeout(_obsHighlightTimer);

    trialOnsetTime = now();
    _resetHoverLog();

    if (trial.wipeTable) Experiment.wipeLeftTable();
    Experiment.clearCanvas();
    updateHeader(trial, currentIndex);

    if (trial.type === "question") {
      if (trialBottomEl) trialBottomEl.classList.remove("no-divider");
      renderQuestionPhase(trial);
    } else {
      questionPhase = null;
      hideAllInputs();
      if (trialBottomEl) trialBottomEl.classList.add("no-divider");
      const isLast = currentIndex >= queue.length - 1;
      nextBtn.textContent = isLast ? "Finish" : "Next Trial";
      (trial.specs ?? []).forEach((spec) => Experiment.renderTrial(spec));
      nextBtn.disabled = false;

      if (trial._trialType === "observation" && trial._meta?.elemId) {
        autoHighlightObsElement(trial._meta.elemId);
      }
    }

    const machineCanvas = document.getElementById("machine-canvas");
    if (machineCanvas) machineCanvas.scrollTop = 0;

    if (typeof onTrialStart === "function") {
      onTrialStart(trial, currentIndex);
    }
  }

  function next() {
    const trial = queue[currentIndex];

    if (trial && trial.type === "question" && questionPhase === "question") {
      transitionToResult(trial);
      return;
    }

    if (trial && trial.type !== "question" && trialOnsetTime > 0) {
      const rt = now() - trialOnsetTime;
      const obsEntry = {
        trialIndex: currentIndex,
        trialType: trial._trialType ?? "observation",
        machine: trial.specs?.[0]?.machines?.[0] ?? null,
        specs: (trial.specs ?? []).map((s) => ({
          machines: s.machines,
          states: s.states,
          elems: s.elems,
        })),
        nextRT: rt,
        hoverLog: _getHoverLog(),
        _meta: trial._meta ?? null,
      };
      responses.push(obsEntry);
      onTrialComplete?.(obsEntry);
    }

    if (currentIndex >= queue.length - 1) {
      if (typeof onAllDone === "function") onAllDone();
      return;
    }
    currentIndex++;
    renderCurrentTrial();
  }

  /**
   * Load a sequence of trial specs and display the first one.
   * @param {object[]} trials
   * @param {{ keepResponses?: boolean }} [opts] — if true, existing responses are preserved (for block chaining)
   */
  function load(trials, opts = {}) {
    queue = trials;
    currentIndex = -1;
    if (!opts.keepResponses) responses.length = 0;
    next();
  }

  /** Jump to a specific trial index (0-based). */
  function goTo(index) {
    if (index < 0 || index >= queue.length) return;
    currentIndex = index;
    renderCurrentTrial();
  }

  nextBtn.addEventListener("click", next);

  return {
    load,
    next,
    goTo,
    get currentIndex() {
      return currentIndex;
    },
    get length() {
      return queue.length;
    },
    get responses() {
      return [...responses];
    },
    set onTrialStart(fn) {
      onTrialStart = fn;
    },
    set onAllDone(fn) {
      onAllDone = fn;
    },
    set onTrialComplete(fn) {
      onTrialComplete = fn;
    },
    set onTerminated(fn) {
      onTerminated = fn;
    },
    set attentionFailLimit(n) {
      attentionFailLimit = Number(n);
    },
  };
})();

/* ════════════════════════════════════════════════════════
   Prediction score — cumulative across real blocks.
   Reset after tutorial; shown once the first prediction fires.
   ════════════════════════════════════════════════════════ */
const PredictionScore = (() => {
  const displayEl  = document.getElementById("score-display");
  const correctEl  = document.getElementById("score-correct");
  const totalEl    = document.getElementById("score-total");

  let correct = 0;
  let total   = 0;

  function update() {
    if (correctEl) correctEl.textContent = correct;
    if (totalEl)   totalEl.textContent   = total;
    if (total > 0 && displayEl) displayEl.classList.remove("hidden");
  }

  function record(isCorrect) {
    if (isCorrect) correct++;
    total++;
    update();
  }

  function reset() {
    correct = 0;
    total   = 0;
    update();
    if (displayEl) displayEl.classList.add("hidden");
  }

  function getStats() { return { correct, total }; }

  return { record, reset, getStats };
})();

/* ════════════════════════════════════════════════════════
   Hover log — ordered sequence of element IDs hovered per trial
   ════════════════════════════════════════════════════════ */
let _hoverLog = [];
function _resetHoverLog() { _hoverLog = []; }
function _getHoverLog()   { return [..._hoverLog]; }
function _pushHover(elemId) {
  if (!elemId) return;
  const id = String(elemId).toUpperCase();
  // Deduplicate consecutive entries (mouseover fires on child elements too)
  if (_hoverLog.length > 0 && _hoverLog[_hoverLog.length - 1] === id) return;
  _hoverLog.push(id);
}

/* ════════════════════════════════════════════════════════
   Cross-highlighting: hovering an element on the canvas
   highlights every matching slot-row in the left table.
   ════════════════════════════════════════════════════════ */
(() => {
  const canvas = document.getElementById("machine-canvas");
  const grid = document.getElementById("element-grid");
  const HIGHLIGHT_ROW_CLASS = "elem-highlight";
  const HIGHLIGHT_BOX_CLASS = "elem-highlight-box";
  const HIGHLIGHT_CANVAS_CLASS = "elem-highlight-canvas";
  const HIGHLIGHT_CAPTION_CLASS = "elem-highlight-chip";

  function clearHighlights() {
    document.querySelectorAll(`.element-slot-row.${HIGHLIGHT_ROW_CLASS}`)
      .forEach((el) => el.classList.remove(HIGHLIGHT_ROW_CLASS));
    document
      .querySelectorAll(`.element-box.${HIGHLIGHT_BOX_CLASS}`)
      .forEach((el) => el.classList.remove(HIGHLIGHT_BOX_CLASS));
    document
      .querySelectorAll(`.caption-elem-chip.${HIGHLIGHT_CAPTION_CLASS}`)
      .forEach((el) => el.classList.remove(HIGHLIGHT_CAPTION_CLASS));
  }

  function highlightElement(elemId) {
    if (!elemId) return;
    const id = elemId.toUpperCase();
    document.querySelectorAll(`.element-slot-row[data-elem-id="${id}"]`)
      .forEach((el) => {
        el.classList.add(HIGHLIGHT_ROW_CLASS);
        const box = el.closest(".element-box");
        if (box) box.classList.add(HIGHLIGHT_BOX_CLASS);
      });
    // Canvas element layers (.machine-element-layer) intentionally NOT highlighted:
    // the element images are circular art in rectangular PNGs so the rect highlight looks odd.
    document.querySelectorAll(`.caption-elem-chip[data-elem-id="${id}"]`)
      .forEach((el) => el.classList.add(HIGHLIGHT_CAPTION_CLASS));
  }

  function findElemTarget(e) {
    return e.target.closest(".machine-element-layer[data-elem-id]")
        || e.target.closest(".caption-elem-chip[data-elem-id]");
  }

  function findGridTarget(e) {
    return e.target.closest(".element-slot-row[data-elem-id]");
  }

  canvas.addEventListener("mouseenter", (e) => {
    const el = findElemTarget(e);
    if (!el) return;
    clearHighlights();
    highlightElement(el.dataset.elemId);
  }, true);

  canvas.addEventListener("mouseleave", (e) => {
    const el = findElemTarget(e);
    if (!el) return;
    const related = e.relatedTarget;
    if (related && related.closest && findElemTarget({ target: related })) return;
    clearHighlights();
  }, true);

  canvas.addEventListener("mouseover", (e) => {
    const el = findElemTarget(e);
    if (el) {
      clearHighlights();
      highlightElement(el.dataset.elemId);
      _pushHover(el.dataset.elemId);
    }
  });

  canvas.addEventListener("mouseout", (e) => {
    const el = findElemTarget(e);
    if (!el) return;
    const related = e.relatedTarget;
    if (related && related.closest && findElemTarget({ target: related })) return;
    clearHighlights();
  });

  // Reverse highlighting: hovering items in the knowledge table highlights canvas + caption.
  if (grid) {
    grid.addEventListener("mouseover", (e) => {
      const el = findGridTarget(e);
      if (el) {
        clearHighlights();
        highlightElement(el.dataset.elemId);
        _pushHover(el.dataset.elemId);
      }
    });
    grid.addEventListener("mouseout", (e) => {
      const el = findGridTarget(e);
      if (!el) return;
      const related = e.relatedTarget;
      if (related && related.closest && findGridTarget({ target: related })) return;
      clearHighlights();
    });
  }
})();

/* ════════════════════════════════════════════════════════
   Observation auto-highlight — briefly pulses the newly-
   observed element row and its parent cell, fading in 2 s.
   ════════════════════════════════════════════════════════ */
let _obsHighlightTimer = null;

function autoHighlightObsElement(elemId) {
  if (!elemId) return;
  const id = String(elemId).toUpperCase();

  document.querySelectorAll(".element-slot-row.elem-obs-highlight")
    .forEach((el) => el.classList.remove("elem-obs-highlight"));
  document.querySelectorAll(".element-box.elem-obs-highlight-box")
    .forEach((el) => el.classList.remove("elem-obs-highlight-box"));
  clearTimeout(_obsHighlightTimer);

  // rAF so the class removal above has settled before we re-add
  requestAnimationFrame(() => {
    document.querySelectorAll(`.element-slot-row[data-elem-id="${id}"]`).forEach((el) => {
      el.classList.add("elem-obs-highlight");
      const box = el.closest(".element-box");
      if (box) box.classList.add("elem-obs-highlight-box");
    });
    _obsHighlightTimer = setTimeout(() => {
      document.querySelectorAll(".element-slot-row.elem-obs-highlight")
        .forEach((el) => el.classList.remove("elem-obs-highlight"));
      document.querySelectorAll(".element-box.elem-obs-highlight-box")
        .forEach((el) => el.classList.remove("elem-obs-highlight-box"));
    }, 2100);
  });
}

/* ═══════════════════════════════════════════════════════════════
   PART 1 — Introduction  (multi-page walkthrough overlay)
   ═══════════════════════════════════════════════════════════════ */
const Introduction = (() => {
  const overlay   = document.getElementById("intro-overlay");
  const content   = document.getElementById("intro-content");
  const indicator = document.getElementById("intro-page-indicator");
  const btn       = document.getElementById("intro-next-btn");

  let pages = [];
  let pageIndex = 0;
  let onDone = null;

  let finalBtnText = "Begin Experiment";

  function render() {
    content.innerHTML = pages[pageIndex];
    indicator.textContent = `${pageIndex + 1} / ${pages.length}`;
    btn.textContent = pageIndex < pages.length - 1 ? "Continue" : finalBtnText;
  }

  function advance() {
    if (pageIndex < pages.length - 1) {
      pageIndex++;
      render();
    } else {
      overlay.classList.add("hidden");
      if (typeof onDone === "function") onDone();
    }
  }

  btn.addEventListener("click", advance);

  /**
   * @param {string[]} pageArray
   * @param {Function} callback
   * @param {{ finalButton?: string }} [opts]
   */
  function start(pageArray, callback, opts = {}) {
    pages = pageArray;
    pageIndex = 0;
    onDone = callback;
    finalBtnText = opts.finalButton ?? "Begin Experiment";
    btn.style.display = "";
    overlay.classList.remove("hidden");
    render();
  }

  function showEndScreen(html) {
    content.innerHTML = html ?? `<h2>Thank You!</h2>
      <p>You have completed the experiment. Your responses have been recorded.</p>
      <p>We greatly appreciate your time and effort. You may now close this window.</p>`;
    indicator.textContent = "";
    btn.style.display = "none";
    overlay.classList.remove("hidden");
  }

  return { start, showEndScreen };
})();

/* ═══════════════════════════════════════════════════════════════
   PART 2 — Trial generators
   ═══════════════════════════════════════════════════════════════ */
const TrialGenerators = (() => {
  const t = (s) => Experiment.captionTextPart(s);
  const e = (id) => Experiment.captionElementPart(id);

  function g(name) { return Experiment.machineDisplayName(name); }
  const ENERGY_ELEM_ID = "OutT"; // img/elem_OutT.png — the "Energy element"

  function captionAccept(machine, elem) {
    return [
      { type: "machine", text: g(machine) }, t(` activates with `), e(elem),
      t(` and produces an Energy element `), e(ENERGY_ELEM_ID), t(`.`),
    ];
  }
  function captionReject(machine, elem) {
    return [
      { type: "machine", text: g(machine) }, t(` stays idle with `), e(elem),
      t(`. No Energy element is produced.`),
    ];
  }

  function observation(machine, elem, state, opts = {}) {
    const stateLabel = state === "a" ? "activates" : "stays idle";
    const resState = state === "a" ? "a" : "r";
    const resElem  = state === "a" ? ENERGY_ELEM_ID : null;

    return {
      _trialType: "observation",
      title: opts.title ?? "Observation",
      preamble: opts.preamble ?? `Observe: ${g(machine)} ${stateLabel} with an element.`,
      wipeTable: opts.wipeTable ?? false,
      specs: [{
        machines: [machine, "res"],
        states:   [state, resState],
        elems:    [elem, resElem],
        caption:  state === "a" ? captionAccept(machine, elem) : captionReject(machine, elem),
      }],
    };
  }

  function prediction(machine, elem, actualState, opts = {}) {
    const resState = actualState === "a" ? "a" : "r";
    const resElem  = actualState === "a" ? ENERGY_ELEM_ID : null;

    return {
      _trialType: "prediction",
      type: "question",
      title: opts.title ?? "Prediction",
      preamble: opts.preamble ?? "Will this machine activate with this element?",
      question: {
        machine,
        elem,
        caption: [t(`Will `), { type: "machine", text: g(machine) }, t(` activate with `), e(elem), t("?")],
      },
      specs: [{
        machines: [machine, "res"],
        states:   [actualState, resState],
        elems:    [elem, resElem],
        caption:  actualState === "a" ? captionAccept(machine, elem) : captionReject(machine, elem),
      }],
    };
  }

  function attentionCheck(machine, elem, actualState, opts = {}) {
    const resState = actualState === "a" ? "a" : "r";
    const resElem  = actualState === "a" ? ENERGY_ELEM_ID : null;

    return {
      _trialType: "attention_check",
      _lockedAnswer: opts.lockedAnswer ?? null,
      _isTutorial:  opts.isTutorial  ?? false,
      type: "question",
      title: opts.title ?? "Memory Check",
      preamble: opts.preamble ?? "You have seen this before. Did this machine activate or stay idle with this element?",
      question: {
        machine,
        elem,
        caption: [t(`Did ${g(machine)} activate or stay idle with `), e(elem), t("?")],
      },
      specs: [{
        machines: [machine, "res"],
        states:   [actualState, resState],
        elems:    [elem, resElem],
        caption:  actualState === "a" ? captionAccept(machine, elem) : captionReject(machine, elem),
      }],
    };
  }

  return { observation, prediction, attentionCheck };
})();

/* ═══════════════════════════════════════════════════════════════
   Page helpers — shared by intro, block transitions, and end screen
   ═══════════════════════════════════════════════════════════════ */
const PageHelpers = (() => {
  const ENERGY_ELEM_ID = "OutT";

  function elemImg(id, size = 42) {
    return `<img class="intro-icon" src="img/elem_${id}.png" alt="${id}" style="height:${size}px;width:${size}px;">`;
  }

  function machineSrc(machine, state) {
    if (/^m\d+$/i.test(String(machine))) {
      return `img/${String(machine).toUpperCase()}_${state}.png`;
    }
    return `img/${machine}_${state}.png`;
  }

  function canvasPreview(machine, state, opts = {}) {
    const resState = state === "a" ? "a" : "r";
    const greyClass = opts.greyed ? " question-phase" : "";
    let elems = "";
    if (opts.elem)  elems += `<img class="machine-element-layer slot-1" src="img/elem_${opts.elem}.png" draggable="false">`;
    if (opts.token) elems += `<img class="machine-element-layer slot-3" src="img/elem_${opts.token}.png" draggable="false">`;
    const style = opts.style ? ` style="${opts.style}"` : "";
    return `<div class="intro-canvas-preview"${style}>
      <div class="machine-row machine-row--two-cols${greyClass}">
        <div class="machine-row-strip">
          <img class="machine-layer slot-1" src="${machineSrc(machine, state)}" draggable="false">
          <img class="machine-layer slot-3" src="img/res_${resState}.png" draggable="false">
          ${elems}
        </div>
      </div>
    </div>`;
  }

  const scalePreview = `<div class="intro-scale-preview">
    <div id="intro-scale-static" style="display:flex;align-items:center;gap:16px;max-width:780px;width:100%;">
      <span class="scale-label scale-label--left">Definitely Active</span>
      <div class="scale-options">
        <label class="scale-option"><span class="scale-pip"></span></label>
        <label class="scale-option"><span class="scale-pip"></span></label>
        <label class="scale-option"><span class="scale-pip"></span></label>
        <label class="scale-option"><span class="scale-pip"></span></label>
      </div>
      <span class="scale-label scale-label--right">Definitely Idle</span>
    </div>
  </div>`;

  const binaryPreview = `<div class="intro-binary-preview">
    <button class="binary-btn binary-btn--accept" type="button" disabled>Active</button>
    <button class="binary-btn binary-btn--reject" type="button" disabled>Idle</button>
  </div>`;

  /** @param {Record<string,string>} roleToElementId — role alias (e.g. "eA") -> actual element id (e.g. "C3") */
  function buildElemGallery(roleToElementId) {
    return Object.entries(roleToElementId).map(([role, id]) => {
      const label = role.replace(/^e/, ""); // "eA" -> "A" for subject-facing display
      return `<div class="intro-elem-item">${elemImg(id, 52)}<span>${label}</span></div>`;
    }).join("");
  }

  return { ENERGY_ELEM_ID, elemImg, machineSrc, canvasPreview, scalePreview, binaryPreview, buildElemGallery };
})();

/* ═══════════════════════════════════════════════════════════════
   Introduction page content
   ═══════════════════════════════════════════════════════════════ */
/**
 * @param {object} resolved — output of BlockConfig.resolve()
 * @param {Record<string,string>} roleToElementId — e.g. { eA: "D1", eB: "B1", ... }
 * @param {string[][]} resolved.machineNamesPerBlock — e.g. [["m1","m2","m3"], ...]
 */
function buildIntroPages(resolved) {
  const { ENERGY_ELEM_ID, elemImg, canvasPreview } = PageHelpers;
  const EI = (sz) => elemImg(ENERGY_ELEM_ID, sz);

  const ids = Object.values(resolved.roleToElementIdPerBlock[0]);
  const [exA, exB] = ids;
  const [m1] = resolved.machineNamesPerBlock[0];
  const m1Name = Experiment.machineDisplayName(m1);

  return [
    `<h2>Welcome, Investigator</h2>
     <p>Your team has recovered a trove of <strong>alien artifacts</strong> — twelve
     machines and a collection of small objects called <strong>elements</strong>,
     each bearing a unique symbol.</p>
     <p>Early tests show that the machines are selective. When the <em>right</em>
     element is placed inside, a machine springs to life —
     <span class="intro-highlight hl-orange">glowing orange</span> and producing a
     powerful ${EI(20)} <strong>Energy element</strong>.
     When the <em>wrong</em> element is used, it stays
     <span class="intro-highlight hl-blue">cold and idle</span>, producing nothing.</p>
     <p>Your mission: <strong>figure out which elements activate each machine</strong>
     so the team can reliably produce Energy elements.</p>`,

    `<h2>Active vs. Idle</h2>
     <p>When the right element is placed, the machine <strong>activates</strong> and
     produces an ${EI(18)} Energy element:</p>
     ${canvasPreview(m1, "a", { elem: exA, token: ENERGY_ELEM_ID })}
     <p style="text-align:center;opacity:0.65;font-size:0.9rem;">
       ${m1Name} activates — Energy element produced.</p>
     <p>When the wrong element is used, the machine <strong>stays idle</strong>:</p>
     ${canvasPreview(m1, "r", { elem: exB })}
     <p style="text-align:center;opacity:0.65;font-size:0.9rem;">
       ${m1Name} stays idle — nothing produced.</p>
     <p>You're about to do a short <strong>practice trial</strong> to get familiar
     with the interface. The real experiment begins right after.</p>`,
  ];
}

/* ═══════════════════════════════════════════════════════════════
   Block transition pages
   ═══════════════════════════════════════════════════════════════ */
/**
 * @param {number}   blockNum
 * @param {string[]} machines  — e.g. ["m4","m5","m6"]
 * @param {string[]} elemIds   — resolved element ids appearing in this block's trials
 */
function blockTransitionPages(blockNum, machines, elemIds, displayLabels = {}) {
  const { elemImg, ENERGY_ELEM_ID, canvasPreview } = PageHelpers;

  const isFirst = blockNum === 1;
  const opener = isFirst
    ? "Let's get started."
    : "Excellent work. The team is now moving on to the next group of machines.";

  const sortedElemIds = [...elemIds].sort((a, b) => {
    const la = displayLabels[a.toUpperCase()] ?? a;
    const lb = displayLabels[b.toUpperCase()] ?? b;
    return la.localeCompare(lb);
  });
  const cols = Math.min(sortedElemIds.length, 6);
  const elemGallery = sortedElemIds.map((id) => {
    const label = displayLabels[id.toUpperCase()] ?? id;
    return `<div class="intro-elem-item">${elemImg(id, 52)}<span>${label}</span></div>`;
  }).join("");

  // Page 1 — elements
  const elemPage =
    `<h2>Block ${blockNum} — Elements</h2>
     <p>${opener} In this block you will be working with the following
     <strong>${elemIds.length} elements</strong>:</p>
     <div class="intro-elem-gallery" style="grid-template-columns:repeat(${cols},1fr);">
       ${elemGallery}
     </div>
     <div class="intro-callout callout-gray">
       The element labels are <strong>arbitrary identifiers</strong> — they carry no inherent meaning.
       The Knowledge Table has been reset and will track each machine's
       active / idle history for these elements throughout the block.
     </div>`;

  // One page per machine — machine + res in idle state
  const machinePages = machines.map((m, i) => {
    const mName = Experiment.machineDisplayName(m);
    const isLast = i === machines.length - 1;
    return `<h2>Block ${blockNum} — ${mName}</h2>
     <p><strong>${mName}</strong> is one of the machines you will
     investigate in this block. Here it is in its default
     <span class="intro-highlight hl-blue">idle state</span>:</p>
     ${canvasPreview(m, "r", {})}
     ${isLast
       ? `<p>Now you know all the machines for this block. The trials will
          begin on the next screen — good luck!</p>`
       : `<p>On the next page you'll see the next machine for this block.</p>`
     }`;
  });

  return [elemPage, ...machinePages];
}

/* ═══════════════════════════════════════════════════════════════
   Tutorial  —  game-style guided walkthrough on the first trial
   ═══════════════════════════════════════════════════════════════ */
const Tutorial = (() => {
  const spotlight = document.getElementById("tutorial-spotlight");
  const tooltip   = document.getElementById("tutorial-tooltip");
  const ttText    = document.getElementById("tutorial-text");
  const ttBtn     = document.getElementById("tutorial-btn");
  const ttArrow   = document.getElementById("tutorial-arrow");

  // Full-screen backdrop that blocks all page interaction while a step is shown.
  const backdrop = document.createElement("div");
  backdrop.style.cssText = "position:fixed;inset:0;z-index:9999;display:none;";
  document.body.appendChild(backdrop);

  let steps = [];
  let stepIdx = -1;
  let active = false;
  let onDone = null;

  function show() {
    backdrop.style.display = "block";
    spotlight.classList.remove("hidden");
    tooltip.classList.remove("hidden");
  }

  function hide() {
    backdrop.style.display = "none";
    spotlight.classList.add("hidden");
    tooltip.classList.add("hidden");
    active = false;
    if (typeof onDone === "function") onDone();
  }

  function positionSpotlight(el, pad) {
    const r = el.getBoundingClientRect();
    spotlight.style.left   = (r.left   - pad) + "px";
    spotlight.style.top    = (r.top    - pad) + "px";
    spotlight.style.width  = (r.width  + pad * 2) + "px";
    spotlight.style.height = (r.height + pad * 2) + "px";
  }

  function positionTooltip(el, pos) {
    const r = el.getBoundingClientRect();
    ttArrow.className = "tutorial-arrow";
    tooltip.style.left = "";
    tooltip.style.right = "";
    tooltip.style.top = "";
    tooltip.style.bottom = "";
    tooltip.style.transform = "";

    const gap = 18;
    const ttW = 370;

    if (pos === "left") {
      tooltip.style.right = (window.innerWidth - r.left + gap) + "px";
      tooltip.style.top = (r.top + r.height / 2) + "px";
      tooltip.style.transform = "translateY(-50%)";
      ttArrow.classList.add("arrow-right");
    } else if (pos === "right") {
      tooltip.style.left = (r.right + gap) + "px";
      tooltip.style.top = (r.top + r.height / 2) + "px";
      tooltip.style.transform = "translateY(-50%)";
      ttArrow.classList.add("arrow-left");
    } else if (pos === "top") {
      tooltip.style.left = (r.left + r.width / 2 - ttW / 2) + "px";
      tooltip.style.bottom = (window.innerHeight - r.top + gap) + "px";
      ttArrow.classList.add("arrow-down");
    } else {
      tooltip.style.left = (r.left + r.width / 2 - ttW / 2) + "px";
      tooltip.style.top = (r.bottom + gap) + "px";
      ttArrow.classList.add("arrow-up");
    }

    const rect = tooltip.getBoundingClientRect();
    if (rect.left < 8) tooltip.style.left = "8px";
    if (rect.right > window.innerWidth - 8) {
      tooltip.style.left = "";
      tooltip.style.right = "8px";
    }
    if (rect.top < 8) tooltip.style.top = "8px";
  }

  function forceHighlight(elemId) {
    if (!elemId) return;
    const id = elemId.toUpperCase();
    document.querySelectorAll(`.element-slot-row[data-elem-id="${id}"]`)
      .forEach((el) => {
        el.classList.add("elem-highlight");
        const box = el.closest(".element-box");
        if (box) box.classList.add("elem-highlight-box");
      });
  }

  function clearForcedHighlights() {
    document.querySelectorAll(".elem-highlight")
      .forEach((el) => el.classList.remove("elem-highlight"));
    document.querySelectorAll(".elem-highlight-box")
      .forEach((el) => el.classList.remove("elem-highlight-box"));
  }

  function runStep(idx) {
    if (idx >= steps.length) { hide(); return; }
    stepIdx = idx;
    const step = steps[idx];

    const target = typeof step.target === "function"
      ? step.target()
      : document.querySelector(step.target);

    if (!target) { runStep(idx + 1); return; }

    const pad = step.padding ?? 12;
    positionSpotlight(target, pad);
    positionTooltip(target, step.position ?? "bottom");
    ttText.innerHTML = step.text;
    ttBtn.textContent = step.buttonText ?? "Got it";

    if (step.onEnter) step.onEnter();
  }

  function advance() {
    const prev = steps[stepIdx];
    if (prev && prev.onLeave) prev.onLeave();
    runStep(stepIdx + 1);
  }

  ttBtn.addEventListener("click", advance);

  function start(stepArray, callback) {
    steps = stepArray;
    stepIdx = -1;
    active = true;
    onDone = callback ?? null;
    show();
    runStep(0);
  }

  return { start, forceHighlight, clearForcedHighlights, get active() { return active; } };
})();

/* ═══════════════════════════════════════════════════════════════
   BlockConfig — loads block layout from public/data/blocks-config.json
   and resolves the random (or fixed) machine-group / element-role
   assignment for this session into concrete trial arrays.
   ═══════════════════════════════════════════════════════════════ */
const BlockConfig = (() => {
  async function load() {
    const res = await fetch("data/blocks-config.json");
    return res.json();
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Machine aliases referenced within a block, e.g. ["m1", "m2", "m3"] (sorted, deduped). */
  function collectMachineAliases(blockDef) {
    const set = new Set();
    blockDef.trials.forEach((t) => set.add(t.machineSlot));
    return [...set].sort();
  }

  /** Element role aliases referenced anywhere in the config, e.g. ["eA", "eB", ...] (sorted, deduped). */
  function collectElementRoles(config) {
    const set = new Set();
    config.blocks.forEach((b) => b.trials.forEach((t) => set.add(t.elementRole)));
    return [...set].sort();
  }

  /**
   * @returns {Record<string, number>[]} one { aliasm1: machineId, ... } map per block
   */
  function resolveMachinesPerBlock(config) {
    const { groups } = config.machines;
    const rnd = config.randomization;
    const numBlocks = config.blocks.length;

    const groupIndexForBlock = rnd.randomizeGroupSelection
      ? shuffle(groups.map((_, i) => i)).slice(0, numBlocks)
      : groups.map((_, i) => i).slice(0, numBlocks);

    return config.blocks.map((blockDef, blockIdx) => {
      const group = groups[groupIndexForBlock[blockIdx]];
      const aliases = collectMachineAliases(blockDef);
      if (aliases.length > group.length) {
        throw new Error(
          `Block ${blockIdx + 1} uses ${aliases.length} machine aliases (${aliases.join(", ")}) ` +
          `but its machine group only has ${group.length} machines`,
        );
      }
      const order = rnd.randomizeSlotOrderWithinGroup ? shuffle(group) : [...group];

      const aliasToMachineId = {};
      aliases.forEach((alias, i) => { aliasToMachineId[alias] = order[i]; });
      return aliasToMachineId;
    });
  }

  /**
   * Resolves each element role alias to a major class letter (no variant yet).
   * Shuffled once so all blocks share the same major-class assignment.
   * @returns {Record<string,string>} e.g. { eA: "D", eB: "B", eC: "I", ... }
   */
  function resolveRolesToMajorClasses(config) {
    const { majorClasses } = config.elements;
    const rnd = config.randomization;
    const roles = collectElementRoles(config);

    if (roles.length > majorClasses.length) {
      throw new Error(
        `Element alias capacity exceeded: ${roles.length} aliases used (${roles.join(", ")}) ` +
        `but only ${majorClasses.length} major element classes are available`,
      );
    }

    const classesForRoles = rnd.randomizeElementMapping
      ? shuffle([...majorClasses]).slice(0, roles.length)
      : majorClasses.slice(0, roles.length);

    return Object.fromEntries(roles.map((role, i) => [role, classesForRoles[i]]));
  }

  /**
   * Applies a minor variant number to a major-class map, producing full element ids.
   * @param {Record<string,string>} rolesToMajorClasses e.g. { eA: "D", eB: "B" }
   * @param {number} variant 1–4
   * @returns {Record<string,string>} e.g. { eA: "D2", eB: "B2" }
   */
  function applyVariant(rolesToMajorClasses, variant) {
    return Object.fromEntries(
      Object.entries(rolesToMajorClasses).map(([role, cls]) => [role, `${cls}${variant}`])
    );
  }

  /**
   * Returns the minor variant to use for a given block.
   * Priority: blockDef.minorVariant > randomizeMinorVariant > default 1.
   */
  function getVariantForBlock(rnd, blockDef) {
    if (blockDef.minorVariant != null) return blockDef.minorVariant;
    if (rnd.randomizeMinorVariant) return 1 + Math.floor(Math.random() * 4);
    return 1;
  }

  function buildBlockTrials(blockDef, aliasToMachineId, roleToElementId) {
    const generators = {
      observation: TrialGenerators.observation,
      prediction: TrialGenerators.prediction,
      attentionCheck: TrialGenerators.attentionCheck,
    };

    const typeTitles = { observation: "Observation", attentionCheck: "Attention Check", prediction: "Prediction" };
    const counters = {};

    return blockDef.trials.map((t) => {
      const machineId = aliasToMachineId[t.machineSlot];
      if (machineId == null) throw new Error(`Unknown machine alias "${t.machineSlot}"`);
      const elem = roleToElementId[t.elementRole];
      if (elem == null) throw new Error(`Unknown element role alias "${t.elementRole}"`);
      const generate = generators[t.type];
      if (!generate) throw new Error(`Unknown trial type: ${t.type}`);
      if (!["a", "r"].includes(t.state)) {
        throw new Error(`Invalid state "${t.state}" for trial type "${t.type}" (expected a/r)`);
      }
      counters[t.type] = (counters[t.type] ?? 0) + 1;
      const autoTitle = typeTitles[t.type] ? `${typeTitles[t.type]} ${counters[t.type]}` : t.title;
      const trial = generate(`m${machineId}`, elem, t.state, {
        title:        autoTitle,
        preamble:     t.preamble,
        lockedAnswer: t.lockedAnswer,
        isTutorial:   t.isTutorial,
      });
      trial._meta = {
        role:          t.elementRole,
        elemId:        elem,
        correctAnswer: t.state,
        critical:      t.critical ?? false,
      };
      return trial;
    });
  }

  function resolveTutorial(config) {
    const tut = config.tutorial;
    if (!tut) return null;

    const machAliases = collectMachineAliases(tut);
    const aliasToMachineId = {};
    machAliases.forEach((alias) => {
      const slotN = parseInt(alias.slice(1), 10) - 1;
      aliasToMachineId[alias] = tut.machines[slotN];
    });

    const roles = [...new Set(tut.trials.map((t) => t.elementRole))].sort();
    const classes = tut.majorClasses ?? config.elements.majorClasses;
    const roleToElem = {};
    roles.forEach((role, i) => { roleToElem[role] = `${classes[i]}1`; });

    const trials = buildBlockTrials(tut, aliasToMachineId, roleToElem);
    const machines = machAliases.sort().map((a) => `m${aliasToMachineId[a]}`);
    return { trials, machines, roleToElem };
  }

  /**
   * @returns {{
   *   blocks: object[][],
   *   machineNamesPerBlock: string[][],
   *   roleToElementIdPerBlock: Record<string,string>[],
   *   tutorial: {trials,machines}|null
   * }}
   */
  async function resolve() {
    const config = await load();
    const aliasMapsPerBlock = resolveMachinesPerBlock(config);
    const roles = collectElementRoles(config);
    const { majorClasses } = config.elements;
    const rnd = config.randomization;

    // Each block draws independently from the full major-class pool.
    const roleToElementIdPerBlock = config.blocks.map((blockDef) => {
      const rolesToMajorClasses = resolveRolesToMajorClasses(config);
      return applyVariant(rolesToMajorClasses, getVariantForBlock(rnd, blockDef));
    });

    const blocks = config.blocks.map((blockDef, i) =>
      buildBlockTrials(blockDef, aliasMapsPerBlock[i], roleToElementIdPerBlock[i]),
    );
    const machineNamesPerBlock = aliasMapsPerBlock.map((aliasMap) =>
      Object.keys(aliasMap).sort().map((alias) => `m${aliasMap[alias]}`),
    );
    const tutorial = resolveTutorial(config);

    const debug = config.debug ?? {};
    const blockConditions = config.blocks.map(b => b.condition ?? null);
    return { blocks, machineNamesPerBlock, roleToElementIdPerBlock, tutorial, debug, blockConditions };
  }

  return { resolve };
})();

/* ═══════════════════════════════════════════════════════════════
   DEMO EXPERIMENT — 3 blocks, each with 3 machines drawn from a
   randomized (or fixed) machine group; see blocks-config.json
   ═══════════════════════════════════════════════════════════════ */
(async function runExperiment() {
  const resolved = await BlockConfig.resolve();
  const { tutorial, debug } = resolved;

  // Apply debug overrides
  if (debug.attentionFailLimit != null) TrialRunner.attentionFailLimit = debug.attentionFailLimit;
  const skipIntro       = debug.skipIntro       ?? false;
  const skipTutorial    = debug.skipTutorial    ?? false;
  const skipTransitions = debug.skipTransitions ?? false;

  // Session init — gets pid from server and server-assigned block presentation order
  const session = await initSession();
  const blockOrder = session.blockOrder;  // e.g. [1, 2, 3, 0]

  const ordBlocks     = blockOrder.map(i => resolved.blocks[i]);
  const ordMachines   = blockOrder.map(i => resolved.machineNamesPerBlock[i]);
  const ordRoleToElem = blockOrder.map(i => resolved.roleToElementIdPerBlock[i]);
  const ordConditions = blockOrder.map(i => resolved.blockConditions[i]);

  function buildBlockDisplayLabels(roleToElementId, blockNum) {
    const labels = {};
    Object.entries(roleToElementId).forEach(([role, elemId]) => {
      const majorClass = String(elemId).replace(/\d+$/, '');
      labels[String(elemId).toUpperCase()] = `${majorClass}${blockNum}`;
    });
    return labels;
  }

  const ordLabels = ordRoleToElem.map((rte, i) => buildBlockDisplayLabels(rte, i + 1));

  // Stamp each trial with its block/trial metadata so saveTrial has everything it needs
  function annotateBlockTrials(block, blockNum, blockCondition, displayLabels) {
    block.forEach((trial, i) => {
      if (!trial._meta) trial._meta = {};
      trial._meta.blockNum       = blockNum;
      trial._meta.blockCondition = blockCondition;
      trial._meta.trialNum       = i + 1;
      const key = String(trial._meta.elemId ?? "").toUpperCase();
      trial._meta.displayLabel   = displayLabels[key] ?? trial._meta.elemId;
    });
  }
  ordBlocks.forEach((block, i) => annotateBlockTrials(block, i + 1, ordConditions[i], ordLabels[i]));

  TrialRunner.onTrialComplete = (entry) => saveTrial(entry);
  TrialRunner.onTerminated    = () => completeSession(true);

  /** Unique non-energy element ids that appear in a resolved block's trial array. */
  function blockElemIds(blockTrials) {
    const seen = new Set();
    blockTrials.forEach((trial) => {
      const candidates = [
        trial.question?.elem,
        ...(trial.specs ?? []).map((s) => s.elems?.[0]),
      ];
      candidates.forEach((e) => {
        if (e && !["outt", "outf", "energy"].includes(String(e).toLowerCase())) {
          seen.add(e);
        }
      });
    });
    return [...seen];
  }

  let tutorialDone = false;

  function runTutorialBlock(onDone) {
    if (!tutorial) { onDone(); return; }
    // Set tutorial display labels (letter only, e.g. "A", "B")
    const tutLabels = {};
    Object.entries(tutorial.roleToElem).forEach(([role, elemId]) => {
      tutLabels[String(elemId).toUpperCase()] = role.slice(1);
    });
    Experiment.setElementDisplayLabels(tutLabels);
    Experiment.setBlock(tutorial.machines);
    Experiment.wipeLeftTable();
    PredictionScore.reset();

    let tutAttnCount  = 0;
    let tutPredShown  = false;

    function correctAttnTutorial() {
      Tutorial.start([
        {
          target: () => document.querySelector('#machine-canvas .machine-element-layer[data-elem-id]'),
          position: "left",
          padding: 20,
          text: `<strong>Memory check!</strong> You've seen what this machine did with this element —
                 the matching entry is highlighted in the Knowledge Table.`,
          onEnter() {
            const el = document.querySelector('#machine-canvas .machine-element-layer[data-elem-id]');
            if (el) Tutorial.forceHighlight(el.dataset.elemId);
          },
          onLeave() { Tutorial.clearForcedHighlights(); },
        },
        {
          target: "#binary-response-container",
          position: "top",
          padding: 12,
          text: `This machine <strong>activated</strong> with this element. Select
                 <strong>Active</strong> to confirm what you observed.`,
        },
      ]);
    }

    function wrongAttnTutorial() {
      Tutorial.start([
        {
          target: "#binary-response-container",
          position: "top",
          padding: 12,
          text: `Another memory check — but only <strong>Idle</strong> is selectable here.
                 This lets you see what happens when a memory check is answered incorrectly.`,
          onEnter() {
            const el = document.querySelector('#machine-canvas .machine-element-layer[data-elem-id]');
            if (el) Tutorial.forceHighlight(el.dataset.elemId);
          },
          onLeave() { Tutorial.clearForcedHighlights(); },
        },
      ]);
    }

    function predTutorial() {
      Tutorial.start([
        {
          target: "#response-scale-container",
          position: "top",
          padding: 10,
          text: `Now try a <strong>prediction</strong>! For now, just take a random guess —
                 as the experiment continues you will gather more evidence to make
                 more informed judgements.`,
          action: "button",
          buttonText: "Got it",
        },
      ]);
    }

    TrialRunner.onTrialStart = (trial, index) => {
      if (index === 0 && !tutorialDone) {
        setTimeout(() => firstTrialTutorial(), 350);
      } else if (trial._isTutorial && trial._trialType === "attention_check") {
        tutAttnCount++;
        setTimeout(() => (tutAttnCount === 1 ? correctAttnTutorial() : wrongAttnTutorial()), 350);
      } else if (trial._trialType === "prediction" && !tutPredShown) {
        tutPredShown = true;
        setTimeout(() => predTutorial(), 350);
      }
    };

    TrialRunner.onAllDone = () => {
      Experiment.wipeLeftTable();
      PredictionScore.reset();
      onDone();
    };
    TrialRunner.load(tutorial.trials, { keepResponses: false });
  }

  function firstTrialTutorial(callback) {
    const nextBtn = document.getElementById("next-trial-btn");
    nextBtn.disabled = true;

    const elemTarget = () =>
      document.querySelector('#machine-canvas .machine-element-layer[data-elem-id]');

    const tutorialSteps = [
      {
        target: "#machine-canvas",
        position: "left",
        padding: 6,
        text: `This is the <strong>Canvas</strong>. It shows the machine on the
               left, the element being tested on top of it, and the output module
               on the right. Look — the machine just produced an
               <img class="intro-icon" src="img/elem_OutT.png"
               style="height:20px;width:20px;"> <strong>Energy element</strong>!`,
        action: "button",
      },
      {
        target: elemTarget,
        position: "left",
        padding: 20,
        text: `That element is now recorded in the <strong>Knowledge Table</strong>
               on the left. You can also hover over elements on the canvas at any
               time to highlight their entries in the table.`,
        onEnter() {
          const el = document.querySelector('#machine-canvas .machine-element-layer[data-elem-id]');
          if (el) Tutorial.forceHighlight(el.dataset.elemId);
        },
        onLeave() { Tutorial.clearForcedHighlights(); },
      },
      {
        target: "#element-grid",
        position: "right",
        padding: 10,
        text: `See the highlighted cells? The <strong>Knowledge Table</strong>
               tracks every element each machine has accepted or rejected.
               Hovering over any element on the canvas — or in the caption below
               it — will light up the matching entries here.`,
        action: "button",
        onEnter() {
          const el = document.querySelector(
            '#machine-canvas .machine-element-layer[data-elem-id]');
          if (el) {
            Tutorial.forceHighlight(el.dataset.elemId);
          }
        },
        onLeave() {
          Tutorial.clearForcedHighlights();
        },
      },
      {
        target: "#next-trial-btn",
        position: "top",
        padding: 10,
        text: `When you're ready, press <strong>Next Trial</strong> to continue.
               The Knowledge Table will keep accumulating across trials.`,
        action: "button",
        buttonText: "OK, let's go!",
      },
    ];

    Tutorial.start(tutorialSteps, () => {
      nextBtn.disabled = false;
      tutorialDone = true;
      if (callback) callback();
    });
  }

  function launchBlock(blockIdx, next) {
    const labels = ordLabels[blockIdx];
    Experiment.setElementDisplayLabels(labels);
    saveElementMapping(blockIdx + 1, ordConditions[blockIdx], ordRoleToElem[blockIdx], labels);
    Experiment.setBlock(ordMachines[blockIdx]);
    TrialRunner.onAllDone = () => {
      console.log(`Block ${blockIdx + 1} done. Responses so far:`, TrialRunner.responses.length);
      next();
    };
    TrialRunner.load(ordBlocks[blockIdx], { keepResponses: true });
  }

  function runBlock1() {
    TrialRunner.onTrialStart = null;
    launchBlock(0, startBlock2);
  }

  function startBlock2() {
    if (skipTransitions) {
      launchBlock(1, startBlock3);
    } else {
      Introduction.start(
        blockTransitionPages(2, ordMachines[1], blockElemIds(ordBlocks[1]), ordLabels[1]),
        () => launchBlock(1, startBlock3),
        { finalButton: "Begin Block 2" }
      );
    }
  }

  function startBlock3() {
    const next = ordBlocks[3] ? startBlock4 : endExperiment;
    if (skipTransitions) {
      launchBlock(2, next);
    } else {
      Introduction.start(
        blockTransitionPages(3, ordMachines[2], blockElemIds(ordBlocks[2]), ordLabels[2]),
        () => launchBlock(2, next),
        { finalButton: "Begin Block 3" }
      );
    }
  }

  function startBlock4() {
    if (skipTransitions) {
      launchBlock(3, endExperiment);
    } else {
      Introduction.start(
        blockTransitionPages(4, ordMachines[3], blockElemIds(ordBlocks[3]), ordLabels[3]),
        () => launchBlock(3, endExperiment),
        { finalButton: "Begin Block 4" }
      );
    }
  }

  const PROLIFIC_COMPLETION_URL = "https://app.prolific.com/submissions/complete?cc=C1B7K9L2";

  function endExperiment() {
    console.log("Experiment complete. Responses:", TrialRunner.responses.length);
    completeSession(false);
    const { correct, total } = PredictionScore.getStats();
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    Introduction.showEndScreen(
      `<h2>Thank You!</h2>
       <p>You have completed the experiment. Your responses have been recorded.</p>
       ${total > 0
         ? `<p>You got <strong>${correct} out of ${total}</strong> predictions correct (${pct}%).</p>`
         : ""}
       <p>We greatly appreciate your time and effort.</p>
       <p>You will be redirected to Prolific in a few seconds. If you are not redirected automatically,
          <a href="${PROLIFIC_COMPLETION_URL}">click here</a>.</p>`
    );
    setTimeout(() => { window.location.href = PROLIFIC_COMPLETION_URL; }, 4000);
  }

  const { scalePreview, binaryPreview } = PageHelpers;
  const numBlocks = resolved.machineNamesPerBlock.length;

  const taskStructurePage = [
    `<h2>Now the Real Experiment</h2>
     <p>Good work — you've just seen how everything works. Here's what to expect
     in the actual experiment:</p>
     <p>The experiment has <strong>${numBlocks} blocks</strong>. Each block
     introduces a new set of <strong>3 machines</strong> and a fresh collection
     of elements with arbitrary letter labels. The Knowledge Table resets at the
     start of every block.</p>
     <p>Each block contains three types of trials:</p>
     <ul>
       <li><strong>Observation</strong> — watch a machine process an element.
       The result is added to the Knowledge Table automatically.</li>
       <li><strong>Memory Check</strong> — recall a result you already observed.
       Use the two buttons to respond:
       ${binaryPreview}
       You may fail at most <strong>two</strong> memory checks — after that,
       the experiment ends early.</li>
       <li><strong>Prediction</strong> — judge whether a machine will activate
       with an element you haven't seen yet. Use the 4-point scale:
       ${scalePreview}
       The actual outcome is revealed after you respond.</li>
     </ul>
     <p>Your prediction score is tracked in the top-right corner of the screen.
     Good luck, Investigator!</p>`,
  ];

  function startBlock1() {
    if (skipTransitions) {
      runBlock1();
    } else {
      Introduction.start(
        blockTransitionPages(1, ordMachines[0], blockElemIds(ordBlocks[0]), ordLabels[0]),
        runBlock1,
        { finalButton: "Begin Block 1" }
      );
    }
  }

  function afterIntro() {
    if (skipTutorial) {
      Introduction.start(taskStructurePage, startBlock1, { finalButton: "Begin Experiment" });
    } else {
      runTutorialBlock(() => {
        Introduction.start(taskStructurePage, startBlock1, { finalButton: "Begin Experiment" });
      });
    }
  }

  if (skipIntro) {
    afterIntro();
  } else {
    Introduction.start(buildIntroPages(resolved), afterIntro, { finalButton: "Start Practice Trial" });
  }
})();
