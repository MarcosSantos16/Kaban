const mysql = require('mysql2/promise');

let connection;

async function conectar() {
  if (connection) return connection;

  connection = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'kanban',
    timezone: '-03:00',
  });

  console.log('✅ MySQL conectado!');
  return connection;
}

module.exports = { conectar };