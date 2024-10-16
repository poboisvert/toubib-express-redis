const config = require("better-config");
const express = require("express");
const { body } = require("express-validator");
const morgan = require("morgan");
const cors = require("cors");
const logger = require("./utils/logger");
const apiErrorReporter = require("./utils/apierrorreporter");

const useAuth = process.argv[2] === "auth";
const pgClient = require("./utils/db"); // Import PostgreSQL client

config.set(`../${process.env.CRASH_COURSE_CONFIG_FILE || "config.json"}`);

const redis = require("./utils/redisclient");
const session = require("express-session");
const RedisStore = require("connect-redis").default;

const redisClient = redis.getClient();
const pubsubClient = redis.getClient(); // Separate Redis client for Pub/Sub

const app = express();
app.use(morgan("combined", { stream: logger.stream }));
app.use(cors());
app.use(express.json());

// Initialize store.
let redisStore = new RedisStore({
  client: redisClient,
  prefix: redis.getKeyName(`${config.session.keyPrefix}:`),
});

if (useAuth) {
  logger.info("Authentication enabled, checkins require a valid user session.");
  app.use(
    session({
      secret: config.session.secret,
      store: redisStore,
      name: config.session.appName,
      resave: false,
      saveUninitialized: true,
    })
  );
} else {
  logger.info(
    "Authentication disabled, checkins do not require a valid user session."
  );
}

const votesStreamKey = redis.getKeyName("votes");
const maxStreamLength = config.get("checkinReceiver.maxStreamLength");

app.post(
  "/api/checkin",
  (req, res, next) => {
    if (useAuth && !req.session.user) {
      logger.debug("Rejecting checkin - no valid user session found.");
      return res.status(401).send("Authentication required.");
    }

    return next();
  },
  [
    body().isObject(),
    body("userId").isInt({ min: 1 }),
    body("itemId").isInt({ min: 1 }),
    body("starRating").isInt({ min: 0, max: 5 }),
    apiErrorReporter,
  ],
  async (req, res) => {
    const vote = req.body;
    const pipeline = redisClient.pipeline();

    pipeline.xadd(
      votesStreamKey,
      "MAXLEN",
      "~",
      maxStreamLength,
      "*",
      ...Object.entries(vote).flat(),
      (err, result) => {
        if (err) {
          logger.error("Error adding checkin to stream:");
          logger.error(err);
        } else {
          logger.debug(`Received checkin, added to stream as ${result}`);
          incomingId = result;
        }
      }
    );

    await pipeline.exec();

    // Wait for the notification from checkinprocessor.js and fetch the updated data
    try {
      const items = await waitForCheckinCompletion();
      return res.status(200).json(items);
    } catch (error) {
      logger.error("Error fetching new data:", error);
      return res.status(500).send("Internal Server Error");
    }
  }
);

// Pub/Sub based function to fetch new data when notified by checkinprocessor.js
async function waitForCheckinCompletion() {
  return new Promise((resolve, reject) => {
    const pubChannel = redis.getKeyName("checkin-complete");

    // Subscribe to the Redis channel
    pubsubClient.subscribe(pubChannel);

    // Listen for published messages
    pubsubClient.on("message", async (channel, message) => {
      console.log("message", message);
      console.log("channel", channel);
      console.log("pubChannel", pubChannel);
      if (message === result) {
        try {
          // Fetch data from PostgreSQL when notification is received
          const result = await pgClient.query(
            "SELECT * FROM items ORDER BY numvotes DESC LIMIT 100"
          );
          resolve(result.rows);
        } catch (error) {
          reject(error);
        } finally {
          // Unsubscribe after receiving the message to prevent multiple triggers
          pubsubClient.unsubscribe(pubChannel);
        }
      }
    });

    // Handle errors in Redis Pub/Sub
    pubsubClient.on("error", (err) => {
      reject(err);
    });
  });
}

const port = config.get("checkinReceiver.port");
app.listen(port, () => {
  logger.info(`Checkin receiver listening on port ${port}.`);
});
