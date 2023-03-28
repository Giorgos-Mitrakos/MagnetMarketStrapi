'use strict';

module.exports = ({ strapi }) => ({
  async index(ctx) {
    ctx.body = await strapi
      .plugin('export-platforms-xml')
      .service('xmlService')
      .createXml();
  },
});
