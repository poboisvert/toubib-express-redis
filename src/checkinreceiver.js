const config = require("better-config");
const express = require("express");
const { body } = require("express-validator");
const morgan = require("morgan");
const cors = require("cors");
const logger = require("./utils/logger");
const apiErrorReporter = require("./utils/apierrorreporter");

const useAuth = process.argv[2] === "auth";

config.set(`../${process.env.CRASH_COURSE_CONFIG_FILE || "config.json"}`);

const redis = require("./utils/redisclient");
const session = require("express-session");
const RedisStore = require("connect-redis").default;

const redisClient = redis.getClient();

const app = express();
app.use(morgan("combined", { stream: logger.stream }));
app.use(cors());
app.use(express.json());

// Initialize store.
let redisStore = new RedisStore({
  client: redis.getClient(),
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
    const bloomFilterKey = redis.getKeyName("checkinfilter");
    const voteStr = `${vote.userId}:${vote.itemId}:${vote.starRating}`;

    const pipeline = redisClient.pipeline();

    pipeline.call("BF.ADD", bloomFilterKey, voteStr);
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
        }
      }
    );
    pipeline.exec();

    // Accepted, as we'll do later processing on it...
    return res.status(202).end();
  }
);

const port = config.get("checkinReceiver.port");
app.listen(port, () => {
  logger.info(`Checkin receiver listening on port ${port}.`);
});
