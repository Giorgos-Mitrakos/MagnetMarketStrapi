module.exports = [
  {
    method: 'GET',
    path: '/',
    handler: 'platformController.index',
    config: {
      policies: [],
    },
  },

  {
    method: 'POST',
    path: '/getPlatformCategories',
    handler: 'platformController.getPlatformCategories',
    config: {
      policies: [],
    },
  },

  {
    method: 'POST',
    path: '/scrapPlatformCategories',
    handler: 'platformController.scrapPlatformCategories',
    config: {
      policies: [],
    },
  },
];
