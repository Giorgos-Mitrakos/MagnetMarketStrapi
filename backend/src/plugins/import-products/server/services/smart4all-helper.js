'use strict';

const Axios = require('axios');
const xlsx = require('xlsx')

module.exports = ({ strapi }) => ({

    async getSmart4AllData(entry, categoryMap) {
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

            const xPathFilter = await strapi
                .plugin('import-products')
                .service('helpers')
                .xPathFilter(await data, entry);

            const xml = await strapi
                .plugin('import-products')
                .service('helpers')
                .parseXml(await data.data)

            //Διαβάζω τις πληροφορίες από το excel ώστε να τις χρησιμοποιή
            const wb = xlsx.readFile(`./public${entry.importedFile.url}`)
            const ws = wb.SheetNames
            let excel = []
            ws.forEach(x => {
                if (x !== "Φύλλο") {
                    const sheet = wb.Sheets[x]
                    const products = xlsx.utils.sheet_to_json(sheet)
                    // console.log(products)
                    excel = excel.concat(products)
                }
            })

            const productsInExcel = excel.filter(x => {                
                if (x["EAN"] !== undefined && !isNaN(x["EAN"])) {
                    return true
                }
            }).filter(x => {
                if (x["EAN"] !== "") {
                    return true
                }
            })

            // console.log(xml.mywebstore.products[0].product)
            const availableProducts = this.filterData(xml.mywebstore.products[0].product, categoryMap)

            console.log(availableProducts.length)
            return { products: availableProducts, productsInExcel }
        } catch (error) {
            console.log(error)
        }
    },

    filterData(data, categoryMap) {

        const unique_product = []
        const not_unique_product = []

        // console.log(data)
        const newData = data
            // .filter(filterUnique)
            .filter(filterStock)
            .filter(filterPriceRange)
            .filter(filterCategories)
            .filter(filterImages)
            .filter(filterEmptyEAN)
        // .filter(filterRemoveDup)

        function filterUnique(unique) {
            if (unique_product.includes(unique.mpn[0].trim().toString())) {
                not_unique_product.push(unique.mpn[0].trim().toString())
                return false
            }
            else {
                unique_product.push(unique.mpn[0].trim().toString())
                return true
            }
        }

        function filterRemoveDup(unique) {
            if (not_unique_product.includes(unique.mpn[0].trim().toString())) {
                return false
            }
            else {
                return true
            }
        }

        function filterEmptyEAN(product) {

            if (product.BARCODE[0]) {
                return true
            }
        }

        function filterStock(stockName) {
            if (categoryMap.stock_map.length > 0) {
                let catIndex = categoryMap.stock_map.findIndex(x => stockName.AVAILABILITY[0].trim() === x.name.trim())
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
            let categories = cat.CATEGORY[0].split(">")
            let category = categories[0] ? categories[0].trim() : null
            let subcategory = categories[1] ? categories[1].trim() : null
            let sub2category = categories[2] ? categories[2].trim() : null

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

            const productPrice = parseFloat(priceRange.WHOLESALE_PRICE[0].replace(".", "").replace(",", "."))

            if (productPrice !== parseFloat(0) && productPrice >= minPrice && productPrice <= maxPrice) {
                return true
            }
            else {
                return false
            }
        }

        function filterImages(image) {
            if (image.IMAGE[0]) {
                return true
            }
            else {
                return false
            }
        }

        return newData

    },

});