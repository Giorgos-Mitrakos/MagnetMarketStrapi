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
            rule: "10 07,10,13,16,19,22 * * *",
        },
    },

    scrapNOVATRON: {
        task: async ({ strapi }) => {
            // Add your own logic here (e.g. send a queue of email, create a database backup, etc.).
            const entry = await strapi.db.query('plugin::import-products.importxml').findOne({
                where: { name: "Novatron" },
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
                .parseNovatronXml({ entry, auth });
        },
        options: {
            rule: "0 17 * * *",
        },
    },

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
            rule: "30 6,17 * * *",
        },
    },

}; 