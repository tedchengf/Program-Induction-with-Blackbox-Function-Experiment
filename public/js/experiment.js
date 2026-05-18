/**
 * BBFL Experiment Framework
 *
 * Left: 2×2 cells (Accept | Reject per machine); each cell stacks up to N element rows.
 * Right: machine rows + optional element overlays (one per machine slot: 1 | 2 | 3).
 */

/** @type {readonly string[]} */
const ELEMENT_IDS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
];

/** PNG path for elem_A … elem_L */
function elementSrc(id) {
  const key = String(id).toUpperCase();
  return `img/elem_${key}.png`;
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
  }

  function clearCell(row, col) {
    const box = grid[`${row},${col}`];
    const stack = getStack(row, col);
    if (stack) stack.innerHTML = "";
    box?.classList.remove("has-content");
  }

  function clearAll() {
    boxes.forEach((box) => {
      const stack = box.querySelector(".element-cell-stack");
      if (stack) stack.innerHTML = "";
      box.classList.remove("has-content");
    });
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
            label.textContent = eid === "TRUE" ? "energy" : eid;
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
async function saveTrial(payload) {
  try {
    const res = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  } catch (err) {
    console.error("Failed to save trial:", err);
  }
}

/* ════════════════════════════════════════════════════════
   Prolific integration helper
   ════════════════════════════════════════════════════════ */
function getProlificParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    participantId: params.get("PROLIFIC_PID"),
    studyId: params.get("STUDY_ID"),
    sessionId: params.get("SESSION_ID"),
  };
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
  // The knowledge table tracks exactly 2 process machines per block.
  let processMachines = ["m1", "m2"];
  let machineNames = [...processMachines];
  let machineRowMap = {};
  const cellHistory = {};
  let canvasRowCounter = 0;

  function rebuildRowMap() {
    machineRowMap = {};
    processMachines.forEach((name, i) => { machineRowMap[name] = i; });
  }
  rebuildRowMap();

  const COL_LABELS = ["Accept", "Reject"];

  const MACHINE_GLYPHS = {
    m1: "M1",
    m2: "M2",
    m3: "M3",
    m4: "M4",
    m5: "M5",
    m6: "M6",
  };

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function machineDisplayName(name) {
    const key = String(name).trim().toLowerCase();
    return MACHINE_GLYPHS[key] ?? capitalize(key);
  }

  function isNull(e) {
    return e == null || e === "";
  }

  /** Tokens are canvas-only; they must not appear in the knowledge table. */
  function isTableElement(elemId) {
    if (isNull(elemId)) return false;
    const u = String(elemId).trim().toLowerCase();
    return u !== "true" && u !== "false" && u !== "energy";
  }

  /** PNG path for a machine in a given state, e.g. "img/m4_a.png". */
  function machineSrc(name, state) {
    // Machines are stored as capitalized PNGs (M1_a.png ... M6_r.png)
    if (/^m[1-6]$/i.test(String(name))) {
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
   * Switch the block — sets which 2 process machines are tracked by the left table.
   * Clears both the canvas and the table.
   * @param {[string, string]} pair — e.g. ["m1", "m2"]
   */
  function setBlock(pair) {
    processMachines = [...pair];
    machineNames = [...processMachines];
    rebuildRowMap();
    setMode("two", [pair[0], "res"], { clearGrid: true });
  }

  /** Rich caption: text + inline element images for each non-empty elem. */
  function describeCanvasRowChunkSegments(machines, states, elems, start, end) {
    const parts = [];
    for (let i = start; i < end; i++) {
      if (i > start) parts.push({ type: "text", text: "; " });
      const st = states[i];
      const verb = st === "a" ? "accepts" : st === "r" ? "rejects" : "idle";
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
    cellHistory[key].push({ id: normElemId, label: label ?? normElemId });
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

  let trialOnsetTime = 0;
  let firstScaleTime = null;
  let scaleChangeLog = [];

  /** @type {((trial: object, index: number) => void) | null} */
  let onTrialStart = null;
  /** @type {(() => void) | null} */
  let onAllDone = null;

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
    binaryBtns.forEach((b) => b.classList.remove("selected"));
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
    // Only two states exist now (accept/reject). For question phase we show the
    // machine in its accept art, greyed out via CSS, until the outcome is revealed.
    MachineCanvas.setLayer("q_machine_0", Experiment.machineSrc(q.machine, "a"), {
      rowIndex: rowIdx,
      slot: 1,
      zIndex: 1,
    });
    MachineCanvas.setLayer("q_res_0", Experiment.machineSrc("res", "a"), {
      rowIndex: rowIdx,
      slot: 3,
      zIndex: 3,
    });

    if (q.elem) {
      MachineCanvas.setMachineElement(rowIdx, 1, elementSrc(q.elem), {
        id: "q_elem_0",
        zIndex: 10,
        elemId: q.elem,
      });
    }

    const rowEl = MachineCanvas.getRowElement(rowIdx);
    if (rowEl) rowEl.classList.add("question-phase");

    const caption =
      q.caption ?? "Will this machine accept this element?";
    MachineCanvas.setRowCaption(rowIdx, caption);

    if (trial._trialType === "attention_check") {
      showBinary();
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
    };

    if (trialType === "attention_check") {
      const correctState = (trial.specs ?? [])[0]?.states?.[0] ?? "a";
      const correct = correctState === "a" ? "accept" : "reject";
      const passed = currentResponse === correct;
      responseEntry.attentionPassed = passed;

      if (!passed) {
        attentionFailCount++;
        responseEntry.attentionFailCount = attentionFailCount;
        responses.push(responseEntry);

        if (attentionFailCount > 1) {
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

    const isLast = currentIndex >= queue.length - 1;
    nextBtn.textContent = isLast ? "Finish" : "Next Trial";
    nextBtn.disabled = false;

    const machineCanvas = document.getElementById("machine-canvas");
    if (machineCanvas) machineCanvas.scrollTop = 0;
  }

  function renderCurrentTrial() {
    const trial = queue[currentIndex];
    if (!trial) return;

    trialOnsetTime = now();

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
      responses.push({
        trialIndex: currentIndex,
        trialType: trial._trialType ?? "observation",
        specs: (trial.specs ?? []).map((s) => ({
          machines: s.machines,
          states: s.states,
          elems: s.elems,
        })),
        nextRT: rt,
      });
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
  };
})();

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
      .querySelectorAll(`.machine-element-layer.${HIGHLIGHT_CANVAS_CLASS}`)
      .forEach((el) => el.classList.remove(HIGHLIGHT_CANVAS_CLASS));
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
        // Also highlight the whole cell container (requested "enter cell").
        const box = el.closest(".element-box");
        if (box) box.classList.add(HIGHLIGHT_BOX_CLASS);
      });
    document.querySelectorAll(`.machine-element-layer[data-elem-id="${id}"]`)
      .forEach((el) => el.classList.add(HIGHLIGHT_CANVAS_CLASS));
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

  function g(name) { return Experiment.machineNames.includes(name) ? name.toUpperCase() : String(name).toUpperCase(); }
  const ENERGY_ELEM_ID = "True"; // img/elem_True.png — the "Energy element"

  function captionAccept(machine, elem) {
    return [
      { type: "machine", text: g(machine) }, t(` accepts `), e(elem),
      t(` and produces an Energy element `), e(ENERGY_ELEM_ID), t(`.`),
    ];
  }
  function captionReject(machine, elem) {
    return [
      { type: "machine", text: g(machine) }, t(` rejects `), e(elem),
      t(`. No Energy element is produced.`),
    ];
  }

  function observation(machine, elem, state, opts = {}) {
    const verb = state === "a" ? "accepts" : "rejects";
    const resState = state === "a" ? "a" : "r";
    const resElem  = state === "a" ? ENERGY_ELEM_ID : null;

    return {
      _trialType: "observation",
      title: opts.title ?? "Observation",
      preamble: opts.preamble ?? `Observe: ${g(machine)} ${verb} an element.`,
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
      preamble: opts.preamble ?? "Will this machine accept this element?",
      question: {
        machine,
        elem,
        caption: [t(`Will `), { type: "machine", text: g(machine) }, t(` accept `), e(elem), t("?")],
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
      type: "question",
      title: opts.title ?? "Memory Check",
      preamble: opts.preamble ?? "You have seen this before. Did this machine accept or reject this element?",
      question: {
        machine,
        elem,
        caption: [t(`Did ${g(machine)} accept or reject `), e(elem), t("?")],
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
  const ENERGY_ELEM_ID = "True";

  function elemImg(id, size = 42) {
    return `<img class="intro-icon" src="img/elem_${id}.png" alt="${id}" style="height:${size}px;width:${size}px;">`;
  }

  function machineSrc(machine, state) {
    if (/^m[1-6]$/i.test(String(machine))) {
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
      <span class="scale-label scale-label--left">Definitely Accept</span>
      <div class="scale-options">
        <label class="scale-option"><span class="scale-pip"></span></label>
        <label class="scale-option"><span class="scale-pip"></span></label>
        <label class="scale-option"><span class="scale-pip"></span></label>
        <label class="scale-option"><span class="scale-pip"></span></label>
      </div>
      <span class="scale-label scale-label--right">Definitely Reject</span>
    </div>
  </div>`;

  const binaryPreview = `<div class="intro-binary-preview">
    <button class="binary-btn binary-btn--accept" type="button" disabled>Accept</button>
    <button class="binary-btn binary-btn--reject" type="button" disabled>Reject</button>
  </div>`;

  const elemIds = ["A","B","C","D","E","F","G","H","I","J","K","L"];
  const elemGallery = elemIds.map(id =>
    `<div class="intro-elem-item">${elemImg(id, 52)}<span>${id}</span></div>`
  ).join("");

  return { ENERGY_ELEM_ID, elemImg, machineSrc, canvasPreview, scalePreview, binaryPreview, elemIds, elemGallery };
})();

/* ═══════════════════════════════════════════════════════════════
   Introduction page content
   ═══════════════════════════════════════════════════════════════ */
const INTRO_PAGES = (() => {
  const { ENERGY_ELEM_ID, elemImg, canvasPreview, scalePreview, binaryPreview, elemGallery } = PageHelpers;
  const EI = (sz) => elemImg(ENERGY_ELEM_ID, sz);

  return [
    `<h2>Welcome, Investigator</h2>
     <p>Your team has recovered a trove of <strong>alien artifacts</strong>
     from a recently discovered site. Among them are <strong>six machines</strong>
     and <strong>twelve elements</strong> — small objects marked with unique symbols.</p>
     <p>Early tests show that when the <em>right</em> element is placed inside a
     machine, it springs to life — heating up and emitting a brilliant
     <span class="intro-highlight hl-orange">orange glow</span>. When activated,
     the machine <strong>produces a brand-new element</strong> the team has
     nicknamed the ${EI(22)} <strong>"Energy" element</strong>, because it can
     be used as an extraordinarily powerful energy source.</p>
     <p>When the wrong element is used, the machine stays
     <span class="intro-highlight hl-blue">cold and inactive</span>
     and produces nothing.</p>
     <p>Your mission: help the team <strong>figure out which elements activate
     each machine</strong> so we can reliably produce Energy elements.</p>`,

    `<h2>The Elements</h2>
     <p>We have catalogued <strong>12 elements</strong> so far.
     Each bears a unique symbol and is labelled A through L:</p>
     <div class="intro-elem-gallery">${elemGallery}</div>
     <div class="intro-callout callout-gray">
       The symbols appear to have no inherent meaning — they are simply
       identifiers. However, we suspect that <strong>some elements may behave
       similarly</strong> when presented to certain machines.
     </div>
     <p>There is one additional element the machines can <em>create</em>:</p>
     <div class="intro-elem-gallery" style="margin-bottom:8px;">
       <div class="intro-elem-item">${EI(52)}<span>Energy</span></div>
     </div>
     <p>The ${EI(20)} <strong>Energy element</strong> is produced by an activated
     machine. It is the valuable resource your team is after — a single Energy
     element can power an entire research outpost.</p>`,

    `<h2>The Machines</h2>
     <p>The six machines are labelled <strong>M1</strong> through <strong>M6</strong>.
     Each machine has two possible reactions when an element is placed inside:</p>
     <ul>
       <li><span class="intro-highlight hl-orange">Accept</span> — the machine
       heats up, becomes activated, and <strong>produces</strong> an
       ${EI(18)} Energy element.</li>
       <li><span class="intro-highlight hl-blue">Reject</span> — the machine stays
       cold and inactive. <strong>No element is produced.</strong></li>
     </ul>
     <p>By default, every machine is in its
     <span class="intro-highlight hl-blue">inactive (reject) state</span>.
     Only the right input element will activate it and cause it to produce
     the Energy element.</p>`,

    `<h2>Accept — Machine Activated</h2>
     <p>When a machine <strong>accepts</strong> an element, it glows orange.
     The output module on the right receives the ${EI(22)}
     <strong>Energy element</strong> that the machine has just produced:</p>
     ${canvasPreview("m1", "a", { elem: "A", token: ENERGY_ELEM_ID })}
     <p style="text-align:center;opacity:0.65;font-size:0.9rem;">
       M1 accepts element A and produces an Energy element.</p>
    `,

    `<h2>Reject — Machine Inactive</h2>
     <p>When a machine <strong>rejects</strong> an element, it stays blue and
     the output module remains empty — <strong>no Energy element is
     produced</strong>:</p>
     ${canvasPreview("m1", "r", { elem: "C" })}
     <p style="text-align:center;opacity:0.65;font-size:0.9rem;">
       M1 rejects element C — no Energy element.</p>`,

    `<h2>The Interface</h2>
     <h3>Right — the Canvas</h3>
     <p>The large area on the right shows the machine currently being tested,
     along with the input element and the output module. A caption beneath
     explains what happened.</p>
     <h3>Left — the Knowledge Table</h3>
     <p>The panel on the left keeps a running record of what you've observed.
     Each block features two machines, so the table has
     <strong>two rows</strong> (one per machine) and <strong>two columns</strong>:</p>
     <ul>
       <li><span class="intro-highlight hl-orange">Accept</span> — elements this
       machine has accepted (and therefore produced an Energy element).</li>
       <li><span class="intro-highlight hl-blue">Reject</span> — elements this
       machine has rejected.</li>
     </ul>
     <p>The table updates automatically and persists throughout the block.
     You can also <strong>hover over any element on the canvas or in the
     caption</strong> to highlight where it appears in the table — we will
     walk you through this on the first trial.</p>`,

    `<h2>Observation Trials</h2>
     <p>In an observation trial you <strong>watch</strong> a machine process an
     element. The result appears on the canvas and is recorded in the knowledge
     table. Press <strong>Next Trial</strong> to advance.</p>
     ${canvasPreview("m2", "a", { elem: "D", token: ENERGY_ELEM_ID })}
     <p style="text-align:center;opacity:0.65;font-size:0.9rem;">
       Example: M2 accepts element D and produces an Energy element.</p>
     ${canvasPreview("m2", "r", { elem: "E" })}
     <p style="text-align:center;opacity:0.65;font-size:0.9rem;">
       Example: M2 rejects element E — no Energy element.</p>`,

    `<h2>Prediction Trials</h2>
     <p>In a prediction trial the machine appears <em>greyed out</em> with an
     element placed on it. You are asked:</p>
     ${canvasPreview("m1", "a", { elem: "F", greyed: true })}
     <div class="intro-callout callout-gray" style="text-align:center;">
       <em>"Will this machine accept this element?"</em>
     </div>
     <p>Use the <strong>5-point scale</strong> to indicate your confidence:</p>
     ${scalePreview}
     <ul>
       <li><span class="intro-highlight hl-orange">Definitely Accept</span> (left)
       — you are very confident the machine will accept and produce Energy.</li>
       <li><span class="intro-highlight hl-blue">Definitely Reject</span> (right)
       — you are very confident the machine will reject.</li>
       <li>The middle point means you are unsure.</li>
     </ul>
     <p>Once you respond, the <strong>Continue</strong> button lights up.
     Press it to reveal the actual outcome.</p>`,

    `<h2>Memory Checks</h2>
     <p>Occasionally you will be asked about a machine–element combination you
     have <strong>already seen</strong>. For these trials two buttons appear
     instead of the scale:</p>
     ${canvasPreview("m1", "a", { elem: "A", greyed: true })}
     ${binaryPreview}
     <p>Click the button matching what you remember. After pressing
     <strong>Continue</strong>, the correct answer is revealed.</p>
     <div class="intro-callout callout-gray">
       Pay attention — answering these correctly is important.
     </div>`,

    `<h2>Experiment Structure</h2>
     <p>The experiment is divided into <strong>three blocks</strong>. In each
     block, you will focus on a different pair of machines:</p>
     <ul>
       <li><strong>Block 1</strong> — M1 &amp; M2</li>
       <li><strong>Block 2</strong> — M3 &amp; M4</li>
       <li><strong>Block 3</strong> — M5 &amp; M6</li>
     </ul>
     <p>At the start of each block, the knowledge table resets for the new pair.
     Each block contains a mix of observations, predictions, and memory
     checks.</p>
     <p>Your advice will guide the team's strategy, so take your time and give
     the best predictions you can.</p>
     <p><strong>Ready?</strong> The first block begins now. We'll start with a
     short guided walkthrough — good luck, Investigator!</p>`,
  ];
})();

/* ═══════════════════════════════════════════════════════════════
   Block transition pages
   ═══════════════════════════════════════════════════════════════ */
function blockTransitionPages(blockNum, pair) {
  const { elemImg, ENERGY_ELEM_ID, canvasPreview } = PageHelpers;
  const m1 = pair[0].toUpperCase();
  const m2 = pair[1].toUpperCase();

  return [
    `<h2>Block ${blockNum}: ${m1} &amp; ${m2}</h2>
     <p>Excellent work so far. The team is now moving on to the next pair of
     machines.</p>
     <p>In this block you will investigate <strong>${m1}</strong> and
     <strong>${m2}</strong>. As before, your goal is to determine which elements
     activate each machine so the team can produce
     ${elemImg(ENERGY_ELEM_ID, 18)} Energy elements efficiently.</p>
     ${canvasPreview(pair[0], "a", { elem: "A", greyed: true })}
     <p>The knowledge table has been reset for these two machines. The same
     trial types apply — observations, predictions, and memory checks.</p>
     <p>Ready? Let's begin Block ${blockNum}.</p>`,
  ];
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

  let steps = [];
  let stepIdx = -1;
  let active = false;
  let cleanup = null;
  let onDone = null;

  function show() {
    spotlight.classList.remove("hidden");
    tooltip.classList.remove("hidden");
  }

  function hide() {
    spotlight.classList.add("hidden");
    tooltip.classList.add("hidden");
    active = false;
    if (cleanup) { cleanup(); cleanup = null; }
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
    if (cleanup) { cleanup(); cleanup = null; }
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

    if (step.onEnter) step.onEnter();

    if (step.action === "mouseover") {
      ttBtn.style.display = "none";
      const evtTarget = step.eventTarget
        ? document.querySelector(step.eventTarget) : target;
      const sel = step.eventSelector ?? "[data-elem-id]";

      const handler = (ev) => {
        const hit = ev.target.closest(sel);
        if (hit) {
          evtTarget.removeEventListener("mouseover", handler, true);
          cleanup = null;
          setTimeout(() => advance(), step.delay ?? 600);
        }
      };
      evtTarget.addEventListener("mouseover", handler, true);
      cleanup = () => evtTarget.removeEventListener("mouseover", handler, true);
    } else {
      ttBtn.style.display = "";
      ttBtn.textContent = step.buttonText ?? "Got it";
    }
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
   DEMO EXPERIMENT — 3 blocks (M1/M2, M3/M4, M5/M6)
   ═══════════════════════════════════════════════════════════════ */
(function runExperiment() {
  const obs = TrialGenerators.observation;
  const pred = TrialGenerators.prediction;
  const attn = TrialGenerators.attentionCheck;

  const block1 = [
    obs("m1", "A", "a", { title: "Observation 1" }),
	obs("m1", "D", "a", { title: "Observation 2" }),
	obs("m1", "B", "r", { title: "Observation 3" }),
	attn("m1", "D", "a", { title: "Attention Check 1" }),
	obs("m1", "E", "a", { title: "Observation 4" }),
	obs("m1", "J", "r", { title: "Observation 5" }),
	
	obs("m2", "D", "a", { title: "Observation 6" }),
	attn("m2", "D", "a", { title: "Attention Check 2" }),
	pred("m2", "A", "a", { title: "Prediction 1" }),
	pred("m2", "E", "a", { title: "Prediction 2" }),
	obs("m2", "C", "r", { title: "Observation 7" }),
	pred("m2", "B", "a", { title: "Prediction 3" }),
  ];

  const block2 = [
    obs("m4", "L", "a", { title: "Observation 1" }),
    obs("m4", "I", "a", { title: "Observation 2" }),
    obs("m4", "K", "r", { title: "Observation 3" }),
    obs("m4", "D", "r", { title: "Observation 4" }),
	attn("m4", "K", "r", { title: "Attention Check 1" }),
	obs("m4", "F", "a", { title: "Observation 5" }),
	obs("m4", "G", "r", { title: "Observation 6" }),
	
	obs("m3", "G", "a", { title: "Observation 7" }),
	obs("m3", "A", "r", { title: "Observation 8" }),
	attn("m3", "G", "a", { title: "Attention Check 2" }),
	pred("m3", "K", "a", { title: "Prediction 1" }),
	pred("m3", "D", "a", { title: "Prediction 2" }),
	obs("m3", "E", "r", { title: "Observation 9" }),
	
	obs("m3", "H", "a", { title: "Observation 10" }),
	attn("m4", "D", "r", { title: "Attention Check 3" }),
	pred("m4", "H", "r", { title: "Prediction 3" }),
  ];

  const block3 = [
    obs("m5", "G", "a", { title: "Observation 1" }),
	obs("m5", "C", "a", { title: "Observation 2" }),
	obs("m5", "K", "r", { title: "Observation 3" }),
	obs("m5", "I", "r", { title: "Observation 4" }),
	attn("m5", "K", "r", { title: "Attention Check 1" }),

	obs("m6", "C", "a", { title: "Observation 5" }),
	obs("m6", "K", "a", { title: "Observation 6" }),
	attn("m6", "C", "a", { title: "Attention Check 2" }),
	pred("m6", "G", "a", { title: "Prediction 1" }),
	pred("m6", "I", "a", { title: "Prediction 2" }),
	obs("m6", "B", "r", { title: "Observation 7" }),
	obs("m6", "F", "r", { title: "Observation 8" }),

	obs("m6", "H", "a", { title: "Observation 9" }),
	attn("m5", "K", "r", { title: "Attention Check 3" }),
	pred("m5", "H", "r", { title: "Prediction 4" }),
  ];

  let tutorialDone = false;

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
               <img class="intro-icon" src="img/elem_True.png"
               style="height:20px;width:20px;"> <strong>Energy element</strong>!`,
        action: "button",
      },
      {
        target: elemTarget,
        position: "left",
        padding: 20,
        text: `Now <strong>hover your cursor over the element</strong> on the
               machine to see how the Knowledge Table on the left responds.`,
        action: "mouseover",
        eventTarget: "#machine-canvas",
        eventSelector: ".machine-element-layer[data-elem-id]",
        delay: 400,
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

  function runBlock(pair, trials, next) {
    Experiment.setBlock(pair);
    TrialRunner.onAllDone = () => {
      console.log(`Block done (${pair}). Responses so far:`, TrialRunner.responses.length);
      next();
    };
    TrialRunner.load(trials, { keepResponses: true });
  }

  function runBlock1() {
    Experiment.setBlock(["m1", "m2"]);
    TrialRunner.onAllDone = () => {
      console.log("Block 1 done. Responses:", TrialRunner.responses.length);
      startBlock2();
    };

    TrialRunner.onTrialStart = (trial, index) => {
      if (index === 0 && !tutorialDone) {
        setTimeout(() => firstTrialTutorial(), 350);
      }
    };

    TrialRunner.load(block1, { keepResponses: true });
  }

  function startBlock2() {
    Introduction.start(blockTransitionPages(2, ["m3", "m4"]), () => {
      runBlock(["m3", "m4"], block2, startBlock3);
    }, { finalButton: "Begin Block 2" });
  }

  function startBlock3() {
    Introduction.start(blockTransitionPages(3, ["m5", "m6"]), () => {
      runBlock(["m5", "m6"], block3, endExperiment);
    }, { finalButton: "Begin Block 3" });
  }

  function endExperiment() {
    console.log("Experiment complete.");
    console.log("Response log:", JSON.stringify(TrialRunner.responses, null, 2));
    Introduction.showEndScreen();
  }

  Introduction.start(INTRO_PAGES, runBlock1);
})();
