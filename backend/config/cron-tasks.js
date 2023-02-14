module.exports = {
    /**
     * Simple example.
     * Every monday at 1am.
     */

    '*/6 * * * *':async ({ strapi }) => {
        // Add your own logic here (e.g. send a queue of email, create a database backup, etc.).
        await strapi
        .plugin('import-products')
        .service('parseService')
        .parseOktabitXml(ctx.request.body);
    },
};