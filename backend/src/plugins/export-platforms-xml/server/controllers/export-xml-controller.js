'use strict';

module.exports = ({ strapi }) => ({
  async index(ctx) {
    ctx.body = await strapi
      .plugin('export-platforms-xml')
      .service('categoryService')
      .getCategories();
  },
  async getPlatforms(ctx) {
    ctx.body = await strapi
      .plugin('export-platforms-xml')
      .service('categoryService')
      .getPlatforms();
  },
  async saveExportCategories(ctx) {
    ctx.body = await strapi
      .plugin('export-platforms-xml')
      .service('categoryService')
      .saveExportCategories(ctx.request.body);
  },
});
