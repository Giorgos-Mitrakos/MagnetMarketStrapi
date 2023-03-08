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
    },
  },
];
