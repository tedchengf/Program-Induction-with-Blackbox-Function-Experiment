const { comma_separated_array, string_separated_array } = require('./strutils.js')

async function create_table(pool, table_spec) {
  var col_names = Object.keys(table_spec.col_types)
  var col_specs = col_names.map((nm) => nm + " " + table_spec.col_types[nm])
  col_specs = comma_separated_array(col_specs)
  var query = "CREATE TABLE " + table_spec.name + " (" + col_specs + ");"
  await pool.query(query)
  console.log ('*** Table ' + table_spec.name + ' created')
}

async function test_and_create_table(pool, table_spec) {
  console.log ('*** Testing table ' + table_spec.name + '.')
  if (!await table_exists(pool, table_spec.name)) {
    await create_table(pool, table_spec)
    console.log ('*** Table ' + table_spec.name + ' successfully created')
  }
}

async function insert_table(pool, table_spec, vals) {
  vals = comma_separated_array (vals)
  var query = "INSERT INTO " + table_spec.name + " VALUES(" + vals + ");"
  await pool.query(query)
  console.log ('*** Table ' + table_spec.name + ' insert successful')
}

async function table_exists(pool, table_name) {
  const query = "SELECT EXISTS (SELECT 1 FROM information_schema.tables " +
    "WHERE table_schema = 'public' AND table_name = $1);"
  var result = await pool.query(query, [table_name])
  var exists = result.rows[0].exists
  console.log ('*** State of ' + table_name + '\'s existence: ' + exists)
  return (exists)
}

async function table_empty(pool, table_spec) {
  var query = "SELECT EXISTS (SELECT 1 FROM " + table_spec.name + ");"
  var result = await pool.query(query)
  return (!result.rows[0].exists)
}

async function update_table(pool, table_spec, update_clause, where_clauses) {
  query = 
    "UPDATE " + table_spec.name + " SET " + update_clause + 
    " WHERE " + string_separated_array (where_clauses, " AND ") + ";"
  console.log (query)
  await pool.query(query)
  console.log ('*** Table ' + table_spec.name + ' updated')
}

async function delete_table(pool, table_name) {
  if (await table_exists(pool, table_name)) {
    console.log ('*** Deleting table ' + table_name)
    query = "DROP TABLE " + table_name + ";"
    await pool.query(query)
    console.log ('*** Table ' + table_name + ' deleted')
  }
}

async function test_and_create_database(pool, database) {
  console.log('*** Starting database initialization check')
  for (let ti=0; ti < database.length; ti++) {
    console.log(`*** Checking table ${database[ti].name}`)
    await test_and_create_table(pool, database[ti])
  }
  console.log('*** Database initialization check complete')
}

async function delete_database(pool, database) {
  for (let ti=0; ti < database.length; ti++) {
    await delete_table(pool, database[ti].name)
  }
}

module.exports = {
   create_table, test_and_create_table, insert_table, table_empty, 
   table_exists, delete_table, update_table, 
   test_and_create_database, delete_database
}