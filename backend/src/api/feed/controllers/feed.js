'use strict';

/**
 * A set of functions called "actions" for `feed`
 */

module.exports = {
  exportplatformxml: async (ctx, next) => {
    try {
      ctx.set('content-type','application/xml')
      ctx.body = await strapi
        .plugin('export-platforms-xml')
        .service('xmlService')
        .createXml(ctx.request.url.split("/")[3].split(".")[0])
    } catch (err) {
      ctx.body = err;
    }
  }
};
