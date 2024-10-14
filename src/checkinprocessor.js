const redis = require("./utils/redisclient");
const { Client } = require("pg");

const logger = require("./utils/logger");
const sleep = require("./utils/sleep");

// Connect to PostgreSQL
const pgClient = new Client({
  connectionString:
    process.env.POSTGRES_URI ||
    "postgres://myuser:mypassword@localhost:5432/mydatabase", // Change 'postgres' to 'localhost' to avoid ENOTFOUND error
});

pgClient
  .connect()
  .then(() => logger.info("Connected to PostgreSQL"))
  .catch((err) => {
    logger.error("PostgreSQL connection error", err.stack);
    process.exit(1); // Exit if connection fails
  });

const runCheckinProcessor = async () => {
  const redisClient = redis.getClient();
  const votesStreamKey = redis.getKeyName("votes");
  const checkinProcessorIdKey = redis.getKeyName("checkinprocessor", "lastid");
  const delay = process.argv[3] === "delay";

  let lastIdRead = await redisClient.get(checkinProcessorIdKey);
  if (lastIdRead == null) {
    lastIdRead = 0;
  }

  logger.info(`Reading stream from last ID ${lastIdRead}.`);

  /* eslint-disable no-constant-condition */
  while (true) {
    /* eslint-enable */

    /* eslint-disable no-await-in-loop */
    const response = await redisClient.xread(
      "COUNT",
      "1",
      "BLOCK",
      "5000",
      "STREAMS",
      votesStreamKey,
      lastIdRead
    );
    /* eslint-enable */

    if (response) {
      const checkinData = response[0][1][0];
      const fieldNamesAndValues = checkinData[1];

      const checkin = {
        id: checkinData[0],
        timestamp: checkinData[0].split("-")[0],
      };

      for (let n = 0; n < fieldNamesAndValues.length; n += 2) {
        const k = fieldNamesAndValues[n];
        const v = fieldNamesAndValues[n + 1];
        checkin[k] = v;
      }

      const userId = checkin.userId;
      const itemId = checkin.itemId;
      const starRating = checkin.starRating;

      logger.debug(`Updating user ${userId} and item ${itemId}.`);

      try {
        await pgClient.query("BEGIN");

        const formattedTimestamp = new Date(parseInt(checkin.timestamp))
          .toISOString()
          .slice(0, 23)
          .replace("T", " ");

        await pgClient.query(
          `UPDATE users SET lastCheckin = $1, lastSeenAt = $2, numVotes = numVotes + 1 WHERE id = $3`,
          [formattedTimestamp, formattedTimestamp, userId]
        );

        await pgClient.query(
          `UPDATE items SET numVotes = numVotes + 1, numStars = numStars + $1 WHERE id = $2`,
          [starRating, itemId]
        );

        const { rows } = await pgClient.query(
          `SELECT numVotes, numStars FROM items WHERE id = $1`,
          [itemId]
        );

        const locationNumVotes = rows[0].numvotes;
        const locationNumStars = rows[0].numstars;

        const newAverageStars = parseFloat(
          (locationNumStars / locationNumVotes).toFixed(2)
        );

        await pgClient.query(
          `UPDATE items SET averagestars = COALESCE(CAST($1 AS FLOAT), 0.0), lastupdated = NOW() WHERE id = $2`,
          [newAverageStars, itemId]
        );

        await redisClient.set(checkinProcessorIdKey, lastIdRead);
        await pgClient.query("COMMIT");
      } catch (error) {
        await pgClient.query("ROLLBACK");
        logger.error(
          `Error processing checkin ${checkin.id}: ${error.message}`
        );
      }

      lastIdRead = checkin.id;
      logger.info(`Processed checkin ${checkin.id}.`);

      if (delay) {
        /* eslint-disable no-await-in-loop */
        await sleep.randomSleep(1, 10);
        /* eslint-enable */
      }
    } else {
      logger.info("Waiting for more checkins...");
    }
  }
};

runCheckinProcessor();
