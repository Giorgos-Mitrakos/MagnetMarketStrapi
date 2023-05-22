'use strict';

const puppeteer = require('puppeteer');
const fs = require('fs');

module.exports = ({ strapi }) => ({

    async getLogicomData(entry, data, categoryMap) {
        try {


            // const data = await Axios.get(`${entry.importedURL}`,
            //     { headers: { "Accept-Encoding": "gzip,deflate,compress" } })

            // console.log(data.Pricelist.Items)

            const unique_product = {
                mpn: []
            }

            const availableProducts = this.filterData(data.Pricelist.Items[0].Item, categoryMap, unique_product)

            console.log("availableProducts:", availableProducts.length)
            return availableProducts
        } catch (error) {
            console.log(error)
        }
    },

    filterData(data, categoryMap, unique_product) {
        const newData = data
            .filter(filterUnique)
            .filter(filterStock)
            .filter(filterPriceRange)
            .filter(filterCategories)
        // .filter(filterImages)

        function filterUnique(unique) {
            if (unique_product.mpn.includes(unique.ItemCode[0].trim().toString())) {
                return false
            }
            else {
                unique_product.mpn.push(unique.ItemCode[0].trim().toString())
                return true
            }
        }

        function filterStock(stockName) {
            if (categoryMap.stock_map.length > 0) {
                let catIndex = categoryMap.stock_map.findIndex(x => x.name.trim() === stockName.StockLevel[0].trim())
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
            let category = cat.Cat1_Desc[0].trim()
            let subcategory = cat.Cat2_Desc[0] ? cat.Cat2_Desc[0].trim() : null
            let sub2category = cat.Cat3_Desc[0] ? cat.Cat3_Desc[0].trim() : null

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

            const productPrice = priceRange.NetPrice[0].replace(",", ".")

            if (productPrice >= minPrice && productPrice <= maxPrice) {
                return true
            }
            else {
                return false
            }
        }

        function filterImages(image) {
            if (image.PictureURL[0]) {
                return true
            }
            else {
                return false
            }
        }

        return newData

    },

    async scrapLogicom() {

        const browser = await strapi
            .plugin('import-products')
            .service('helpers')
            .createBrowser()

        const page = await browser.newPage();
        
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36");

        if (!fs.existsSync('./public/LogicomCookies.json')) {
            await this.saveLogicomCookies(page)
        }
        // await page.setRequestInterception(true)

        // page.on('request', (request) => {
        //     if (request.resourceType() === 'image') request.abort()
        //     else request.continue()
        // })

        try {

            // { headless: false, executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' }


            fs.readFile('./public/LogicomCookies.json', async (err, data) => {
                if (err)
                    console.log(err);
                else {
                    const cookies = JSON.parse(data);
                    await page.setCookie(...cookies);
                    // console.log("File readen successfully\n");
                }
            })

            await strapi
                .plugin('import-products')
                .service('helpers')
                .retry(
                    () => page.goto('https://logicompartners.com/el-gr/', { waitUntil: "networkidle0" }),
                    5, // retry this 5 times,
                    false
                );

            // await page.goto('https://logicompartners.com/el-gr/', { waitUntil: "networkidle0" });

            const pageUrl = page.url();

            if (pageUrl === "https://logicompartners.com/el-gr/countries") {

                this.saveLogicomCookies(page)
            }

            const acceptCookies = await page.waitForSelector('.btn-cookies-accept', { visible: true })
            if (acceptCookies) {
                await acceptCookies.click();
            }

            return {browser,page};

        } catch (error) {
            await browser.close();
        }
        // finally {
        //     await browser.close();
        // }
    },

    async scrapLogicomProduct(page,itemID) { 
        try { 
            const searchBox = await page.$('#searchbox')
            searchBox.type(`${itemID}`)
            await page.waitForResponse(response => response.status() === 200)
            const searchBoxUl = await page.waitForSelector('#ui-id-1', { visible: true })
            const searchBoxFirstLi = await searchBoxUl.$('li.ui-menu-item')

            const [response] = await Promise.all([
                // The promise resolves after navigation has finished
                searchBoxFirstLi.click('a'), // Clicking the link will indirectly cause a navigation
            ]);
            await page.waitForNavigation()

            const bodyHandle = await page.$('body');

            let scrap = await bodyHandle.evaluate(() => {
                let prod_chars = [];
                const prodSpecs = document.querySelector("#specifications");
                if (prodSpecs) {
                    const charTable = prodSpecs.querySelector("table");
                    const charTableBody = charTable.querySelector("tbody");
                    const charRows = charTableBody.querySelectorAll("tr");
                    for (let row of charRows) {
                        const charValue = row.querySelectorAll('td')
                        prod_chars.push({
                            name: charValue[0].innerHTML.trim(),
                            value: charValue[1].innerHTML.trim()
                        })
                    }
                }

                let imagesSrc = []
                // const detailsImg = document.querySelector("div.details-img")
                // const imageWrapper = detailsImg.querySelector("div")
                // const slickList = imageWrapper.querySelector("div")
                // const slickTrack = slickList.querySelector("div")
                const images = document.querySelectorAll("div.carousel-image-m-item>img")

                images.forEach(image => {
                    // if(image.getAttribute("src").split(".")[image.getAttribute("src").split(".").length-1]==="gif")
                    // continue;

                    if (imagesSrc.length < 5) {
                        if (imagesSrc.length === 0) {
                            imagesSrc.push(`https://www.logicompartners.com${image.getAttribute("src")}`);
                        }
                        else {
                            imagesSrc.push(`https://www.logicompartners.com${image.getAttribute("data-src")}`);
                        }
                    }
                })

                return { prod_chars, imagesSrc };
            }); 

            return { scrap, productUrl: page.url() }
        } catch (error) {
            console.log(error)
        } 
    },

    async saveLogicomCookies(page) { 
        try {
            // const browser = await puppeteer.launch({ headless: false, executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' });
            // const page = await browser.newPage();
            // await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36");

            let url = page.url()

            if(url!=='https://logicompartners.com/el-gr/countries')
            await page.goto('https://logicompartners.com/el-gr/countries', { waitUntil: "networkidle0" });
            

            await page.click('a[data-store="SanaStore_GR"]');
            await page.waitForNavigation()  

            const acceptCookies = await page.$('.btn-cookies-accept')
            await acceptCookies.click();

            const cookies = await page.cookies();
            const cookiesJson = JSON.stringify(cookies, null, 2)
            fs.writeFile('./public/LogicomCookies.json', cookiesJson, (err) => {
                if (err)
                    console.log(err);
                else {
                    // console.log("File written successfully\n");
                }
            });

            // await browser.close();

        } catch (error) {

        }
    },

});