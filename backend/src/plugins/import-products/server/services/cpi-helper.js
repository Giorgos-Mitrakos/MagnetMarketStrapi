'use strict';

const Axios = require('axios');

module.exports = ({ strapi }) => ({

    async getCpiData(entry, categoryMap) {
        try {
            const { categories_map, char_name_map, char_value_map, stock_map,
                isWhitelistSelected, whitelist_map, blacklist_map,
                xPath, minimumPrice, maximumPrice } = categoryMap

            // // console.log("newData:", newData.length)
            // const charMaps = await strapi
            //     .plugin('import-products')
            //     .service('helpers')
            //     .parseCharsToMap(char_name_map, char_value_map);

            // const { mapCharNames, mapCharValues } = charMaps

            // const products = []

            const data = await Axios.get(`${entry.importedURL}`,
                { headers: { "Accept-Encoding": "gzip,deflate,compress" } })

            const xPathFilter = await strapi
                .plugin('import-products')
                .service('helpers')
                .xPathFilter(await data, entry);

            const xml = await strapi
                .plugin('import-products')
                .service('helpers').parseXml(xPathFilter)

            const unique_product = {
                mpn: []
            }

            console.log(xml.STOREITEMS.CREATED[0].PRODUCT.length)

            const availableProducts = this.filterData(xml.STOREITEMS.CREATED[0].PRODUCT, categoryMap, unique_product)

            console.log(availableProducts.length)
            return availableProducts
        } catch (error) {
            console.log(error)
        }
    },

    filterData(data, categoryMap, unique_product) {

        const newData = data
            .filter(filterUnique)
            .filter(filterStock)
            .filter(filterCategories)
            .filter(filterPriceRange)
            .filter(filterImages)

        function filterUnique(unique) {
            if (unique_product.mpn.includes(unique.mpn[0].trim().toString())) {
                return false
            }
            else {
                unique_product.mpn.push(unique.mpn[0].trim().toString())
                return true
            }
        }

        function filterStock(stockName) {
            if (categoryMap.stock_map.length > 0) {
                let catIndex = categoryMap.stock_map.findIndex(x => x.name.trim() === stockName.availability[0].trim())
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
            let category = cat.CATEGORY[0].split(" / ")[0].trim()
            let subcategory = cat.CATEGORY[0].split(" / ")[1] ? cat.CATEGORY[0].split(" / ")[1].trim() : null
            let sub2category = cat.CATEGORY[0].split(" / ")[2] ? cat.CATEGORY[0].split(" / ")[2].trim() : null

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

            let minPrice = categoryMap.minimumPrice ? parseFloat(categoryMap.minimumPrice) : 0;
            let maxPrice;
            if (categoryMap.maximumPrice && categoryMap.maximumPrice > 0) {
                maxPrice = parseFloat(categoryMap.maximumPrice);
            }
            else {
                maxPrice = 100000;
            }

            const productPrice = parseFloat(priceRange.b2bprice[0].replace(".", "").replace(",", "."))

            if (productPrice >= minPrice && productPrice <= maxPrice) {
                return true
            }
            else {
                return false
            }
        }

        function filterImages(image) {
            if (image.image[0]) {
                return true
            }
            else {
                return false
            }
        }

        return newData

    },

});