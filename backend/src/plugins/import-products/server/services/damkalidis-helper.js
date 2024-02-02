'use strict';

const Axios = require('axios');

module.exports = ({ strapi }) => ({

    async getDamkalidisData(entry, categoryMap) {
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
                { headers: { "Accept-Encoding": "gzip,deflate,compress",
                Cookie:"_ga=GA1.2.1757796196.1661878350; _ga_KEWFNXZ9PK=GS1.2.1704478787.16.1.1704478832.15.0.0; language=el-gr; currency=EUR; OCSESSID=e5ed6636f192663fd1e4b222cd; _gid=GA1.2.1385083295.1704478786" } })


            const xPathFilter = await strapi
                .plugin('import-products')
                .service('helpers')
                .xPathFilter(await data, entry);

            const xml = await strapi
                .plugin('import-products')
                .service('helpers').parseXml(xPathFilter)

            // console.log(xml)
            // const unique_product = {
            //     mpn: []
            // }

            console.log(xml.PRODUCTS.PRODUCT[245])

            const availableProducts = this.filterData(xml.PRODUCTS.PRODUCT, categoryMap)

            console.log(availableProducts.length)
            // return availableProducts
        } catch (error) {
            console.log(error)
        }
    },

    filterData(data, categoryMap) {

        const newData = data
            // .filter(filterUnique)
            .filter(filterStock)
            .filter(filterCategories)
        // .filter(filterPriceRange)
        // .filter(filterImages)

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
                let catIndex = categoryMap.stock_map.findIndex(x => x.name.trim() === stockName.AVAIL[0].trim())
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
            let category = cat.PRCATEGORIES[0].trim()
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