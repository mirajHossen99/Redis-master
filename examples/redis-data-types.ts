// string
// hash
// list
// set
// sorted set
// ttl

// sting
// stores one value under one key
// plain text, numbers stored as texts, counters
// key: page_views
// value: "100"

import dotenv from "dotenv";
import { createClient } from "redis";

dotenv.config();

const redisUrl = process.env.REDIS_URL || "redis://localhost:6380";

const redis = createClient({ url: redisUrl });

async function run() {
  // open connection to redis server
  await redis.connect();
  console.log("connected to redis");
  console.log("pind", await redis.ping());

  // string
  const stringKey = "demo:page_views";

  await redis.set(stringKey, "100");

  const pageviews = await redis.get(stringKey);
  console.log(pageviews);

  // redis strings can also work like counters
  const afterIncr = await redis.incr(stringKey);
  console.log(afterIncr);

  // hash -->
  // stores many small fields under one key - small object or map inside redis

  // key: keyname
  // fields:
  // name -> "miraj"
  // email -> "email"

  const hashKey = "demo:user:profile";
  await redis.hSet(hashKey, {
    name: "miraj",
    email: "miraj@example.com",
    city: "bangladesh",
  });

  const extractProfileInfo = await redis.hGetAll(hashKey);
  console.log(extractProfileInfo);

  // list
  // redis list ordered collection of values
  const listKey = "demo:messages";
  await redis.lPush(listKey, "hello");
  await redis.lPush(listKey, "hi, redis");
  await redis.rPush(listKey, "Okay");

  const extractMessages = await redis.lRange(listKey, 0, -1);
  console.log(extractMessages);

  // lpush - adds a new item at beginging
  // lrange - reads items from the list
  // rpush - adds the item at end
  // ltrim - keeps only part of the list

  // set
  // sets unique sets of values only

  const setKey = "demo:tags";

  await redis.sAdd(setKey, "node.js");
  await redis.sAdd(setKey, "next.js");
  await redis.sAdd(setKey, "next.js");

  const tagCount = await redis.sCard(setKey);
  console.log(tagCount);

  // sorted set
  const rankKey = "demo:leaderboard";

  await redis.zAdd(rankKey, { score: 100, value: "player_a" });
  await redis.zAdd(rankKey, { score: 200, value: "player_b" });
  await redis.zAdd(rankKey, { score: 300, value: "player_c" });

  const newScoreA = await redis.zIncrBy(rankKey, 400, "player_a");
  const newScoreB = await redis.zIncrBy(rankKey, 100, "player_b");
  const newScoreC = await redis.zIncrBy(rankKey, 100, "player_c");

  console.log("New score of A: ", newScoreA);
  console.log("New score of B: ", newScoreB);
  console.log("New score of C: ", newScoreC);

  const rankA = await redis.zRevRank(rankKey, "player_a");
  const rankB = await redis.zRevRank(rankKey, "player_b");
  const rankC = await redis.zRevRank(rankKey, "player_c");

  console.log("rank A: ", rankA);
  console.log("rank B: ",rankB);
  console.log("rank C: ",rankC);

  // ttl --> expiry
  // time to live
  // It tells redis how long a key should exists before being delete automatically


  // key - a
  // value : "345"
  // ttl: 300 second
  // after 5 min redis is going to delete this key automatically

  const optKey = "demo:otp";

  await redis.set(optKey, "123456");

  await redis.expire(optKey, 60);

  const ttl = await redis.ttl(optKey);

  console.log(ttl);

  await redis.quit();
}

run().catch((error) => {
  console.error("Failed: ", error);
  process.exit(1);
});
