'use strict';

const Axios = require('axios');
// const Iconv = require('iconv').Iconv;
const iconv = require('iconv-lite');


module.exports = ({ strapi }) => ({

    async getOktabitData(entry, categoryMap) {
        try {
            let downloadingAllSuccess = true
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

            console.log("Ξεκινάω να κατεβάζω τα xml...")
            console.log("Downloading products...")
            const productsPrices = await this.getOktabitProductsXml(entry, 'prices_xml.asp?')
            if (productsPrices.message) {
                return { message: "Error" }
            }

            console.log("Downloading περιγραφές...")
            const productsDescriptions = await this.getOktabitProductsXml(entry, 'perigrafes_xml.asp?')

            console.log("Downloading χαρακτηριστικά αρχείο πρώτο...")
            const productsChars = await this.getOktabitProductsXml(entry, 'chars_xml.asp?')

            console.log("Downloading χαρακτηριστικά αρχείο δεύτερο...")
            const productsChars2 = await this.getOktabitProductsXml(entry, 'chars_xml2.asp?')

            console.log("Το downloading ολοκληρώθηκε.")


            console.log("Προϊόντα στο xml της Oktabit:", productsPrices.prices.product.length)
            // Φιλτράρω τα προϊόντα
            const availableProducts = this.filterData(productsPrices.prices.product, categoryMap)


            console.log("Προϊόντα μετά το φιλτράρισμα:", availableProducts.length)

            console.log("Ενοποίηση των xml...")
            for (let prod of availableProducts) {
                const product = {
                    supplierCode: prod.code[0].trim(),
                    category: { title: prod.category[0].trim() },
                    subcategory: { title: prod.subcategory[0].trim() },
                    sub2category: { title: null },
                    mpn: prod.part_no[0].trim().toString(),
                    name: prod.titlos[0].replace(/[^\x00-\x7F]/g, "").trim(),
                    wholesale: parseFloat(prod.timi[0].replace(',', '.')).toFixed(2),
                    retail_price: parseFloat(prod.lianiki[0].replace(',', '.')).toFixed(2),
                    stockLevel: prod.availability[0].trim(),
                    recycleTax: parseFloat(prod.anakykl[0].replace(',', '.')).toFixed(2),
                    brand_name: prod.brand[0].trim(),
                    barcode: prod.ean_code[0].trim()
                }

                if (productsDescriptions.message) {
                    downloadingAllSuccess = false
                    return { message: "Error" }
                }
                else {
                    const productDescription = productsDescriptions?.perigrafes.product.filter(x => x.code[0] === prod.code[0])

                    const stripContent = productDescription && productDescription[0]?.perigrafi[0].replace(/(<([^>]+)>)/ig, '').trim();

                    product.description = stripContent ? stripContent : ""
                }

                const chars = []
                if (productsChars.message) {
                    downloadingAllSuccess = false
                    return { message: "Error" }
                }
                else {
                    const productChars = productsChars?.data.chars.filter(x => x.product[0] === prod.code[0])

                    if (productChars) {
                        for (let productChar of productChars) {
                            const char = {}
                            char.name = productChar.atribute[0]
                            char.value = productChar.value[0]
                            chars.push(char)
                        }
                    }
                }

                if (productsChars2.message) {
                    downloadingAllSuccess = false
                    return { message: "Error" }
                }
                else {
                    const productChars2 = productsChars2?.data.chars.filter(x => x.product[0] === prod.code[0])

                    if (productChars2) {
                        for (let productChar of productChars2) {
                            const char = {}
                            char.name = productChar.atribute[0]
                            char.value = productChar.value[0]
                            chars.push(char)
                        }
                    }
                }

                if (chars.length > 0) {
                    const parsedChars = await strapi
                        .plugin('import-products')
                        .service('helpers')
                        .parseChars(chars, mapCharNames, mapCharValues)

                    product.prod_chars = parsedChars
                }

                const imageUrls = [{ url: `https://www.oktabit.gr/media/products/heroes/${product.supplierCode}/${product.supplierCode}.jpg` }]
                for (let j = 1; j < 5; j++) {
                    imageUrls.push({ url: `https://www.oktabit.gr/media/products/${product.supplierCode}/${product.supplierCode}_${j}.jpg` })
                }

                product.imagesSrc = imageUrls

                products.push(product)
            }
            console.log("Η ενοποίηση των xml ολοκληρώθηκε...")

            return { products, downloadingAllSuccess }
        } catch (error) {
            console.log(error)
        }
    },

    async getOktabitProductsXml(entry, xmlUrl) {
        try {
            const response = Axios.get(`${entry.importedURL}${xmlUrl}customercode=${process.env.OKTABIT_CUSTOMER_CODE}&logi=${process.env.OKTABIT_PASSWORD}`,
                {
                    responseType: 'arraybuffer'
                })

            const { data } = await response

            // const iconv = new Iconv('ISO-8859-7', 'UTF-8');
            // const newData = iconv.convert(await data);
            const utf8String = iconv.decode(Buffer.from(await data, 'binary'), 'ISO-8859-7');

            const xml = await strapi
                .plugin('import-products')
                .service('helpers')
                .parseXml(utf8String)

            return xml
        } catch (error) {
            return { message: "Error" }
        }
    },

    filterData(data, categoryMap) {

        const newData = data
            .filter(filterStock)
            .filter(filterPriceRange)
            .filter(filterCategories)

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

            const productPrice = priceRange.timi[0].replace(",", ".")

            if (productPrice >= minPrice && productPrice <= maxPrice) {
                return true
            }
            else {
                return false
            }
        }

        return newData

    },

});
