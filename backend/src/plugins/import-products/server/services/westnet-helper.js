'use strict';

const Axios = require('axios');

module.exports = ({ strapi }) => ({

    async getWestnetData(entry, categoryMap) {
        try {
            const { categories_map, char_name_map, char_value_map, stock_map,
                isWhitelistSelected, whitelist_map, blacklist_map,
                xPath, minimumPrice, maximumPrice } = categoryMap

            console.log("Ξεκινάω να κατεβάζω τα xml...")

            let data = await Axios.get(`${entry.importedURL}`,
                { headers: { "Accept-Encoding": "gzip,deflate,compress" } })

            // console.log(data)

            const xPathFilter = await strapi
                .plugin('import-products')
                .service('helpers')
                .xPathFilter(await data, entry);

            const xml = await strapi
            .plugin('import-products')
            .service('helpers')
            .parseXml(xPathFilter)

            // return await xml;

            console.log("Το downloading ολοκληρώθηκε.")


            console.log("Προϊόντα στο xml της Westnet:", xml.products.product.length)
            // Φιλτράρω τα προϊόντα
            const availableProducts = this.filterData(xml.products.product, categoryMap)


            console.log("Προϊόντα μετά το φιλτράρισμα:", availableProducts.length)

            return availableProducts
        } catch (error) {
            console.log(error)
        }
    },

    filterData(data, categoryMap) { 

        const newData = data
            .filter(filterStock) 
            .filter(filterPriceRange)
            .filter(filterCategories)
            .filter(filterImages)

        function filterStock(stockName) {
            if (categoryMap.stock_map.length > 0) {
                let catIndex = categoryMap.stock_map.findIndex(x => parseInt(stockName.availability[0].trim()) >= parseInt(x.name.trim()))
                if (catIndex !== -1) {
                    return true
                }
                else {
                    return false
                }
            }
            else {
                return true
            }
        }

        function filterCategories(cat) {

            if (categoryMap.isWhitelistSelected) {
                if (categoryMap.whitelist_map.length > 0) {
                    let catIndex = categoryMap.whitelist_map.findIndex(x => x.name.trim() === cat.category[0].trim())
                    if (catIndex !== -1) {
                        if (categoryMap.whitelist_map[catIndex].subcategory.length > 0) {
                            let subIndex = categoryMap.whitelist_map[catIndex].subcategory.findIndex(x => x.name.trim() === cat.subcategory[0].trim())
                            if (subIndex !== -1) {
                                true
                            }
                            else {
                                return false
                            }
                        }
                        else {
                            return true
                        }
                    }
                    else {
                        return false
                    }
                }
                return true
            }
            else {
                if (categoryMap.blacklist_map.length > 0) {
                    let catIndex = categoryMap.blacklist_map.findIndex(x => x.name.trim() === cat.category[0].trim())
                    if (catIndex !== -1) {
                        if (categoryMap.blacklist_map[catIndex].subcategory.length > 0) {
                            let subIndex = categoryMap.blacklist_map[catIndex].subcategory.findIndex(x => x.name.trim() === cat.subcategory[0].trim())
                            if (subIndex !== -1) {
                                return false
                            }
                            else {
                                return true
                            }
                        }
                        else {
                            return false
                        }
                    }
                    else {
                        return true
                    }
                }
                return true
            }
        }

        function filterPriceRange(priceRange) {

            let minPrice = categoryMap.minimumPrice ? parseFloat(categoryMap.minimumPrice) : 0;
            let maxPrice;
            if (categoryMap.maximumPrice && categoryMap.maximumPrice > 0) {
                maxPrice = parseFloat(categoryMap.maximumPrice);
            }
            else {
                maxPrice = 100000;
            }

            const productPrice = parseFloat(priceRange.price[0].replace(".", "").replace(",", "."))

            if (productPrice >= minPrice && productPrice <= maxPrice) {
                return true
            }
            else {
                return false
            }
        }

        function filterImages(image) {
            if (image.image && image.image!=="") {
                return true 
            }
            else {
                return false
            }
        }

        return newData

    },

});
