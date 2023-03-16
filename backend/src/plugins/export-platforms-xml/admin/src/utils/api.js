import { request } from "@strapi/helper-plugin";
import pluginId from "../pluginId";

export const getCategories = async () => {
    try {
        const data = await request(`/${pluginId}`, { method: "GET" });

        return data;
    } catch (error) {
        return null;
    }
};

export const getPlatforms = async () => {
    try {
        const data = await request(`/${pluginId}/platforms`, { method: "GET" });

        return data;
    } catch (error) {
        return null;
    }
};

export const savePlatformExportedCategories = async (platformID, categoriesID) => {
    try {
        const data = await request(`/${pluginId}/saveExportedCategories`, {
            method: "POST",
            body: {
                platformID,
                categoriesID
            }
        });

        return data;
    } catch (error) {
        return null;
    }
};