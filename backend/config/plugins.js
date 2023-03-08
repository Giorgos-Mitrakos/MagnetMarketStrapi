module.exports = {
    // ...
    'import-products': {
      enabled: true,
      resolve: './src/plugins/import-products'
    },

    'platforms-scraper': {
      enabled: true,
      resolve: './src/plugins/platforms-scraper'
    },

    'export-platforms-xml': {
      enabled: true,
      resolve: './src/plugins/export-platforms-xml'
    },

    upload: {
      config: {
        providerOptions: {
          localServer: {
            maxage: 300000
          },
        },
      },
    },
    // ...
  }