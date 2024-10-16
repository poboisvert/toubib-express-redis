const fetch = require("node-fetch");
const router = require("express").Router();
const { param, query } = require("express-validator");
const logger = require("../utils/logger");
const redis = require("../utils/redisclient");
const apiErrorReporter = require("../utils/apierrorreporter");

const CACHE_TIME = 60; // An hour in seconds.
const redisClient = redis.getClient();

const pgClient = require("../utils/db"); // Import PostgreSQL client

const getWeatherKey = (locationId) => redis.getKeyName("weather", locationId);

router.get("/items/latest", async (req, res) => {
  try {
    const result = await pgClient.query(
      "SELECT * FROM items ORDER BY lastUpdated DESC LIMIT 100"
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    logger.error("Failed to fetch items from SQL", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch items", error: error.message });
  }
});

// Get location by ID, optionally with extra details.
router.get(
  "/item/:itemId", // Example URL: /item/1?withDetails=true
  [
    param("itemId").isInt({ min: 1 }),
    query("withDetails").isBoolean().optional(),
    apiErrorReporter,
  ],
  async (req, res) => {
    const { itemId } = req.params;
    const { withDetails } = req.query;

    const itemKey = redis.getKeyName("items", itemId);

    // Check Redis first
    const cachedItem = await redisClient.hgetall(itemKey);
    if (Object.keys(cachedItem).length > 0) {
      return res.status(200).json(cachedItem);
    }

    // If not found in Redis, fetch from PostgreSQL
    try {
      const result = await pgClient.query("SELECT * FROM items WHERE id = $1", [
        itemId,
      ]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Item not found" });
      }

      const itemData = result.rows[0];
      // Create Redis key and save the value as hash
      await redisClient.hmset(itemKey, itemData);
      // Set expiration for the Redis key
      await redisClient.expire(itemKey, 10);

      let response = itemData;

      if (withDetails) {
        const detailsKey = redis.getKeyName("details", itemId);
        const details = await redisClient.call("JSON.GET", detailsKey);
        const payloadDetails = JSON.parse(details);
        delete payloadDetails.id;

        response = {
          ...itemData,
          ...payloadDetails,
        };
      }

      res.status(200).json(response);
    } catch (error) {
      console.error(`Error fetching item from database: ${error}`);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.get(
  "/item/:itemId/detail",
  [
    param("itemId").isInt({ min: 1 }),
    query("sections")
      .isString()
      .optional()
      .custom((value, { req }) => {
        const { sections } = req.query;
        const validSections = ["website", "description", "phone"];
        const arrayOfSections = sections.split(",");

        for (const str of arrayOfSections) {
          if (!validSections.includes(str)) {
            throw new Error(`Invalid value ${str} for sections.`);
          }
        }

        return true;
      }),
    apiErrorReporter,
  ],
  async (req, res) => {
    const { itemId } = req.params;
    const { sections } = req.query;
    const detailsKey = redis.getKeyName("details", itemId);

    let jsonPath = ["."];
    if (sections) {
      jsonPath = sections.split(",");
    }

    const details = JSON.parse(
      await redisClient.call("JSON.GET", detailsKey, ...jsonPath)
    );

    // If null response, return empty object.
    res.status(200).json(details || {});
  }
);

const validateCategory = (category) => {
  const validCategories = [
    "retail",
    "cafe",
    "restaurant",
    "bar",
    "hair",
    "gym",
  ];

  if (!validCategories.includes(category)) {
    throw new Error(`Invalid value ${category} for category.`);
  }

  return true;
};

// Get all locations in a specified category.
router.get(
  "/items/bycategory/:category",
  [
    param("category")
      .isString()
      .custom((value, { req }) => {
        const { category } = req.params;
        return validateCategory(category);
      }),
    apiErrorReporter,
  ],
  async (req, res) => {
    const { category } = req.params;
    const searchResults = await redis.performSearch(
      redis.getKeyName("locationsidx"),
      `@category:{${category}}`
    );

    res.status(200).json(searchResults);
  }
);

// Call an external weather API to get weather for a given location ID.
router.get(
  "/location/:locationId/weather",
  [param("locationId").isInt({ min: 1 }), apiErrorReporter],
  async (req, res, next) => {
    const { locationId } = req.params;

    const cachedWeather = await redisClient.get(getWeatherKey(locationId));

    if (cachedWeather) {
      // Cache hit!
      logger.debug(`Cache hit for location ${locationId} weather.`);
      res.status(200).json(JSON.parse(cachedWeather));
    } else {
      // Cache miss :(
      logger.debug(`Cache miss for location ${locationId} weather.`);
      next();
    }
  },
  async (req, res) => {
    const { locationId } = req.params;

    // Get the co-ordinates for this location from Redis.
    const locationKey = redis.getKeyName("locations", locationId);

    // Get lng,lat coordinates from Redis.
    const coords = await redisClient.hget(locationKey, "location");
    let weatherJSON = {};

    // Check if the location existed in Redis and get weather if so.
    if (coords) {
      const [lng, lat] = coords.split(",");

      // Call the API.
      const apiResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?units=imperial&lat=${lat}&lon=${lng}&appid=${process.env.WEATHER_API_KEY}`
      );

      if (apiResponse.status === 200) {
        // Weather was retrieved OK.
        weatherJSON = await apiResponse.json();

        // Store the results in Redis and set TTL.
        redisClient.setex(
          getWeatherKey(locationId),
          CACHE_TIME,
          JSON.stringify(weatherJSON)
        );

        return res.status(200).json(weatherJSON);
      }

      return res.status(400).send("Bad request: check your WEATHER_API_KEY!");
    }
  }
);

module.exports = router;
