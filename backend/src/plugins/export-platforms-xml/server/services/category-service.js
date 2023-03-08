'use strict';

module.exports = ({ strapi }) => ({
  async getPlatforms() {
    const platforms = await strapi.entityService.findMany('api::platform.platform', {
      sort: { name: 'asc' },
    })
    return await platforms;
  },
  
  async getCategories() {
    const categories = await strapi.entityService.findMany('api::category.category', {
      sort: { name: 'asc' },
    })
    return await categories;
  },
});
