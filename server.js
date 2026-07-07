require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const { randomUUID } = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Cyclic Latin square — 4 sequences over 4 block indices [PP=0, PN=1, NP=2, NN=3]
const SEQUENCES = [
  [0, 1, 2, 3],
  [1, 2, 3, 0],
  [2, 3, 0, 1],
  [3, 0, 1, 2],
];

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sequences (
      sequence_id   INTEGER PRIMARY KEY,
      block_order   TEXT    NOT NULL,
      completed     INTEGER DEFAULT 0
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS subjects (
      pid                   TEXT PRIMARY KEY,
      prolific_id           TEXT,
      study_id              TEXT,
      session_id            TEXT,
      sequence_id           INTEGER,
      block_order           TEXT,
      state                 TEXT    DEFAULT 'started',
      started_at            TIMESTAMPTZ DEFAULT NOW(),
      completed_at          TIMESTAMPTZ,
      total_time_ms         INTEGER,
      attn_fail_count       INTEGER DEFAULT 0,
      pred_correct          INTEGER DEFAULT 0,
      pred_total            INTEGER DEFAULT 0,
      critical_pred_correct INTEGER DEFAULT 0,
      critical_pred_total   INTEGER DEFAULT 0
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS trials (
      id               SERIAL PRIMARY KEY,
      pid              TEXT,
      block_num        INTEGER,
      block_condition  TEXT,
      trial_num        INTEGER,
      trial_type       TEXT,
      machine_slot     TEXT,
      element_role     TEXT,
      element_id       TEXT,
      display_label    TEXT,
      correct_answer   TEXT,
      response_raw     TEXT,
      response_coded   INTEGER,
      correct          BOOLEAN,
      critical         BOOLEAN DEFAULT FALSE,
      rt_ms            INTEGER,
      first_response_ms INTEGER
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS element_mappings (
      pid             TEXT,
      block_num       INTEGER,
      block_condition TEXT,
      element_role    TEXT,
      element_id      TEXT,
      display_label   TEXT,
      major_class     TEXT,
      minor_variant   INTEGER,
      PRIMARY KEY (pid, block_num, element_role)
    );
  `);

  // Seed sequences table on first run
  const { rows } = await pool.query('SELECT COUNT(*) AS n FROM sequences');
  if (parseInt(rows[0].n, 10) === 0) {
    for (let i = 0; i < SEQUENCES.length; i++) {
      await pool.query(
        'INSERT INTO sequences (sequence_id, block_order) VALUES ($1, $2)',
        [i, SEQUENCES[i].join(',')]
      );
    }
    console.log('*** Sequences seeded');
  }
}

/* ─── Routes ─────────────────────────────────────────────────────────────── */

// Called at the very start of an experiment session
app.post('/api/start', async (req, res) => {
  try {
    const { prolific } = req.body;

    // Pick sequence with the fewest completions (ties broken randomly)
    const { rows } = await pool.query(
      'SELECT sequence_id, block_order, completed FROM sequences ORDER BY completed ASC'
    );
    const minCompleted = rows[0].completed;
    const candidates   = rows.filter(r => r.completed === minCompleted);
    const chosen       = candidates[Math.floor(Math.random() * candidates.length)];
    const blockOrder   = chosen.block_order.split(',').map(Number);

    const pid = randomUUID();

    await pool.query(
      `INSERT INTO subjects
         (pid, prolific_id, study_id, session_id, sequence_id, block_order, state, started_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'started', NOW())`,
      [
        pid,
        prolific?.PROLIFIC_PID ?? null,
        prolific?.STUDY_ID     ?? null,
        prolific?.SESSION_ID   ?? null,
        chosen.sequence_id,
        chosen.block_order,
      ]
    );

    console.log(`*** pid=${pid} seq=${chosen.sequence_id} order=${chosen.block_order}`);
    res.json({ pid, sequenceId: chosen.sequence_id, blockOrder });
  } catch (err) {
    console.error('*** /api/start error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Called once per trial (all types: observation, attentionCheck, prediction)
app.post('/api/trial', async (req, res) => {
  try {
    const t = req.body;

    await pool.query(
      `INSERT INTO trials
         (pid, block_num, block_condition, trial_num, trial_type, machine_slot,
          element_role, element_id, display_label, correct_answer,
          response_raw, response_coded, correct, critical, rt_ms, first_response_ms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        t.pid, t.blockNum, t.blockCondition, t.trialNum, t.trialType, t.machineSlot,
        t.elementRole, t.elementId, t.displayLabel, t.correctAnswer,
        t.responseRaw, t.responseCoded ?? null, t.correct ?? null,
        t.critical ?? false, t.rtMs ?? null, t.firstResponseMs ?? null,
      ]
    );

    // Update running subject summary counters
    if (t.trialType === 'attentionCheck' && t.correct === false) {
      await pool.query(
        'UPDATE subjects SET attn_fail_count = attn_fail_count + 1 WHERE pid = $1',
        [t.pid]
      );
    } else if (t.trialType === 'prediction') {
      const inc = ['pred_total = pred_total + 1'];
      if (t.correct)   inc.push('pred_correct = pred_correct + 1');
      if (t.critical) {
        inc.push('critical_pred_total = critical_pred_total + 1');
        if (t.correct) inc.push('critical_pred_correct = critical_pred_correct + 1');
      }
      await pool.query(
        `UPDATE subjects SET ${inc.join(', ')} WHERE pid = $1`,
        [t.pid]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('*** /api/trial error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Called once per block start — records the full role→element→label mapping
app.post('/api/element-mapping', async (req, res) => {
  try {
    const { pid, blockNum, blockCondition, mappings } = req.body;
    for (const m of mappings) {
      await pool.query(
        `INSERT INTO element_mappings
           (pid, block_num, block_condition, element_role, element_id, display_label, major_class, minor_variant)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (pid, block_num, element_role) DO NOTHING`,
        [pid, blockNum, blockCondition, m.role, m.elementId, m.displayLabel, m.majorClass, m.minorVariant]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('*** /api/element-mapping error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Called when the experiment ends (normally or via attention-fail termination)
app.post('/api/complete', async (req, res) => {
  try {
    const { pid, totalTimeMs, terminated } = req.body;
    const state = terminated ? 'terminated' : 'completed';

    await pool.query(
      `UPDATE subjects SET state = $1, completed_at = NOW(), total_time_ms = $2 WHERE pid = $3`,
      [state, totalTimeMs ?? null, pid]
    );

    if (!terminated) {
      const { rows } = await pool.query(
        'SELECT sequence_id FROM subjects WHERE pid = $1',
        [pid]
      );
      if (rows.length > 0) {
        await pool.query(
          'UPDATE sequences SET completed = completed + 1 WHERE sequence_id = $1',
          [rows[0].sequence_id]
        );
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('*** /api/complete error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ─── Debug endpoints ─────────────────────────────────────────────────────── */

app.get('/api/debug/sequences', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM sequences ORDER BY sequence_id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/debug/subjects', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM subjects ORDER BY started_at DESC LIMIT 20'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/debug/trials/:pid', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM trials WHERE pid = $1 ORDER BY block_num, trial_num',
      [req.params.pid]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─── Start ───────────────────────────────────────────────────────────────── */

app.listen(PORT, async () => {
  console.log(`*** Listening on port ${PORT}`);
  try {
    await initDB();
    console.log('*** Database ready');
  } catch (err) {
    console.error('*** Database init error:', err);
  }
});
