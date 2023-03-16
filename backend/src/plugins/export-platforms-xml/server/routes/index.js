module.exports = [
  {
    method: 'GET',
    path: '/',
    handler: 'categoryController.index',
    config: {
      policies: [],
    },
  },
  {
    method: 'GET',
    path: '/platforms',
    handler: 'categoryController.getPlatforms',
    config: {
      policies: [],
      auth: false,
    },
  },
  {
    method: 'POST',
    path: '/saveExportedCategories',
    handler: 'categoryController.saveExportCategories',
    config: {
      policies: [],
    },
  },
  {
    method: 'POST',
    path: '/saveExportedCategories',
    handler: 'categoryController.saveExportCategories',
    config: {
      policies: [],
    },
  },
];
