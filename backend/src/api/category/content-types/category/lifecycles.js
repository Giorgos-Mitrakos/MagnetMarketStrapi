const Axios = require('axios');
const slugify = require("slugify");

module.exports = {
    async afterUpdate(event) {
        const taxRate = process.env.GENERAL_TAX_RATE

        const { result, params } = event;

        const generalCategoryPercentage = result.cat_percentage.find(x => x.name === "general")

        const products = await strapi.entityService.findMany('api::product.product', {
            filters: { category: result.id },
            populate: { supplierInfo: true },
        });

        for (let product of products) {

            const minWholesale = product.supplierInfo.reduce((prev, current) => {
                return (prev.wholesale < current.wholesale) ? prev : current
            })

            let addToPrice = generalCategoryPercentage.add_to_price ? generalCategoryPercentage.add_to_price : 0

            const newPrice = parseFloat(minWholesale.wholesale + addToPrice) * (taxRate / 100 + 1) * (generalCategoryPercentage.percentage / 100 + 1)

            await strapi.entityService.update('api::product.product', product.id, {
                data: {
                    price: newPrice,
                },
            });

        }
    },
};