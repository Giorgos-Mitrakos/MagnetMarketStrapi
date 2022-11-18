'use strict';

module.exports = {
  async index(ctx) {
    ctx.body = await strapi
      .plugin('import-products')
      .service('mapping')
      .getMapping(ctx.request.body);
  },

  async saveMapping(ctx) {
    ctx.body = await strapi
      .plugin('import-products')
      .service('mapping')
      .saveMapping(ctx.request.body);
  },

  async updatespecs(ctx) {
    ctx.body = await strapi
      .plugin('import-products')
      .service('helpers')
      .updatespecs(ctx.request.body);
  },

  async exportToXML(ctx) {
    ctx.body = await strapi
      .plugin('import-products')
      .service('helpers')
      .exportToXML(ctx.request.body.entry);
  },
};
