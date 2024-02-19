'use strict';

const Axios = require('axios');

module.exports = ({ strapi }) => ({

    async getAciCatalog(entry, categoryMap) {
        try {
            const data = await Axios.post(`https://www.acihellas.gr/api/customerprices`,
                {
                    email: process.env.ACI_USERNAME,
                    password: process.env.ACI_PASSWORD,
                    english: false
                }
                ,
                {
                    headers: {
                        "Accept-Encoding": "gzip,deflate,compress",
                        "Accept": "application/json",
                        "Content-type": "application/x-www-form-urlencoded"
                    },
                })

            if (data.data.Success === 0)
                return []

            const unique_product = {
                mpn: []
            }
            console.log(data.data.Data.length)

            const availableProducts = this.filterData(data.data.Data, categoryMap, unique_product)
            console.log(availableProducts.length)
            return availableProducts
        } catch (error) {
            console.log(error)
        }
    },

    async getAciAvailability({ entry, auth }) {
        try {
            const importRef = await strapi
                .plugin('import-products')
                .service('helpers')
                .createImportRef(entry);

            if (!entry.isActive) {
                await strapi
                    .plugin('import-products')
                    .service('helpers')
                    .deleteEntry(entry, importRef);
            }
            else {
                const data = await Axios.post(`https://www.acihellas.gr/api/stockquantities`,
                    {
                        email: process.env.ACI_USERNAME,
                        password: process.env.ACI_PASSWORD,
                        english: false
                    }
                    ,
                    {
                        headers: {
                            "Accept-Encoding": "gzip,deflate,compress",
                            "Accept": "application/json",
                            "Content-type": "application/x-www-form-urlencoded"
                        },
                    })

                const products = data.data.Data
                    .filter(filterStock)

                if (products.length === 0)
                    return { "message": "xml is empty" }

                for (let dt of products) {

                    const checkIfEntry = await strapi.db.query('api::product.product').findOne({
                        where: {
                            supplierInfo: {
                                $and: [
                                    { name: entry.name },
                                    { supplierProductId: dt.Code.trim() }
                                ]
                            }
                        }
                    });

                    if (checkIfEntry)
                        importRef.related_entries.push(checkIfEntry.id)

                }

                await strapi
                    .plugin('import-products')
                    .service('helpers')
                    .deleteEntry(entry, importRef);
            }
            console.log("End of Import")
            return { "message": "ok" }

            function filterStock(stockName) {
                if (importRef.categoryMap.stock_map.length > 0) {
                    let catIndex = importRef.categoryMap.stock_map.findIndex(x => x.name.trim() === stockName.Availability.trim())
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
        } catch (error) {
            console.log(error)
        }
    },

    async getAciAttributes({ entry, auth }) {
        try {
            const importRef = await strapi
                .plugin('import-products')
                .service('helpers')
                .createImportRef(entry);

            if (!entry.isActive) {
                await strapi
                    .plugin('import-products')
                    .service('helpers')
                    .deleteEntry(entry, importRef);
            }
            else {
                const data = await Axios.post(`https://www.acihellas.gr/api/productspecs `,
                    {
                        email: process.env.ACI_USERNAME,
                        password: process.env.ACI_PASSWORD,
                        english: false
                    }
                    ,
                    {
                        headers: {
                            "Accept-Encoding": "gzip,deflate,compress",
                            "Accept": "application/json",
                            "Content-type": "application/x-www-form-urlencoded"
                        },
                    })

                const products = data.data.Data

                if (products.length === 0)
                    return { "message": "xml is empty" }

                const { mapCharNames, mapCharValues } = importRef.charMaps

                for (let dt of products) {

                    const checkIfEntry = await strapi.db.query('api::product.product').findOne({
                        where: {
                            supplierInfo: {
                                $and: [
                                    { name: entry.name },
                                    { supplierProductId: dt.Code.trim() }
                                ]
                            }
                        },
                        populate: {
                            prod_chars: true
                        },
                    });

                    if (checkIfEntry && checkIfEntry.prod_chars.length === 0) {
                        if (dt.Specs.length > 0) {
                            let chars = []
                            for (let productChar of dt.Specs) {
                                const char = {}
                                char.name = productChar.Name
                                char.value = productChar.Value.replace("\r", "")
                                chars.push(char)
                            }

                            const parsedChars = await strapi
                                .plugin('import-products')
                                .service('helpers')
                                .parseChars(chars, mapCharNames, mapCharValues)
                            console.log(parsedChars)
                            await strapi.entityService.update('api::product.product', checkIfEntry.id, {
                                data: { prod_chars: parsedChars }
                            });

                            importRef.updated += 1
                        }
                    }
                    importRef.related_entries.push(checkIfEntry.id)

                    // console.log(checkIfEntry)

                }
            }
            console.log("End of Import")
            return { "message": "ok" }
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
            if (unique.OEM & unique_product.mpn.includes(unique.OEM)) {
                return false
            }
            else {
                unique_product.mpn.push(unique.OEM)
                return true
            }
        }

        function filterStock(stockName) {
            if (categoryMap.stock_map.length > 0) {
                let catIndex = categoryMap.stock_map.findIndex(x => x.name.trim() === stockName.Availability.trim())
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
            let category = cat.Category
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

            const productPrice = parseFloat(priceRange.Price)

            if (productPrice >= minPrice && productPrice <= maxPrice) {
                return true
            }
            else {
                return false
            }
        }

        function filterImages(image) {
            if (image.pictureURL) {
                return true
            }
            else {
                return false
            }
        }

        return newData

    },

});