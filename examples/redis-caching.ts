import dotenv from "dotenv";
import { createClient } from "redis";

dotenv.config();

const redisUrl = process.env.REDIS_URL || "redis://localhost:6380";

const redis = createClient({ url: redisUrl });

// cache key
const cacheKey = "demo:products";
const cacheTtlSeconds = 60; // cache will expire after 60 seconds

let dbProduct = ["Keyboard", "Mouse", "Laptop", "Mobile"];

async function run() {
  await redis.connect();

  // first request - cache miss

  let cached = await redis.get(cacheKey);

  // cache aside function
  if (cached) {
    console.log("Cache HIT");
    console.log("data :", JSON.parse(cached));
  } else {
    console.log("Cache MISS");
    // read from main db
    const products = dbProduct;

    // set/save the products in redis cache
    // setEx - also saves ttl so that your cache doesn't live forever
    await redis.setEx(cacheKey, cacheTtlSeconds, JSON.stringify(products));
  }

  // stale cache problem
  dbProduct = ["Keyboard", "Mouse", "Laptop", "Mobile", "Desktop", "Monitor"];


  // cache invalidation
  // when DB changes - delete ur old cache immediately

  await redis.del(cacheKey)
  console.log("Cache deleted");

  cached = await redis.get(cacheKey);

  if (!cached) {
    console.log("Cache data after delete");
    // data from db changes
    const freshProducts = dbProduct;
    await redis.setEx(cacheKey, cacheTtlSeconds, JSON.stringify(freshProducts));

    console.log("Fresh data HIT");
  }


  await redis.quit();
}

run().catch((error) => {
  console.error("Failed: ", error);
  process.exit(1);
});
