require('dotenv').config();
const { Pool } = require('pg')
const {
  string_separated_array, comma_separated_array, quote, val_w_default
} = require('./strutils.js')
const {
   create_table, test_and_create_table, insert_table, table_empty, 
   table_exists, delete_table, update_table, 
   test_and_create_database, delete_database
} = require('./database.js')

const good_code = 200
const internal_error = 500

// Define database tables.
const cells_table = {
  name: 'cells',
  col_types: {cell: 'VARCHAR UNIQUE', allocated: 'INTEGER', completed: 'INTEGER', max_subjects: 'INTEGER'}   
}
    
const subjects_table = {
  name: 'subjects',
  col_types: {pid: 'VARCHAR UNIQUE', cell: 'VARCHAR', state: 'VARCHAR', notes_usage: 'VARCHAR', rule_summary: 'TEXT'}   
}
    
const events_table = {
  name: 'events',
  col_types: {pid: 'VARCHAR', event: 'VARCHAR', time: 'VARCHAR'}   
}
    
const prediction_trials_table = {
  name: 'prediction_trials',
  col_types: {
    pid: 'VARCHAR', trial_no: 'INTEGER', type: 'VARCHAR', stim: 'VARCHAR', 
    response: 'BOOLEAN', truth: 'BOOLEAN', rt: 'INTEGER', jspsych: 'VARCHAR'
  }
}    

const outcome_trials_table = {
  name: 'outcome_trials',
  col_types: {
    pid: 'VARCHAR', trial_no: 'INTEGER', type: 'VARCHAR', stim: 'VARCHAR', 
    rt: 'INTEGER', history_accessed: 'BOOLEAN', jspsych: 'VARCHAR'
  }
}    

const prolific_table = {
  name: 'prolific',
  col_types: {
    pid: 'VARCHAR UNIQUE', prolific_id: 'VARCHAR UNIQUE', study_id: 'VARCHAR', session_id: 'VARCHAR'
  }   
}
    
const database = [cells_table, subjects_table, events_table, prediction_trials_table, outcome_trials_table, prolific_table]
    
async function update_cell_table(cell_json, update_clause) {
  where_clause = "cell = " + quote (cell_json)
  await update_table(pool, cells_table, update_clause, [where_clause])
}

async function test_and_initialize_database(design) {
  await test_and_create_database(pool, database)
 
  // Copy (json strings of) cells into cells table
  if (await table_empty(pool, cells_table)) {
    // Initialize table with cells.
    for (let i=0; i < design.length; i++) {
      const cell_config = design[i];
      const max_subjects = cell_config.max_subjects;
      insert_vals = [quote(JSON.stringify(cell_config)), 0, 0, max_subjects]
      insert_table(pool, cells_table, insert_vals)
    }
    console.log ('*** Table ' + cells_table.name + ' initialized')
  }
}

async function get_cell(req) {
  // If database doesn't already exist, create it.
  await test_and_initialize_database(req.body.design)
  
  const p_info = req.body.p_info

  // Allocate cell to subject.
  // First identify available cells (those that haven't reached their maximum)
  query = 'SELECT * FROM ' + cells_table.name + ' WHERE completed < max_subjects;'
  var result = await pool.query(query)
  
  if (result.rows.length === 0) {
    throw new Error('All cells have reached their maximum capacity');
  }
  
  // Find the minimum completed count among available cells
  const min_completed = Math.min(...result.rows.map(row => row.completed));
  const available_cells = result.rows.filter(row => row.completed === min_completed);
  
  // Randomly pick one of the least completed available cells
  idx = Math.floor(Math.random() * available_cells.length)
  var cell_json = available_cells[idx].cell

  // Update cell's allocation count.
  await update_cell_table(cell_json, "allocated = allocated + 1")
  console.log ("*** Cell " + cell_json + " allocated to " + p_info.pid + " (completed: " + available_cells[idx].completed + "/" + available_cells[idx].max_subjects + ")")
  
  // Add new subject to subjects table.
   insert_vals = [p_info.pid, cell_json, 'started', null]
  await insert_table(pool, subjects_table, insert_vals.map(quote))
  console.log("*** Subject " + p_info.pid + " added to " + subjects_table.name + " table")    

  // Add start event to events table.
  insert_vals = [p_info.pid, 'started', new Date().toUTCString()]
  await insert_table(pool, events_table, insert_vals.map(quote))
  console.log("*** Start event for subject " + p_info.pid + " added to " + events_table.name + " table")    

  // Add new subject to Prolific table with if necessary. 
  if (p_info.prolific) {
    insert_vals = [p_info.pid]
    prolific_vals = Object.values(p_info.prolific_info) 
    insert_vals = insert_vals.concat(prolific_vals)
    await insert_table(pool, prolific_table, insert_vals.map(quote))
    console.log("*** Subject " + p_info.pid + " added to " + prolific_table.name + " table")
  }

  return(cell_json)
}

async function write_exp_data(req) {
  async function write_one_trial (trial_no, trial) {
    if ('stimulus' in trial) {
      trial.stimulus = trial.stimulus.substring(0, 31) + "..."
    } 
    console.log('Trial object:', trial);
    console.log('Trial number from object:', trial.trial_number);
    console.log('history_accessed value:', trial.history_accessed, 'type:', typeof trial.history_accessed);

    // Handle prediction trials
    if (trial.exp_type === 'prediction') {
    insert_vals = [
        pid_s, trial.trial_number,
        quote(val_w_default(trial.exp_type, "")),
        quote(val_w_default(trial.exp_stim, "")),
        val_w_default(trial.response === 'true', false),  // Convert string 'true'/'false' to boolean
        val_w_default(trial.truth, false),  // Get truth from trial data
      val_w_default(trial.rt, 0),
      quote(JSON.stringify(trial))
    ]
      await insert_table(pool, prediction_trials_table, insert_vals)
    }
    // Handle outcome trials
    else if (trial.exp_type === 'outcome') {
      insert_vals = [
        pid_s, trial.trial_number,
        quote(val_w_default(trial.exp_type, "")),
        quote(val_w_default(trial.exp_stim, "")),
        val_w_default(trial.rt, 0),
        val_w_default(trial.history_accessed, false),
        quote(JSON.stringify(trial))
      ]
      await insert_table(pool, outcome_trials_table, insert_vals)
    }
  }

  const p_info = req.body.p_info
  const pid_s = quote(p_info.pid)

  // Update trials table.
  var trials = req.body.trials
  for (let ti = 0; ti < trials.length; ti++) {
    await write_one_trial(ti, trials[ti])  // We still pass ti for logging but don't use it
  }  
  console.log ("*** %d trials written to tables", trials.length)

  // Update subjects table. 
  let update_clause = "state = 'completed'"
  if (p_info.took_notes) {
    update_clause += ", notes_usage = " + quote(p_info.took_notes)
  }
  if (p_info.rule_summary) {
    update_clause += ", rule_summary = " + quote(p_info.rule_summary)
  }
  await update_table(pool, subjects_table, update_clause, ["pid=" + pid_s])
  console.log ("*** Subject " + p_info.pid + " logged as completed in " + subjects_table.name + " table")
  
  // Add completion event to events table.
  insert_vals = [p_info.pid, 'completed', new Date().toUTCString()]
  await insert_table(pool, events_table, insert_vals.map(quote))
  console.log("*** Completion event for subject " + p_info.pid + " added to " + events_table.name + " table")    

  // Update cells.
  const cell_json = JSON.stringify(p_info.cell)
  await update_cell_table(cell_json, "completed = completed + 1")
  console.log ("*** Counts in table " + cells_table.name + " updated")
}

// Main

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

var express = require("express")
var app = express()
app.use(express.json())
app.use(express.static(__dirname + "/public"))
app.engine("html", require("ejs").renderFile)
app.set("view engine", "html")
app.set("views", __dirname + "/views")

app.get("/", function (req, res) {
  console.log('*** Responding to initial client request')
  res.render("ECL_History.html")
})

app.post('/resetdb', async (req, res) => { 
  try {
    await delete_database(pool, database)
    res.status(good_code).send(JSON.stringify({log_message: '### Database reset'}))
  } catch (err) {
    console.error("*** Handling error in resetdb dbtest...")
    console.error(err);
    res.status(internal_error).send(err.message)
  }
})  

app.post('/dbtest', async (req, res) => { 
  try {
    await test_and_initialize_database(req.body.design)
    res.status(good_code).send(JSON.stringify({log_message: '### Database ready'}))
  } catch (err) {
    console.error("*** Handling error in route dbtest...")
    console.error(err);
    res.status(internal_error).send(err.message)
  }
})  

app.post('/getcell', async (req, res) => { 
  try {
    var cell_json = await get_cell (req)
    res.status(good_code).send(cell_json)
  } catch (err) {
    console.error("*** Handling error in route getcell...")
    console.error(err)
    //var err_s = JSON.stringify({msg: err.message, err: err})
    res.status(internal_error).send(err.message)
  }
})  

app.post('/resultssave', async (req, res) => { 
  try {
    // Initialize database if it doesn't exist
    await test_and_initialize_database(req.body.design);
    
    // Now write the data
    await write_exp_data(req);
    res.status(good_code).send(JSON.stringify({log_message: '### Data stored successfully'}));
  } catch (err) {
    console.error("*** Handling error in route resultssave...");
    console.error(err);
    res.status(internal_error).send(err.message);
  }
});

////////////////////////////////////////////

// Debug endpoints for testing interface
app.post('/debug/cells', async (req, res) => { 
  try {
    const query = 'SELECT cell, allocated, completed, max_subjects FROM ' + cells_table.name + ' ORDER BY cell;'
    const result = await pool.query(query)
    
    const formatted_results = result.rows.map(row => ({
      condition: JSON.parse(row.cell).name,
      allocated: row.allocated,
      completed: row.completed,
      max_subjects: row.max_subjects,
      remaining: row.max_subjects - row.completed
    }))
    
    res.status(good_code).send(JSON.stringify(formatted_results, null, 2))
  } catch (err) {
    console.error("*** Error in debug/cells...")
    console.error(err)
    res.status(internal_error).send(err.message)
  }
})

app.post('/debug/subjects', async (req, res) => { 
  try {
    const query = 'SELECT pid, cell, state, notes_usage, rule_summary FROM ' + subjects_table.name + ' ORDER BY pid DESC LIMIT 10;'
    const result = await pool.query(query)
    
    const formatted_results = result.rows.map(row => ({
      pid: row.pid,
      condition: JSON.parse(row.cell).name,
      state: row.state,
      notes_usage: row.notes_usage,
      rule_summary: row.rule_summary ? row.rule_summary.substring(0, 100) + '...' : null  // Truncate for readability
    }))
    
    res.status(good_code).send(JSON.stringify(formatted_results, null, 2))
  } catch (err) {
    console.error("*** Error in debug/subjects...")
    console.error(err)
    res.status(internal_error).send(err.message)
  }
})

app.post('/debug/rule_summaries', async (req, res) => { 
  try {
    const query = 'SELECT pid, cell, rule_summary FROM ' + subjects_table.name + ' WHERE rule_summary IS NOT NULL ORDER BY pid DESC;'
    const result = await pool.query(query)
    
    const formatted_results = result.rows.map(row => ({
      pid: row.pid,
      condition: JSON.parse(row.cell).name,
      rule_summary: row.rule_summary
    }))
    
    res.status(good_code).send(JSON.stringify(formatted_results, null, 2))
  } catch (err) {
    console.error("*** Error in debug/rule_summaries...")
    console.error(err)
    res.status(internal_error).send(err.message)
  }
})

////////////////////////////////////////////

var server = app.listen (process.env.PORT, async function () {
  console.log ("*** Listening to port %d", server.address().port);
  // Initialize database only if it doesn't exist
  try {
    await test_and_create_database(pool, database);
    console.log("*** Database tables checked/initialized");
  } catch (err) {
    console.error("*** Error checking database:", err);
  }
});