const pgClient = require("./db"); // Import PostgreSQL client

const config = require("better-config");
const fs = require("fs");

config.set(`../../config.json`);

const usage = () => {
  console.error(
    "Usage: npm run load users|items|details|votes|indexes|bloom|all"
  );
  process.exit(0);
};

const createTableIfNotExists = async (tableName, columns) => {
  const columnDefinitions = columns
    .map((col) => `${col.name} ${col.type}`)
    .join(", ");
  const query = `CREATE TABLE IF NOT EXISTS ${tableName} (${columnDefinitions});`;

  try {
    await pgClient.query(query);
    console.log(`Table ${tableName} created or already exists.`);
  } catch (error) {
    console.error(`Error creating table ${tableName}: ${error}`);
  }
};

const loadDataFromFile = async (filePath, tableName) => {
  console.log(`Loading data into ${tableName}...`);
  let data;

  try {
    data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.error(`Error reading or parsing file ${filePath}: ${error}`);
    return; // Exit the function if there's an error
  }

  const insertPromises = data[tableName].map((item) => {
    const query = `INSERT INTO ${tableName}(${Object.keys(item).join(
      ","
    )}) VALUES(${Object.values(item)
      .map((_, i) => `$${i + 1}`)
      .join(",")})`;
    return pgClient.query(query, Object.values(item));
  });

  try {
    await Promise.all(insertPromises); // Insert all data in parallel
    console.log(`${tableName} data loaded successfully.`);
  } catch (error) {
    console.error(`Error loading ${tableName} data: ${error}`);
  }
};

const runDataLoader = async (params) => {
  if (params.length !== 4) {
    usage();
  }

  const command = params[3];

  switch (command) {
    case "all":
      await createTableIfNotExists("items", [
        { name: "id", type: "SERIAL PRIMARY KEY" },
        { name: "name", type: "VARCHAR(255)" },
        { name: "category", type: "VARCHAR(255)" }, // Added category column
        { name: "location", type: "VARCHAR(255)" }, // Added location column
        { name: "numVotes", type: "INTEGER" }, // Added numVotes column
        { name: "averageStars", type: "FLOAT" }, // Added averageStars column
        { name: "numStars", type: "INTEGER" }, // Added numStars column
        { name: "lastUpdated", type: "TIMESTAMP" }, // Added lastUpdated column
      ]);
      await loadDataFromFile("./data/items.json", "items"); // Updated path to the correct location

      await createTableIfNotExists("details", [
        { name: "id", type: "SERIAL PRIMARY KEY" },
        { name: "description", type: "TEXT" }, // Added description column
        { name: "website", type: "TEXT" }, // Added description column
        { name: "phone", type: "TEXT" }, // Added description column
      ]);
      await loadDataFromFile("./data/details.json", "details"); // Load details data
      await createTableIfNotExists("users", [
        { name: "id", type: "SERIAL PRIMARY KEY" },
        { name: "firstName", type: "VARCHAR(255)" },
        { name: "lastName", type: "VARCHAR(255)" },
        { name: "email", type: "VARCHAR(255)" },
        { name: "password", type: "VARCHAR(255)" },
        { name: "numVotes", type: "INTEGER" },
        { name: "lastCheckin", type: "TIMESTAMP" },
        { name: "lastSeenAt", type: "TIMESTAMP" },
      ]);
      await loadDataFromFile("./data/users.json", "users"); // Load users data
      await createTableIfNotExists("votes", [
        { name: "id", type: "VARCHAR(255) PRIMARY KEY" }, // Assuming id is a string
        {
          name: "userId",
          type: "INTEGER REFERENCES users(id)",
          onDelete: "CASCADE",
        }, // Foreign key to users table
        {
          name: "itemId",
          type: "INTEGER REFERENCES items(id)",
          onDelete: "CASCADE",
        }, // Foreign key to items table
        { name: "starRating", type: "INTEGER" }, // Added starRating column
      ]);
      await loadDataFromFile("./data/votes.json", "votes"); // Load votes data
      break;
    default:
      usage();
  }

  await pgClient.end(); // Close PostgreSQL connection
};

runDataLoader(process.argv);
