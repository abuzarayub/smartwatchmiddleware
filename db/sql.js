const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT),
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(async pool => {
    console.log('✅ Connected to Azure SQL');

    try {
      // Fetch all users from dbo.Users
      const result = await pool.request().query('SELECT * FROM STG.Users');
      console.log('📋 Users table:', result.recordset);
    } catch (err) {
      console.error('❌ Error fetching Users table:', err);
    }

    return pool;
  })
  .catch(err => console.error('❌ SQL connection error:', err));

module.exports = {
  sql,
  poolPromise
};
