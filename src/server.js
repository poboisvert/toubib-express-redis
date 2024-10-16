const config = require("better-config");
const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const routes = require("./routes");
const logger = require("./utils/logger");
const port = config.get("application.port");
const helmet = require("helmet");
const { Server } = require("ws"); // Importing the 'ws' package
const { createServer } = require("http"); // you can use https as well

const pgClient = require("./utils/db"); // Import PostgreSQL client

// Load the configuration
config.set(`../${process.env.CRASH_COURSE_CONFIG_FILE || "config.json"}`);

const app = express();
const server = createServer(app);

app.use(helmet());
app.use(morgan("combined", { stream: logger.stream }));
app.use(cors());
app.use("/api", routes);

app.get("/", (_, res) => {
  res.json({});
});

// Create a WebSocket server
const wss = new Server({ noServer: true });

// Handle WebSocket connection
wss.on("connection", (ws) => {
  console.log("Client connected");

  // Send the latest items to the client when they connect
  broadcastLatestItems(ws);

  // Handle incoming messages from the client
  ws.on("message", (message) => {
    console.log(`Received: ${message}`);
    // Handle messages from the client here
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});

// Function to broadcast latest items to all connected clients
async function broadcastLatestItems() {
  try {
    const result = await pgClient.query(
      "SELECT * FROM items ORDER BY numvotes DESC LIMIT 100"
    );
    const latestItems = JSON.stringify(result.rows);
    wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(latestItems);
      }
    });
  } catch (error) {
    logger.error("Failed to fetch items from SQL", error);
  }
}

setInterval(broadcastLatestItems, 2000); // Send updates every 2 seconds

// Upgrade HTTP server to handle WebSocket requests
server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

// Start the server
server.listen(port, () => {
  logger.info(`Application listening on port ${port}.`);
});

// Check for required environment variables.
if (process.env.WEATHER_API_KEY === undefined) {
  console.warn("Warning: Environment variable WEATHER_API_KEY is not set!");
}
