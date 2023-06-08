'use strict';

const Axios = require('axios'); 

module.exports = ({ strapi }) => ({

    async getZegetronData(entry, categoryMap) {
        try {
            const { categories_map, char_name_map, char_value_map, stock_map,
                isWhitelistSelected, whitelist_map, blacklist_map,
                xPath, minimumPrice, maximumPrice } = categoryMap

            // console.log("newData:", newData.length)
            const charMaps = await strapi
                .plugin('import-products')
                .service('helpers')
                .parseCharsToMap(char_name_map, char_value_map);

            const { mapCharNames, mapCharValues } = charMaps

            const products = []

            const data = await Axios.get(`${entry.importedURL}`,
                { headers: { "Accept-Encoding": "gzip,deflate,compress" } })

            // const xPathFilter = await strapi
            //     .plugin('import-products')
            //     .service('helpers')
            //     .xPathFilter(await data, entry);

            const xml = await strapi
                .plugin('import-products')
                .service('helpers').parseXml(await data.data)

            console.log(xml.mywebstore.products[0].product.length)

            const unique_product = {
                mpn: []
            }

            const availableProducts = this.filterData(xml.mywebstore.products[0].product, categoryMap, unique_product)

            console.log(availableProducts.length)
            return availableProducts
        } catch (error) {
            console.log(error)
        }
    },

    filterData(data, categoryMap, unique_product) {

        const newData = data
            // .filter(filterUnique)
            .filter(filterStock)
            .filter(filterPriceRange)
            .filter(filterCategories)
            .filter(filterImages)

        function filterUnique(unique) {
            if (unique_product.mpn.includes(unique.part_number[0].trim().toString())) {
                return false
            }
            else {
                unique_product.mpn.push(unique.part_number[0].trim().toString())
                return true 
            }
        }

        function filterStock(stockName) {
            // console.log(categoryMap.stock_map[0])
            if (categoryMap.stock_map.length > 0) {
                // let catIndex = categoryMap.stock_map[0].findIndex(x => x.name.trim() === stockName.stock[0].trim())
                if (parseInt(categoryMap.stock_map[0].name) <= parseInt(stockName.stock[0])) {
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
            let category = cat.category[0].trim()
            let subcategory = null
            let sub2category = null

            if (categoryMap.isWhitelistSelected) {
                if (categoryMap.whitelist_map.length > 0) {
                    let catIndex = categoryMap.whitelist_map.findIndex(x => x.name.trim() === category)
                    if (catIndex !== -1) {
                        // return true
                        if (categoryMap.whitelist_map[catIndex].subcategory.length > 0) {
                            let subIndex = categoryMap.whitelist_map[catIndex].subcategory.findIndex(x => x.name.trim() === subcategory)
                            if (subIndex !== -1) {
                                if (categoryMap.whitelist_map[catIndex].subcategory[subIndex].subcategory.length > 0) {
                                    let sub2Index = categoryMap.whitelist_map[catIndex].subcategory[subIndex].subcategory.findIndex(x => x.name.trim() === sub2category)
                                    if (sub2Index !== -1) {
                                        return true
                                    }
                                    else {
                                        return false
                                    }
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
                    else {
                        return false
                    }
                }
                return true
            }
            else {
                if (categoryMap.blacklist_map.length > 0) {
                    let catIndex = categoryMap.blacklist_map.findIndex(x => x.name.trim() === category)
                    if (catIndex !== -1) {
                        // return false
                        if (categoryMap.blacklist_map[catIndex].subcategory.length > 0) {
                            let subIndex = categoryMap.blacklist_map[catIndex].subcategory.findIndex(x => x.name.trim() === subcategory)
                            if (subIndex !== -1) {
                                if (categoryMap.whitelist_map[catIndex].subcategory[subIndex].subcategory.length > 0) {
                                    let sub2Index = categoryMap.whitelist_map[catIndex].subcategory[subIndex].subcategory.findIndex(x => x.name.trim() === sub2category)
                                    if (sub2Index !== -1) {
                                        return false
                                    }
                                    else {
                                        return true
                                    }
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
                    else {
                        return true
                    }
                }
                return true
            }
        }

        function filterPriceRange(priceRange) {

            let minPrice = categoryMap.minimumPrice ? parseFloat(categoryMap.minimumPrice).toFixed(2) : 0;
            let maxPrice;
            if (categoryMap.maximumPrice && categoryMap.maximumPrice > 0) {
                maxPrice = parseFloat(categoryMap.maximumPrice).toFixed(2);
            }
            else {
                maxPrice = 100000;
            }

            const productPrice = priceRange.price[0].replace(",", ".")

            if (productPrice >= minPrice && productPrice <= maxPrice) {
                return true
            }
            else {
                return false
            }
        }

        function filterImages(image) {
            if (image.images[0].image && image.images[0].image.length > 0) {
                return true 
            }
            else {
                return false
            }
        }

        return newData

    },

});