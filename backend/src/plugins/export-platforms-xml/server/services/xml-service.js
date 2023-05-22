'use strict';

const xml2js = require('xml2js');
const slugify = require("slugify");
const fs = require('fs');

module.exports = ({ strapi }) => ({
    async createXml(platform) {
        try {
            console.log(platform)

            const suppliers = await strapi.db.query('plugin::import-products.importxml').findMany({
                select: ['name', 'availability', 'order_time'],
            });

            const entries = await strapi.db.query('api::platform.platform').findOne({
                select: ['name', 'order_time'],
                where: {
                    name: platform
                },
                populate: {
                    export_categories: {
                        populate: {
                            cat_percentage: true,
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
                                }
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
                    let { availability, price } = this.createAvailabilityAndPrice(product, suppliers, entries, category)
                    let newEntry = {
                        uniqueID: product.id,
                        name: product.name,
                        link: `https://magnetmarket.gr/product/${slugify(`${product.name.replaceAll("/", "-").replaceAll("|", "")}`, { lower: true, remove: /[^A-Za-z0-9-_.~-\s]*$/g })}`,
                        image: product.image ? `https://api.magnetmarket.eu/${product.image.url}` : "",
                        category: categoryPath,
                        price,
                        availability,
                        manufacturer: product.brand ? product.brand?.name : "",
                        mpn: product.mpn,
                        sku: product.sku,
                        description: product.description,
                        // quantity: entry.quantity,
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
                    let { availability, price } = this.createAvailabilityAndPrice(product, suppliers, entries, category)
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
                        price,
                        list_price: '',
                        quantity: 2,
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
                categoryPath += `, ${cat}`;
            }

            return categoryPath
        } catch (error) {
            console.log(error)
        }
    },

    createAvailabilityAndPrice(product, suppliers, platform, category) {

        // console.log(platform)
        let availableSuppliers = product.supplierInfo.filter(x => x.in_stock === true)

        availableSuppliers.forEach(x => {
            const supplierAvailability = suppliers.find(supplier => supplier.name === x.name)
            x.availability = supplierAvailability.availability
            x.order_time = supplierAvailability.order_time
        })

        const fasterAvailability = availableSuppliers.reduce((previous, current) => {
            if (current.availability <= previous.availability) {
                if (current.availability = previous.availability) {
                    if (current.wholesale < previous.wholesale) {
                        return current
                    }
                    return previous
                }
                return current
            }
            return previous;
        });

        let availability = this.createAvailability(fasterAvailability, platform, product)

        let price = this.createPrice(fasterAvailability, platform, product, category)

        return { availability, price }
    },

    createAvailability(fasterAvailability, platform, product) {
        const platformName = platform.name.toLowerCase()
        let availability = ""

        if (product.inventory && product.inventory > 0) {
            if (platform.name === "skroutz") { availability = "Διαθέσιμο από 1-3 ημέρες" }
            else {
                availability = 0
            }
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
            // console.log(supplierInfo)
            const generalCategoryPercentage = process.env.GENERAL_CATEGORY_PERCENTAGE
            const taxRate = process.env.GENERAL_TAX_RATE

            let generalPercentage = ''
            if (categoryInfo.cat_percentage && categoryInfo.cat_percentage.length > 0) {

                let findPercentage = categoryInfo.cat_percentage.find(x => x.name.toLowerCase() === platform.name.toLowerCase())

                if (findPercentage) {
                    if (findPercentage.brand_perc && findPercentage.brand_perc.length > 0) {
                        let findBrandPercentage = findPercentage.brand_perc.find(x => x.brand.id === brandId)
                        if (findBrandPercentage) {
                            generalPercentage = findBrandPercentage.percentage
                        }
                        else {
                            generalPercentage = findPercentage.percentage
                        }
                    }
                    else {
                        generalPercentage = findPercentage.percentage
                    }
                }
                else {
                    generalPercentage = generalCategoryPercentage
                }
            }
            else {
                generalPercentage = generalCategoryPercentage
            }

            let minPrice = parseFloat(supplierInfo.wholesale) * (taxRate / 100 + 1) * (generalPercentage / 100 + 1)

            return minPrice.toFixed(2)

        } catch (error) {
            console.log(error)
        }
    }
});
