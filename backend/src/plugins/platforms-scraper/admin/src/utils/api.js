import { request } from "@strapi/helper-plugin";
import pluginId from "../pluginId";

export const getPlatforms = async () => {
  try {
    const data = await request(`/${pluginId}`, { method: "GET" });

    return data;
  } catch (error) {
    return null;
  }
};

export const getPlatformCategories = async (platform) => {
  try {
    const data = await request(`/${pluginId}/getPlatformCategories`,
      {
        method: "POST",
        body: {
          platform,
        }
      });

    return data;
  } catch (error) {
    return null;
  }
};

export const scrapPlatformCategories = async (platform) => {
  try {
    const data = await request(`/${pluginId}/scrapPlatformCategories`,
      {
        method: "POST",
        body: {
          platform,
        }
      });

    return data;
  } catch (error) {
    return null;
  }
};