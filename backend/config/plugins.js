module.exports = {
    // ...
    'import-products': {
      enabled: true,
      resolve: './src/plugins/import-products'
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