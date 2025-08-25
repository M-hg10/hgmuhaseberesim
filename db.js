const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || '213.142.148.67',
  port: process.env.DB_PORT || '5432',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Rtq6In4ZxA2U7aj5GCz7dg3spwY4smraqMcB4ZlXH4t72zz2E9zXxyO6cVoTu0mb',
  database: process.env.DB_NAME || 'hcasoft' ,
});

module.exports = pool;