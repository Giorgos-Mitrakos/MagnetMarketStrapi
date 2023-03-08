'use strict';

module.exports = ({ strapi }) => ({
  async index(ctx) {
    ctx.body =await strapi
      .plugin('export-platforms-xml')
      .service('categoryService')
      .getCategories();
 
      console.log(ctx.body)
  },
  async getPlatforms(ctx) {
    ctx.body =await strapi
      .plugin('export-platforms-xml')
      .service('categoryService')
      .getPlatforms();
 
      console.log(ctx.body)
  },
});
