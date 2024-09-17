const fetch = require("node-fetch");
const router = require("express").Router();
const { param, query } = require("express-validator");
const logger = require("../utils/logger");
const redis = require("../utils/redisclient");
const apiErrorReporter = require("../utils/apierrorreporter");

const CACHE_TIME = 60 * 60; // An hour in seconds.
const redisClient = redis.getClient();

const getWeatherKey = (locationId) => redis.getKeyName("weather", locationId);

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

    const pipeline = redisClient.pipeline();
    pipeline.hgetall(itemKey);

    if (withDetails) {
      const detailsKey = redis.getKeyName("details", itemId);
      pipeline.call("JSON.GET", detailsKey);
    }

    const details = await pipeline.exec();
    const payloadOverview = details[0][1];
    let response;

    if (withDetails) {
      const payloadDetails = JSON.parse(details[1][1]);
      delete payloadDetails.id;

      response = {
        ...payloadOverview,
        ...payloadDetails,
      };
    } else {
      response = payloadOverview;
    }

    res.status(200).json(response);
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
