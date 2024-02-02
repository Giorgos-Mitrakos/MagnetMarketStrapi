'use strict';

/**
 * user-address controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::user-address.user-address', ({ strapi }) => ({
  async getUser(ctx) {
    ctx.body = await strapi.service('api::user-address.user-address').getUser(ctx);
    return {
      okay: true,
      type: "GET",
    };
  },
  async updateUser(ctx) {
    ctx.body = await strapi.service('api::user-address.user-address').updateMyAddress(ctx);


    return {
      okay: true,
      type: "POST",
    };
  },
}));
