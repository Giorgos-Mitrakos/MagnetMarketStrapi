module.exports = {
    /**
     * Simple example.
     * Every monday at 1am.
     */

    // '*/40 * * * *': async ({ strapi }) => {
    //     // Add your own logic here (e.g. send a queue of email, create a database backup, etc.).

    //     const entry = await strapi.db.query('plugin::import-products.importxml').findOne({
    //         where:{name:"Oktabit"},
    //         populate: {
    //             importedFile: true,
    //             stock_map: {
    //                 fields: ['name'],
    //                 sort: 'name:asc', 
    //             },
    //         },
    //     })

    //     const auth = process.env.STRAPI_TOKEN

    //     await strapi
    //         .plugin('import-products')
    //         .service('parseService')
    //         .parseOktabitXml({ entry, auth });
    // },
};