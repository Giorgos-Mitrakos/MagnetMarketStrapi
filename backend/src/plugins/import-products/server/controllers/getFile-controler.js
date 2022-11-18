'use strict';

module.exports = {
  async index(ctx) {
    ctx.body = await strapi
      .plugin('import-products')
      .service('getFileService')
      .getFile();
  },

  async saveImportedURL(ctx) {
    ctx.body = await strapi
      .plugin('import-products')
      .service('getFileService')
      .saveImportedURL(ctx.request.body);
  },
};
