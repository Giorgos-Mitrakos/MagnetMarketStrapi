'use strict';

module.exports = ({ strapi }) => ({
  index(ctx) {
    ctx.body = strapi
      .plugin('platforms-scraper')
      .service('myService')
      .getWelcomeMessage();
  },
});
