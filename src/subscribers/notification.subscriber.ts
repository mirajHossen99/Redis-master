import dotenv from "dotenv";
import { createClient } from "redis";
import { redisClient } from "../redis/client";

dotenv.config();

const redisUrl = process.env.REDIS_URL || "redis://localhost:6380";

const notification_channel = "notifications";

export interface NotificationsPayload {
  id: string;
  title: string;
  message: string;
  createdAt: string;
}

export async function publishNotification(
  notification: NotificationsPayload,
): Promise<void> {
  await redisClient.publish(notification_channel, JSON.stringify(notification));
}

const subscriberClient = createClient({ url: redisUrl });
subscriberClient.on("error", (error) => {
  console.error("subscriber redis error: ", error);
});

async function startNotificationSubscriber() {
  await subscriberClient.connect();

  await subscriberClient.subscribe(notification_channel, (message) => {
    try {
      const notification = JSON.parse(message) as NotificationsPayload;
      console.log("New notification received");
      console.log("Title: ", notification.title);
      console.log("Message: ", notification.title);
      console.log("CreatedAt: ", notification.createdAt);
    } catch (error) {
      console.log("New notification received: ", message);
    }
  });
}

startNotificationSubscriber().catch((error) => {
  console.error("Failed to start notification: ", error);
  process.exit(1);
});
