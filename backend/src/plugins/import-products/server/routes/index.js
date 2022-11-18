module.exports = [
  {
    method: 'GET',
    path: '/',
    handler: 'getFileController.index',
    config: {
      auth: false,
      policies: [],
    },
  },

  {
    method: 'POST',
    path: '/parsexml',
    handler: 'parseController.index',
    config: {
      auth: false,
      policies: [],
    },
  },

  {
    method: 'POST',
    path: '/importSuccess',
    handler: 'parseController.success',
    config: {
      auth: false,
      policies: [],
    },
  },

  {
    method: 'POST',
    path: '/mapping',
    handler: 'mappingController.index',
    config: {
      auth: false,
      policies: [],
    },
  },

  {
    method: 'POST',
    path: '/updatespecs',
    handler: 'mappingController.updatespecs',
    config: {
      auth: false,
      policies: [],
    },
  },

  {
    method: 'POST',
    path: '/saveMapping',
    handler: 'mappingController.saveMapping',
    config: {
      auth: false,
      policies: [],
    },
  },

  {
    method: 'POST',
    path: '/exportToXML',
    handler: 'mappingController.exportToXML',
    config: {
      auth: false,
      policies: [],
    },
  },

  {
    method: 'POST',
    path: '/saveImportedURL',
    handler: 'getFileController.saveImportedURL',
    config: {
      auth: false,
      policies: [],
    },
  },
];

