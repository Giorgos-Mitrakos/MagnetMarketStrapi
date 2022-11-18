'use strict';

/**
 * A set of functions called "actions" for `Novatron`
 */

module.exports = {
  async xml(ctx, next) {
    try {
      ctx.set('content-type','application/xml')
      ctx.body = await strapi
        .plugin('import-products')
        .service('helpers')
        .exportToXML(ctx.request.url.split("/")[2].split(".")[0]);
    } catch (err) {
      ctx.body = err;
    }
  }
};
