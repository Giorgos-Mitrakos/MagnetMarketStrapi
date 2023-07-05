module.exports = {
    /**
     * Simple example.
     * Every monday at 1am.
     */

    scrapQUEST: {
        task: async ({ strapi }) => {
            // Add your own logic here (e.g. send a queue of email, create a database backup, etc.).
            const entry = await strapi.db.query('plugin::import-products.importxml').findOne({
                where: { name: "QUEST" },
                populate: {
                    importedFile: true,
                    stock_map: {
                        fields: ['name'],
                        sort: 'name:asc',
                    },
                },
            })

            const auth = process.env.STRAPI_TOKEN

            await strapi
                .plugin('import-products')
                .service('parseService')
                .parseQuestXml({ entry, auth });
        },
        options: {
            rule: "10 8,22 * * *",
        },
    },

    scrapGLOBALSAT: {
        task: async ({ strapi }) => {
            // Add your own logic here (e.g. send a queue of email, create a database backup, etc.).
            const entry = await strapi.db.query('plugin::import-products.importxml').findOne({
                where: { name: "globalsat" },
                populate: {
                    importedFile: true,
                    stock_map: {
                        fields: ['name'],
                        sort: 'name:asc',
                    },
                },
            })

            const auth = process.env.STRAPI_TOKEN

            await strapi
                .plugin('import-products')
                .service('parseService')
                .parseGlobalsat({ entry, auth });
        },
        options: { 
            rule: "45 * * * *",
        },
    },

    // scrapNOVATRON: {
    //     task: async ({ strapi }) => {
    //         // Add your own logic here (e.g. send a queue of email, create a database backup, etc.).
    //         const entry = await strapi.db.query('plugin::import-products.importxml').findOne({
    //             where: { name: "Novatron" },
    //             populate: {
    //                 importedFile: true,
    //                 stock_map: {
    //                     fields: ['name'],
    //                     sort: 'name:asc',
    //                 },
    //             },
    //         })

    //         const auth = process.env.STRAPI_TOKEN

    //         await strapi
    //             .plugin('import-products')
    //             .service('parseService')
    //             .parseNovatronXml({ entry, auth });
    //     },
    //     options: {
    //         rule: "0 * * * *",
    //     },
    // },

    updateOKTABIT: {
        task: async ({ strapi }) => {
            // Add your own logic here (e.g. send a queue of email, create a database backup, etc.).
            const entry = await strapi.db.query('plugin::import-products.importxml').findOne({
                where: { name: "Oktabit" },
                populate: {
                    importedFile: true,
                    stock_map: {
                        fields: ['name'],
                        sort: 'name:asc',
                    },
                },
            })

            const auth = process.env.STRAPI_TOKEN

            await strapi
                .plugin('import-products')
                .service('parseService')
                .parseOktabitXml({ entry, auth });
        },
        options: {
            rule: "15 9,13 * * *",
        },
    },

    // updateGERASIS: {
    //     task: async ({ strapi }) => {
    //         // Add your own logic here (e.g. send a queue of email, create a database backup, etc.).
    //         const entry = await strapi.db.query('plugin::import-products.importxml').findOne({
    //             where: { name: "Gerasis" },
    //             populate: {
    //                 importedFile: true,
    //                 stock_map: {
    //                     fields: ['name'],
    //                     sort: 'name:asc',
    //                 },
    //             },
    //         })

    //         const auth = process.env.STRAPI_TOKEN

    //         await strapi
    //             .plugin('import-products')
    //             .service('parseService')
    //             .parseGerasisXml({ entry, auth });
    //     },
    //     options: {
    //         rule: "50 6,17 * * *",
    //     },
    // },

    updateZEGETRON: {
        task: async ({ strapi }) => {
            // Add your own logic here (e.g. send a queue of email, create a database backup, etc.).
            const entry = await strapi.db.query('plugin::import-products.importxml').findOne({
                where: { name: "Zegetron" },
                populate: {
                    importedFile: true,
                    stock_map: {
                        fields: ['name'],
                        sort: 'name:asc',
                    },
                },
            })

            const auth = process.env.STRAPI_TOKEN

            await strapi
                .plugin('import-products')
                .service('parseService')
                .parseZegetronXml({ entry, auth });
        },
        options: {
            rule: "10 9,13 * * *",
        },
    },

    updateDOTMEDIA: {
        task: async ({ strapi }) => {
            // Add your own logic here (e.g. send a queue of email, create a database backup, etc.).
            const entry = await strapi.db.query('plugin::import-products.importxml').findOne({
                where: { name: "DotMedia" },
                populate: {
                    importedFile: true,
                    stock_map: {
                        fields: ['name'],
                        sort: 'name:asc',
                    },
                },
            })

            const auth = process.env.STRAPI_TOKEN

            await strapi
                .plugin('import-products')
                .service('parseService')
                .parseDotMedia({ entry, auth });
        },
        options: {
            rule: "15 7,12,16,18,22 * * *",
        },
    },

    updateAll: {
        task: async ({ strapi }) => {
            // Add your own logic here (e.g. send a queue of email, create a database backup, etc.).


            await strapi
                .plugin('import-products')
                .service('parseService')
                .updateAll();
        },
        options: {
            rule: "10 17 * * *",
        },
    },

    createSkroutzXml: {
        task: async ({ strapi }) => {
            // Add your own logic here (e.g. send a queue of email, create a database backup, etc.).

            await strapi
                .plugin('export-platforms-xml')
                .service('xmlService')
                .createXml('Skroutz');
        },
        options: { 
            rule: "14 * * * *", 
        },
    },

    createShopflixXml: {
        task: async ({ strapi }) => {
            // Add your own logic here (e.g. send a queue of email, create a database backup, etc.).

            await strapi
                .plugin('export-platforms-xml')
                .service('xmlService')
                .createXml('Shopflix');
        }, 
        options: {
            rule: "22 * * * *",
        },
    },

    // createShopflixExcel: {
    //     task: async ({ strapi }) => {
    //         // Add your own logic here (e.g. send a queue of email, create a database backup, etc.).

    //         await strapi
    //             .plugin('export-platforms-xml')
    //             .service('xmlService')
    //             .createExcel();
    //     },
    //     options: {
    //         rule: "15 * * * *",
    //     },
    // },

}; 