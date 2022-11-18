module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/:supplier.xml',
      handler: 'novatron.xml',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
