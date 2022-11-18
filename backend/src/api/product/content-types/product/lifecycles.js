const Axios = require('axios');
const slugify = require("slugify");

module.exports = {
    async beforeDelete(event) {
        const { where } = event.params;

        const entry = await strapi.entityService.findOne('api::product.product', where.id, {
            populate: { image: true, additionalImages: true }
        });

        try {
            if (entry.image) {
                const imageEntry = await strapi.db.query('plugin::upload.file').delete({
                    where: { id: entry.image.id },
                });
                // This will delete corresponding image files under the *upload* folder.
                strapi.plugins.upload.services.upload.remove(imageEntry);
            }

            if (entry.additionalImages) {
                for (let addImg of entry.additionalImages) {
                    const imageEntry = await strapi.db.query('plugin::upload.file').delete({
                        where: { id: addImg.id },
                    });
                    // This will delete corresponding image files under the *upload* folder.
                    strapi.plugins.upload.services.upload.remove(imageEntry);
                }
            }
        } catch (error) {
            console.error(error)
        }


        // let's do a 20% discount everytime
        //   event.params.data.price = event.params.data.price * 0.8;
    },
    async beforeDeleteMany(event) {
        for (let id of event.params.where.$and[0].id.$in) {
            const entry = await strapi.entityService.findOne('api::product.product', id, {
                populate: { image: true, additionalImages: true }
            });

            try {
                if (entry.image) {
                    const imageEntry = await strapi.db.query('plugin::upload.file').delete({
                        where: { id: entry.image.id },
                    });
                    // This will delete corresponding image files under the *upload* folder.
                    strapi.plugins.upload.services.upload.remove(imageEntry);
                }

                if (entry.additionalImages) {
                    for (let addImg of entry.additionalImages) {
                        const imageEntry = await strapi.db.query('plugin::upload.file').delete({
                            where: { id: addImg.id },
                        });
                        // This will delete corresponding image files under the *upload* folder.
                        strapi.plugins.upload.services.upload.remove(imageEntry);
                    }
                }
            } catch (error) {
                console.error(error)
            }

        }

    },
    beforeCreate(event) {
        const { data, where, select, populate } = event.params;

        event.params.data.slug = slugify(`${data.name}-${data.mpn}`, { lower: true, remove: /[*+~=#.,°;_()/'"!:@]/g })
 
    },
};