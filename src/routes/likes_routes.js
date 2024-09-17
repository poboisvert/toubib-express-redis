const router = require("express").Router();
const { param } = require("express-validator");
const redis = require("../utils/redisclient");
const apiErrorReporter = require("../utils/apierrorreporter");

const redisClient = redis.getClient();

const timestampValidator = (value, { req }) => {
  const startTime = parseInt(req.params.startTime, 10);
  const endTime = parseInt(req.params.endTime, 10);

  if (startTime > endTime) {
    throw new Error("startTime must be less than or equal to endTime.");
  }

  return true;
};

const buildCheckinObjects = (likes) => {
  // Convert XRANGE's array of arrays response to array of objects.
  const response = [];

  for (const like of likes) {
    const [id, fieldsValues] = like;

    const obj = {
      id,
    };

    for (let n = 0; n < fieldsValues.length; n += 2) {
      obj[fieldsValues[n]] = fieldsValues[n + 1];
    }

    response.push(obj);
  }

  return response;
};

router.get(
  "/likes/:startTime/:endTime",
  [
    param("startTime").isInt({ min: 0 }).custom(timestampValidator),
    param("endTime").isInt({ min: 0 }).custom(timestampValidator),
    apiErrorReporter,
  ],
  async (req, res) => {
    const { startTime, endTime } = req.params;
    const likesStreamKey = redis.getKeyName("likes");

    // Get maximum 1000 records so we don't create a huge load.
    const likes = await redisClient.xrange(
      likesStreamKey,
      startTime,
      endTime,
      "COUNT",
      "1000"
    );

    // Convert array of arrays response to array of objects.
    const response = buildCheckinObjects(likes);

    res.status(200).json(response);
  }
);

// EXERCISE: Get the latest checkin.
router.get("/likes/latest", async (req, res) => {
  const likesStreamKey = redis.getKeyName("likes");

  // TODO: Use the XREVRANGE command to get just the latest
  // (most recent) checkin from the stream whose key is
  // stored in checkinStreamKey.
  // https://redis.io/commands/xrevrange
  const latestCheckin = await redisClient.xrevrange(
    likesStreamKey,
    "+",
    "-",
    "COUNT",
    10
  );

  // Convert array of arrays response to array of objects.
  const response = buildCheckinObjects(latestCheckin);

  res.status(200).json(response);
});

module.exports = router;
