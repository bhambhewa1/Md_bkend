require('dotenv').config();

module.exports = {
  client: 'mssql',
  connection: {
    server: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    options: {
      encrypt: true,
    },
  }}
