'use strict';

const Axios = require('axios');
const fs = require('fs');

module.exports = ({ strapi }) => ({

    async getDotMediaData(entry, categoryMap) {
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

            // console.log("Προϊόντα στο xml της DotMedia:", xml.NewDataSet.table1)
            console.log("Προϊόντα στο xml της DotMedia:", xml.NewDataSet.table1.length)
            // console.log("Προϊόντα στο xml της DotMedia:", xml.products.product.length)
            // Φιλτράρω τα προϊόντα
            const availableProducts = this.filterData(xml.NewDataSet.table1, categoryMap)

            console.log("Προϊόντα μετά το φιλτράρισμα:", availableProducts.length)

            return availableProducts
        } catch (error) {
            console.log(error)
        }
    },

    filterData(data, categoryMap) {

        const newData = data
            .filter(filterStock)
            // .filter(filterPriceRange)
            .filter(filterCategories)
            .filter(filterImages)

        function filterStock(stockName) {
            if (categoryMap.stock_map.length > 0) {
                let catIndex = categoryMap.stock_map.findIndex(x => stockName.Availability[0].trim() === x.name.trim())
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
                    let catIndex = categoryMap.whitelist_map.findIndex(x => x.name.trim() === cat.Category[0].trim())
                    if (catIndex !== -1) {
                        if (categoryMap.whitelist_map[catIndex].subcategory.length > 0) {
                            let subIndex = categoryMap.whitelist_map[catIndex].subcategory.findIndex(x => x.name.trim() === cat.SubCategory[0].trim())
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
                    let catIndex = categoryMap.blacklist_map.findIndex(x => x.name.trim() === cat.Category[0].trim())
                    if (catIndex !== -1) {
                        if (categoryMap.blacklist_map[catIndex].subcategory.length > 0) {
                            let subIndex = categoryMap.blacklist_map[catIndex].subcategory.findIndex(x => x.name.trim() === cat.SubCategory[0].trim())
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
            if ((image.ImageLink && image.ImageLink[0] !== "")
                || (image.ImageLink2 && image.ImageLink2[0] !== "")
                || (image.ImageLink3 && image.ImageLink3[0] !== "")) {
                return true
            }
            else {
                return false
            }
        }

        return newData

    },

    async saveDotMediaCookies(page) {
        try {
            const pageBody = await page.$('body');
            const username = await pageBody.$('#ctl00_cphLogin_ztUser');
            const password = await pageBody.$('#ctl00_cphLogin_ztPwd');
            await username.type(process.env.DOTMEDIA_USERNAME)
            await password.type(process.env.DOTMEDIA_PASSWORD)
            const submitLogin = await pageBody.$('#ctl00_cphLogin_btnLogin')

            await Promise.all([
                submitLogin.click('#loginSubmit'),
                page.waitForSelector('#ctl00_cphLogin_ztLoginMes'),
            ]);

            const cookies = await page.cookies();
            const cookiesJson = JSON.stringify(cookies, null, 2)
            fs.writeFile('./public/DotMediaCookies.json', cookiesJson, (err) => {
                if (err)
                    console.log(err);
                else {
                    console.log("File written successfully\n");
                }
            });

            return await page

        } catch (error) {
            console.log(error)
        }
    },

    async loginToDotMedia(browser) {

        try {
            let page = await browser.newPage();
            await page.setViewport({ width: 1200, height: 500 })
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36");

            if (fs.existsSync('./public/DotMediaCookies.json')) {
                fs.readFile('./public/DotMediaCookies.json', async (err, data) => {
                    if (err)
                        console.log(err);
                    else {
                        const cookies = JSON.parse(data);
                        await page.setCookie(...cookies);
                        console.log("File readen successfully\n");
                    }
                })
            }

            await strapi
                .plugin('import-products')
                .service('helpers')
                .retry(
                    () => page.goto('https://www.dot-media.gr/index.aspx', { waitUntil: "networkidle0" }),
                    10 // retry this 5 times
                );

            const pageBody = await page.$('body');
            const loginMessage = await pageBody.$('#ctl00_cphLogin_ztLoginMes')

            if (!loginMessage || !loginMessage.innerHTML) {
                await this.saveDotMediaCookies(page)
            }

            await page.waitForTimeout(1500)

        } catch (error) {
            console.log(error)
        }
    },

    async getPrices(wholesale, suggestedRetailPrice, suggestedWebPrice, link, browser) {

        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 500 })
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36");

        await page.waitForTimeout(strapi 
            .plugin('import-products')
            .service('helpers') 
            .randomWait(2000, 5000))
        try {
            if (parseFloat(wholesale) > 0) {
                return { initial_wholesale: null, wholesale }
            }
            else {
                await strapi
                    .plugin('import-products')
                    .service('helpers')
                    .retry(
                        () => page.goto(link, { waitUntil: "networkidle0" }),
                        10 // retry this 5 times
                    );

                await page.waitForTimeout(1500)

                const scrapProduct = await page.evaluate(() => {
                    let prices = {}
                    const priceWrapper = document.querySelector('#ctl00_cphProductData_zlTmonTel')
                    const priceSpans = priceWrapper.querySelectorAll('#ctl00_cphProductData_zlTmonTel>span');
                    if (priceSpans.length === 2) {
                        prices.initial_wholesale = priceSpans[0].textContent.replace(",", ".")
                        prices.wholesale = priceSpans[1].textContent.replace(",", ".")
                    }
                    else {
                        prices.wholesale = priceSpans[0].textContent.replace(",", ".")
                    }
                    return { prices } 
                })
                
                return { initial_wholesale: scrapProduct.prices.initial_wholesale, wholesale: scrapProduct.prices.wholesale }
            }

        } catch (error) {
            console.log(error)
        }
        finally {
            await page.close()
        }
    }

});
