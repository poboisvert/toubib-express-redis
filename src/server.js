const config = require("better-config");
const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const routes = require("./routes");
const logger = require("./utils/logger");
const port = config.get("application.port");

const { createServer } = require("http"); // you can use https as well

config.set(`../${process.env.CRASH_COURSE_CONFIG_FILE || "config.json"}`);

const app = express();
const server = createServer(app);

app.use(morgan("combined", { stream: logger.stream }));
app.use(cors());
app.use("/api", routes);
app.get("/", (_, res) => {
  res.json({});
});

// Start the server
server.listen(port, () => {
  logger.info(`Application listening on port ${port}.`);
});

// Check for required environment variables.
if (process.env.WEATHER_API_KEY === undefined) {
  console.warn("Warning: Environment variable WEATHER_API_KEY is not set!");
}
