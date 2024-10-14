const { Client } = require("pg"); // Import PostgreSQL client

// Connect to PostgreSQL
const pgClient = new Client({
  connectionString:
    process.env.POSTGRES_URI ||
    "postgres://myuser:mypassword@localhost:5432/mydatabase", // Change 'postgres' to 'localhost' to avoid ENOTFOUND error
});

pgClient
  .connect()
  .then(() => console.log("Connected to PostgreSQL"))
  .catch((err) => {
    console.error("Connection error", err.stack);
    process.exit(1); // Exit if connection fails
  });

module.exports = pgClient; // Correctly export pgClient
