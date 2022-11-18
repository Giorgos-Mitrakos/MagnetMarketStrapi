import { request } from "@strapi/helper-plugin";
import pluginId from "../pluginId";

export const getImportedFile = async () => {
  try {
    const data = await request(`/${pluginId}`, { method: "GET" });

    return data;
  } catch (error) {
    return null;
  }
};

export const postParseToJson = async (entry, auth) => {
  try {
    const data = await request(`/${pluginId}/parsexml`,
      {
        method: "POST",
        body: {
          entry,
          auth,
        }
      }
    );

    return data;
  } catch (error) {
    return null;
  }
};

export const ImportedFileSuccess = async (id) => {
  try {
    const data = await request(`/${pluginId}/importSuccess`,
      {
        method: "POST",
        body: {
          id,
        }
      });

    return data;
  } catch (error) {
    return null;
  }
};

export const getMapping = async (id) => {
  try {
    const data = await request(`/${pluginId}/mapping`,
      {
        method: "POST",
        body: {
          id,
        }
      });

    return data;
  } catch (error) {
    return null;
  }
};

export const saveMapping = async (id, categoryMapping) => {
  try {
    const data = await request(`/${pluginId}/saveMapping`,
      {
        method: "POST",
        body: {
          id,
          categoryMapping,
        }
      });

    return data;
  } catch (error) {
    return null;
  }
};

export const updateSpecs = async (id) => {
  try {
    const data = await request(`/${pluginId}/updatespecs`,
      {
        method: "POST",
        body: {
          id,
        }
      });

    return data;
  } catch (error) {
    return null;
  }
};

export const saveURL = async (id, url) => {
  try {
    const data = await request(`/${pluginId}/saveImportedURL`,
      {
        method: "POST",
        body: {
          id,
          url,
        }
      });

    return data;
  } catch (error) {
    return null;
  }
};


export const exportToXML = async (entry) => {
  try {
    const data = await request(`/${pluginId}/exportToXML`,
      {
        method: "POST",
        body: {
          entry
        }
      });

    return data;
  } catch (error) {
    return null;
  }
};