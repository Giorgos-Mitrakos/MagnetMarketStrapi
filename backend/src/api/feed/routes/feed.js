module.exports = {
  routes: [
    {
     method: 'GET',
     path: '/feed/:platform.xml',
     handler: 'feed.exportplatformxml',
     config: {
       policies: [],
       middlewares: [],
     },
    },
  ],
};
