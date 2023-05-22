'use strict';

const Axios = require('axios');
const slugify = require("slugify");

module.exports = {
    async afterUpdate(event) {
        const taxRate = Number(process.env.GENERAL_TAX_RATE)
        let percentage = Number(process.env.GENERAL_CATEGORY_PERCENTAGE)
        let addToPrice = Number(process.env.GENERAL_SHIPPING_PRICE)

        const { result, params } = event;

        const categoryBrandPercentage = new Map();

        const generalCategoryPercentage = result.cat_percentage.find(x => x.name === "general")

        if (generalCategoryPercentage) {
            console.log("hello")
            if (generalCategoryPercentage.percentage) {
                percentage = generalCategoryPercentage.percentage
            }

            addToPrice = generalCategoryPercentage.add_to_price ? generalCategoryPercentage.add_to_price : 0

            if (generalCategoryPercentage.brand_perc && generalCategoryPercentage.brand_perc.length > 0) {
                generalCategoryPercentage.brand_perc.forEach(x => {
                    categoryBrandPercentage.set(x.brand.name, x.percentage);
                });
            }
        }


        const products = await strapi.entityService.findMany('api::product.product', {
            filters: { category: result.id },
            populate: {
                supplierInfo: true,
                brand: true
            },
        });

        for (let product of products) {
            let brandPercentage = categoryBrandPercentage.get(product.brand?.name)
            if (brandPercentage) {
                percentage = brandPercentage
            }

            const minWholesale = product.supplierInfo.reduce((prev, current) => {
                return (prev.wholesale < current.wholesale) ? prev : current
            })

            let wholesale = Number(minWholesale.wholesale)

            const wholesaleAndShip = wholesale + addToPrice;
            
            const newPrice = wholesaleAndShip * (taxRate / 100 + 1) * (percentage / 100 + 1)
            
            await strapi.entityService.update('api::product.product', product.id, {
                data: {
                    price: parseFloat(newPrice).toFixed(2),
                },
            });

        }
    },
};