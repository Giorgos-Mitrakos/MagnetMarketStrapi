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
            rule: "40 * * * *",
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

    updateDOTMEDIAwithScrapping: {
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
                .parseDotMediaWithScrapping({ entry, auth });
        },
        options: {
            rule: "10 5 * * *",
        },
    },

    updateDOTMEDIAwithXML: {
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
                .parseDotMediaOnlyXml({ entry, auth });
        },
        options: {
            rule: "10 10,16,18,22 * * *",
        },
    },

    updateTELEHERMES: {
        task: async ({ strapi }) => {
            // Add your own logic here (e.g. send a queue of email, create a database backup, etc.).
            const entry = await strapi.db.query('plugin::import-products.importxml').findOne({
                where: { name: "Telehermes" },
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
                .parseTelehermesXml({ entry, auth });
        },
        options: {
            rule: "5 8,11,14,16,18,22 * * *",
        },
    },

    updateCPI: {
        task: async ({ strapi }) => {
            // Add your own logic here (e.g. send a queue of email, create a database backup, etc.).
            const entry = await strapi.db.query('plugin::import-products.importxml').findOne({
                where: { name: "Cpi" },
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
                .parseCpiXml({ entry, auth });
        },
        options: {
            rule: "25 18 * * *",
        },
    },

    updateSMART4ALL: {
        task: async ({ strapi }) => {
            // Add your own logic here (e.g. send a queue of email, create a database backup, etc.).
            const entry = await strapi.db.query('plugin::import-products.importxml').findOne({
                where: { name: "Smart4All" },
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
                .parseSmart4AllXml({ entry, auth });
        },
        options: {
            rule: "55 * * * *",
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
            rule: "0 * * * *",
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
            rule: "58 * * * *",
        },
    },
}; 