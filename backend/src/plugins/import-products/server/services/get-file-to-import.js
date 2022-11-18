'use strict';

module.exports = ({ strapi }) => ({
  async getFile() {
    try {
      return await strapi.entityService.findMany('plugin::import-products.importxml', {
        populate: { importedFile: true },
      })
    }
    catch (err) {
      console.log(err);
    }
  },

  async fileImportSuccess({ id }) {
    try {
      return await strapi.entityService.update('plugin::import-products.importxml', id,
        {
          data: {
            lastRun: new Date(),
          },
        })
    }
    catch (err) {
      console.log(err);
    }
  },

  async saveImportedURL({ id, url }) {
    try {
      return await strapi.entityService.update('plugin::import-products.importxml', id,
        {
          data: {
            importedURL: url,
          },
        })
    }
    catch (err) {
      console.log(err);
    }
  }
});
