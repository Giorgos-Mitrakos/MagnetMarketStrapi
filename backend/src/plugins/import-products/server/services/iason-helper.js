'use strict';

const Axios = require('axios');
const userAgent = require('user-agents');

module.exports = ({ strapi }) => ({

    async getIasonData(entry, data, categoryMap) {
        try {

            // console.log(data.products.product)
            // const data = await Axios.get(`${entry.importedURL}`,
            //     { headers: { "Accept-Encoding": "gzip,deflate,compress" } })

            // console.log(data.Pricelist.Items)

            const unique_product = {
                mpn: []
            }

            const availableProducts = this.filterData(data.products.product, categoryMap, unique_product)

            console.log("availableProducts:", availableProducts.length)
            return availableProducts
        } catch (error) {
            console.log(error)
        }
    },
    // async getIasonData(entry, categoryMap) {
    //     const browser = await strapi
    //         .plugin('import-products')
    //         .service('helpers')
    //         .createBrowser()

    //     try {
    //         const { categories_map, char_name_map, char_value_map, stock_map,
    //             isWhitelistSelected, whitelist_map, blacklist_map,
    //             xPath, minimumPrice, maximumPrice } = categoryMap

    //         const page = await browser.newPage();
    //         await page.setViewport({ width: 1400, height: 600 })
    //         await page.setUserAgent(userAgent.random().toString())
    //         // await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36");

    //         // await page.setRequestInterception(true)

    //         // page.on('request', (request) => {
    //         //     if (request.resourceType() === 'image') request.abort()
    //         //     else request.continue()
    //         // })

    //         await strapi
    //             .plugin('import-products')
    //             .service('helpers')
    //             .retry(
    //                 () => page.goto('https://www.iason.gr/customer/account/login', { waitUntil: "networkidle0" }),
    //                 5, // retry this 5 times,
    //                 false
    //             );


    //         await page.waitForTimeout(Math.random() * (2000 - 500) + 500)
    //         await page.mouse.move(Math.random() * 1000, Math.random() * 1000);
    //         await page.mouse.click(Math.random() * 1000, Math.random() * 1000);

    //         const bodyHandle = await page.$('body');


    //         const username = await bodyHandle.$('#email');
    //         const customerUsername = await bodyHandle.$('#customer-email');
    //         const password = await bodyHandle.$('#login-form.form-login>fieldset>div>div>#pass');
    //         const button = await bodyHandle.$('#login-form.form-login>fieldset>div>div>#send2');

    //         await bodyHandle.evaluate(() => {
    //             const element = document.querySelector('#email');
    //             element.scrollIntoView({ behavior: 'smooth' })
    //         });


    //         await username.click()
    //         await page.waitForTimeout(Math.random() * (2000 - 500) + 500)
    //         await username.type(process.env.IASON_USERNAME, { delay: Math.random() * 100 })
    //         // await customerUsername.type(process.env.IASON_USERNAME, { delay: 200 })
    //         await password.click()
    //         await page.waitForTimeout(Math.random() * (2000 - 500) + 500)
    //         await password.type(process.env.IASON_PASSWORD, { delay: Math.random() * 100 })

    //         await page.waitForTimeout(Math.random() * (2000 - 500) + 500)

    //         await Promise.all([
    //             await button.click(),
    //             await page.waitForNavigation({
    //                 waitUntil: 'networkidle0',
    //             })
    //         ])

    //         const pageUrl = page.url();
    //         await page.waitForTimeout(1500)
    //         if (pageUrl === "https://www.iason.gr/customer/account/") {
    //             await page.cookies()
    //                 .then((cookies) => {
    //                     const cookiesJson = JSON.stringify(cookies, null, 2)
    //                     return cookiesJson
    //                 })
    //                 .then((cookiesJson) => {
    //                     fs.writeFile('./public/IasonCookies.json', cookiesJson, (err) => {
    //                         if (err)
    //                             console.log(err);
    //                         else {
    //                             console.log("File written successfully\n");
    //                         }
    //                     })
    //                 })
    //                 .catch((error) => console.log(error))
    //         }

    //         await page.screenshot({ path: "./public/tmp/test.jpg" })
    //         // // console.log("newData:", newData.length)
    //         // const charMaps = await strapi
    //         //     .plugin('import-products')
    //         //     .service('helpers')
    //         //     .parseCharsToMap(char_name_map, char_value_map);

    //         // const { mapCharNames, mapCharValues } = charMaps

    //         // const products = []


    //         // const data = await Axios.get(`${entry.importedURL}`,
    //         //     {
    //         //         headers: {
    //         //             "Accept-Encoding": "gzip,deflate,compress",
    //         //             Connection: "keep-alive",
    //         //             Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    //         //             Cookie: "PHPSESSID=amgeme6hr6l8k4fc08v91e735t;"
    //         //         }
    //         //     })

    //         // console.log("data", data)
    //         // const xPathFilter = await strapi
    //         //     .plugin('import-products')
    //         //     .service('helpers')
    //         //     .xPathFilter(await data, entry);

    //         // const xml = await strapi
    //         //     .plugin('import-products')
    //         //     .service('helpers').parseXml(xPathFilter)

    //         // const unique_product = {
    //         //     mpn: []
    //         // }

    //         // console.log(xml)

    //         // console.log(xml.mywebstore.products[0].product[0])

    //         // const availableProducts = this.filterData(xml.products.product[0], categoryMap, unique_product)

    //         // // console.log(availableProducts.length)
    //         // return availableProducts
    //     } catch (error) {
    //         console.log(error)
    //     }
    // },

    filterData(data, categoryMap, unique_product) {

        const newData = data
            // .filter(filterUnique)
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
                let catIndex = categoryMap.stock_map.findIndex(x => x.name.trim() <= stockName.quantity[0]._.trim())
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
            const categoryDepth = cat.category[0]._.split(">").length
            
            if (categoryDepth === 0) {
                return false
            }
            let category = cat.category[0]._.split(">")[0].trim()
            let subcategory = categoryDepth - 2 > -1 ? cat.category[0]._.split(">")[1].trim() : null
            let sub2category = categoryDepth - 3 > -1 ? cat.category[0]._.split(">")[2].trim() : null

            // if(category==="Αναλώσιμα εκτυπωτών" && subcategory==="Ανταλλακτικά")
            // {
            //     console.log(cat.category[0]._)
            // }
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

            const productPrice = parseFloat(priceRange.price[0]._.replace(",", "."))

            if (productPrice >= minPrice && productPrice <= maxPrice) {
                return true
            }
            else {
                return false
            }
        }

        function filterImages(image) {
            if (image["image-url"][0]._) {
                return true
            }
            else {
                return false
            }
        }

        return newData

    },

});