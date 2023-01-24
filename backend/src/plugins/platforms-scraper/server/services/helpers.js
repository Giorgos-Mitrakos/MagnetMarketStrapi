'use strict';

module.exports = ({ strapi }) => ({
    convertPrice(price) {
        const convertedPrice = parseFloat(price.replace(".", "").replace(",", ".")).toFixed(2)

        return convertedPrice
    }
})