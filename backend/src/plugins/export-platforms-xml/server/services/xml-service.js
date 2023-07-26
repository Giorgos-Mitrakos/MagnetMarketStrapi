'use strict';

const xml2js = require('xml2js');
const slugify = require("slugify");
const fs = require('fs');
const Axios = require('axios');
const { invert } = require('lodash');

module.exports = ({ strapi }) => ({
    async createXml(platform) {
        try {
            console.log(platform)

            const suppliers = await strapi.db.query('plugin::import-products.importxml').findMany({
                select: ['name', 'availability', 'order_time', 'shipping'],
            });

            const entries = await strapi.db.query('api::platform.platform').findOne({
                select: ['name', 'order_time'],
                where: {
                    name: platform
                },
                populate: {
                    export_categories: {
                        populate: {
                            cat_percentage: {
                                populate: {
                                    brand_perc:
                                    {
                                        populate: {
                                            brand: true
                                        }
                                    }
                                }
                            },
                            products: {
                                where: {
                                    $not: {
                                        publishedAt: null
                                    },
                                },
                                populate: {
                                    image: true,
                                    additionalImages: true,
                                    brand: true,
                                    supplierInfo: true,
                                    platform: true,
                                },
                            }
                        }
                    }
                },
            });

            let finalEntries = []

            switch (platform.toLowerCase()) {
                case "skroutz":
                    finalEntries = await this.createSkroutzXML(entries, suppliers)
                    break;
                case "shopflix":
                    finalEntries = await this.createShopflixXML(entries, suppliers)
                    break;

                default:
                    break;
            }


            // return xml;
        } catch (error) {
            console.log(error)
        }
    },

    async createSkroutzXML(entries, suppliers) {
        try {
            let finalEntries = []
            for (let category of entries.export_categories) {
                let categoryPath = await this.createCategoryPath(category)
                for (let product of category.products) {
                    let { cheaperAvailability, availability, price } = this.createAvailabilityAndPrice(product, suppliers, entries, category)

                    if (!price) { continue }
                    let newEntry = {
                        uniqueID: product.id,
                        name: product.name,
                        link: `https://magnetmarket.gr/product/${slugify(`${product.name.replaceAll("/", "-").replaceAll("|", "")}`, { lower: true, remove: /[^A-Za-z0-9-_.~-\s]*$/g })}`,
                        image: product.image ? `https://api.magnetmarket.eu/${product.image.url}` : "",
                        category: categoryPath,
                        price: parseFloat(price),
                        weight: product.weight,
                        availability,
                        manufacturer: product.brand ? product.brand?.name : "",
                        mpn: product.mpn,
                        sku: product.sku,
                        description: product.description,
                        quantity: product.inventory > 0 ? product.inventory
                            : (cheaperAvailability && cheaperAvailability.name.toLowerCase() === "globalsat" ? 1 : 2),
                        barcode: product.barcode,
                    }

                    finalEntries.push({ product: newEntry })
                }
            }

            var builder = new xml2js.Builder();
            let date = new Date()
            let createdAt = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`
            var xml = builder.buildObject({ webstore: { created_at: createdAt, products: [finalEntries] } });

            fs.writeFile('./public/feeds/Skroutz.xml', xml, (err) => {
                if (err)
                    console.log(err);
            })
            console.log(finalEntries.length);
            // return finalEntries
        } catch (error) {
            console.log(error)
        }
    },

    async createShopflixXML(entries, suppliers) {
        try {
            let finalEntries = []
            for (let category of entries.export_categories) {
                for (let product of category.products) {
                    let { cheaperAvailability, availability, price } = this.createAvailabilityAndPrice(product, suppliers, entries, category)
                    if (!price) { continue }
                    let newEntry = {
                        SKU: product.id,
                        name: product.name,
                        EAN: product.barcode ? product.barcode : `magnetmarket-${product.id}`,
                        MPN: product.mpn,
                        manufacturer: product.brand?.name,
                        description: product.description,
                        url: `https://magnetmarket.gr/product/${slugify(`${product.name.replaceAll("/", "-").replaceAll("|", "")}`, { lower: true, remove: /[^A-Za-z0-9-_.~-\s]*$/g })}`,
                        image: product.image ? `https://api.magnetmarket.eu/${product.image.url}` : "",
                        // additional_image: product.additionalImages ? `https://api.magnetmarket.eu/${product.additionalImages[0]}` : "",
                        category: category.name,
                        price: parseFloat(price),
                        list_price: '',
                        quantity: product.inventory > 0 ? product.inventory
                            : (cheaperAvailability && cheaperAvailability.name.toLowerCase() === "globalsat" ? 1 : 2),
                        offer_from: '',
                        offer_to: '',
                        offer_price: '',
                        offer_quantity: '',
                        shipping_lead_time: availability,
                    }

                    finalEntries.push({ product: newEntry })
                }

            }
            // console.log(finalEntries)
            var builder = new xml2js.Builder();
            let date = new Date()
            let createdAt = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`
            var xml = builder.buildObject({ MPITEMS: { created_at: createdAt, products: [finalEntries] } });

            fs.writeFile('./public/feeds/Shopflix.xml', xml, (err) => {
                if (err)
                    console.log(err);
            })
            console.log(finalEntries.length);
            // return finalEntries
        } catch (error) {
            console.log(error)
        }
    },

    async createCategoryPath(category) {
        try {
            const entry = await strapi.entityService.findOne('api::category.category', category.id, {
                fields: ['name'],
                populate: {
                    parents: {
                        populate: {
                            parents: {
                                populate: {
                                    parents: true
                                }
                            }
                        }
                    }
                },
            });

            let categoryPath = 'Αρχική σελίδα'
            let categoryPathArray = []

            function createPath(cat) {
                categoryPathArray.push(cat.name);
                if (cat.parents.length > 0) {
                    createPath(cat.parents[0])
                }
            }

            createPath(entry)

            for (let cat of categoryPathArray.reverse()) {
                categoryPath += `> ${cat}`;
            }

            return categoryPath
        } catch (error) {
            console.log(error)
        }
    },

    createAvailabilityAndPrice(product, suppliers, platform, category) {

        try {
            const availabilityAndPrice = {}

            if (product.inventory && product.inventory > 0) {
                if (platform.name.toLowerCase() === "skroutz") {
                    availabilityAndPrice.availability = "Διαθέσιμο από 1-3 ημέρες"
                }
                else {
                    availabilityAndPrice.availability = 0
                }
                availabilityAndPrice.price = this.createPrice(null, platform, product, null)

                return { availability: availabilityAndPrice.availability, price: availabilityAndPrice.price }
            }
            else {
                let availableSuppliers = product.supplierInfo.filter(x => x.in_stock === true)

                availableSuppliers.forEach(x => {
                    const supplierAvailability = suppliers.find(supplier => supplier.name === x.name)
                    x.availability = supplierAvailability.availability
                    x.order_time = supplierAvailability.order_time
                    x.shipping = supplierAvailability.shipping
                })

                const cheaperAvailability = availableSuppliers.reduce((previous, current) => {
                    let currentRecycleTax = current.recycle_tax ? parseFloat(current.recycle_tax).toFixed(2) : parseFloat(0)
                    let previousRecycleTax = previous.recycle_tax ? parseFloat(previous.recycle_tax).toFixed(2) : parseFloat(0)
                    let currentCost = parseFloat(current.wholesale).toFixed(2) + currentRecycleTax + parseFloat(current.shipping).toFixed(2)
                    let previousCost = parseFloat(previous.wholesale).toFixed(2) + previousRecycleTax + parseFloat(previous.shipping).toFixed(2)
                    if (parseFloat(currentCost).toFixed(2) <= parseFloat(previousCost).toFixed(2)) {
                        if (parseFloat(currentCost).toFixed(2) === parseFloat(previousCost).toFixed(2)) {
                            if (current.availability < previous.availability) {
                                return current
                            }
                            return previous
                        }
                        return current
                    }
                    return previous;
                });

                let availability = this.createAvailability(cheaperAvailability, platform, product)

                let price = this.createPrice(cheaperAvailability, platform, product, category)

                return { cheaperAvailability, availability, price }
            }
        } catch (error) {
            console.log(error)
        }
    },

    createAvailability(fasterAvailability, platform, product) {
        const platformName = platform.name.toLowerCase()
        let availability = ""

        if (product.inventory && product.inventory > 0) {
            if (platform.name.toLowerCase() === "skroutz") { availability = "Διαθέσιμο από 1-3 ημέρες" }
            else {
                availability = 0
            }
            return availability
        }

        var minutesOfDay = function (m) {
            return m.getMinutes() + m.getHours() * 60;
        }

        let date = new Date()

        let platformTime = new Date()
        platformTime.setHours(platform.order_time?.split('.')[0].split(':')[0])
        platformTime.setMinutes(platform.order_time?.split('.')[0].split(':')[1])

        let orderTime = new Date()
        orderTime.setHours(fasterAvailability.order_time?.split('.')[0].split(':')[0])
        orderTime.setMinutes(fasterAvailability.order_time?.split('.')[0].split(':')[1])

        if (fasterAvailability.availability < 2) {
            if (minutesOfDay(orderTime) > minutesOfDay(date) || minutesOfDay(platformTime) < minutesOfDay(date)) {
                if (platformName === "skroutz") { availability = "Διαθέσιμο από 1-3 ημέρες" }
                else {
                    availability = fasterAvailability.availability
                }
            }
            else {
                if (platformName === "skroutz") { availability = "Διαθέσιμο από 4-10 ημέρες" }
                else {
                    availability = fasterAvailability.availability + 1
                }
            }
        }
        else if (fasterAvailability.availability < 5) {
            if (platformName === "skroutz") { availability = "Διαθέσιμο από 4-10 ημέρες" }
            else {
                availability = fasterAvailability.availability + 1
            }
        }
        else {
            if (platformName === "skroutz") { availability = "Διαθέσιμο από 10 έως 30 ημέρες" }
            else {
                availability = fasterAvailability.availability + 1
            }
        }
        return availability
    },

    createPrice(supplierInfo, platform, product, categoryInfo) {
        try {

            // let productPlatformPrice = { price: product.price }            
            if (product.platform) {
                let productPlatform = product.platform.find(x => x.platform.toLowerCase().trim() === platform.name.toLowerCase().trim())
                if (productPlatform && productPlatform.price) {
                    return productPlatform.price
                } 
            } 
            return product.price

            // if (product.inventory && product.inventory > 0) {
            //     return productPlatformPrice.price
            // }

            // const generalCategoryPercentage = process.env.GENERAL_CATEGORY_PERCENTAGE
            // const taxRate = process.env.GENERAL_TAX_RATE
            // let addToPrice = Number(process.env.GENERAL_SHIPPING_PRICE)

            // let generalPercentage = ''
            // if (categoryInfo.cat_percentage && categoryInfo.cat_percentage.length > 0) {

            //     let findPercentage = categoryInfo.cat_percentage.find(x => x.name?.toLowerCase() === platform.name.toLowerCase())

            //     if (!findPercentage) {
            //         findPercentage = categoryInfo.cat_percentage.find(x => x.name.toLowerCase() === "general")
            //     }

            //     if (findPercentage) { 
            //         addToPrice = findPercentage.add_to_price ? findPercentage.add_to_price : 0;
            //         if (findPercentage.brand_perc && findPercentage.brand_perc.length > 0) {

            //             let findBrandPercentage = findPercentage.brand_perc.find(x => x.brand.id === product.brand.id)
            //             if (findBrandPercentage) {

            //                 generalPercentage = findBrandPercentage.percentage
            //             }
            //             else {
            //                 generalPercentage = findPercentage.percentage
            //             }
            //         }
            //         else {
            //             generalPercentage = findPercentage.percentage
            //         }
            //     }
            //     else {
            //         generalPercentage = generalCategoryPercentage
            //     }
            // }
            // else {
            //     generalPercentage = generalCategoryPercentage
            // }

            // let minPrice = (parseFloat(supplierInfo.wholesale) + parseFloat(addToPrice) + parseFloat(supplierInfo.shipping)) * (taxRate / 100 + 1) * (generalPercentage / 100 + 1)

            // if (minPrice > productPlatformPrice.price) {
            //     return minPrice.toFixed(2)
            // }
            // else {
            //     return productPlatformPrice.price
            // }

        } catch (error) {
            console.log(error)
        }
    },

    // async createExcel() {

    //     try {

    //         let data = await Axios.get("https://magnetmarket.gr/products.xml",
    //             { headers: { "Accept-Encoding": "gzip,deflate,compress" } })

    //         // console.log(data.data)

    //         const oldXml = await strapi
    //             .plugin('import-products') 
    //             .service('helpers')
    //             .parseXml(await data.data)

    //         // console.log(oldXml)

    //         let newdata = await Axios.get("https://api.magnetmarket.eu/feeds/Shopflix.xml",
    //             { headers: { "Accept-Encoding": "gzip,deflate,compress" } })

    //         // console.log(newdata)

    //         const newXml = await strapi
    //             .plugin('import-products')
    //             .service('helpers')
    //             .parseXml(await newdata.data)

    //         const products = []
    //         newXml.MPITEMS.products[0].product.forEach(element => {
    //             // console.log(element)
    //             let old = oldXml.MPITEMS.products[0].product.find(old => old.MPN[0] === element.MPN[0])

    //             if (old) {
    //                 let checked = {
    //                     oldSKU: old.SKU[0],
    //                     newSKU: element.SKU[0],
    //                     oldEAN: old.EAN[0],
    //                     newEAN: element.EAN[0]
    //                 }

    //                 products.push({ product: checked })
    //             }

    //         });

    //         var builder = new xml2js.Builder();
    //         let date = new Date()
    //         let createdAt = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`
    //         var xml = builder.buildObject({ webstore: { products: [products] } });

    //         fs.writeFile('./public/feeds/ShopflixCompare.xml', xml, (err) => {
    //             if (err)
    //                 console.log(err);
    //         })
    //         // console.log(finalEntries.length);
    //     } catch (error) {
    //         console.log(error)
    //     }
    // },

});
