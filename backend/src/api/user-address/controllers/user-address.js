'use strict';

/**
 * user-address controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::user-address.user-address', ({ strapi }) => ({
  async testGet(ctx) {
    console.log(ctx.request)
    return {
      okay: true,
      type: "GET",
    };
  },
  async testPost(ctx) {
    ctx.body = await strapi.service('api::user-address.user-address').findMyAddress(ctx);
    
    
    return {
      okay: true,
      type: "POST",
    };
  },
}));
