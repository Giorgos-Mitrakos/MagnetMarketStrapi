'use strict';

/**
 * user-address service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::user-address.user-address', ({ strapi }) => ({
    async findMyAddress(ctx) {
        try {
            const billing_address = await strapi.db.query('api::user-address.user-address').findMany({
                where: {
                    user_billing: {
                        id: ctx.state.user.id
                    }
                },
            })

            const shipping_address = await strapi.db.query('api::user-address.user-address').findMany({
                where: {
                    user_shipping: {
                        id: ctx.state.user.id
                    }
                },
            })

            return {
                user: {
                    username: ctx.state.user.username,
                    email: ctx.state.user.email,
                    firstName: ctx.state.user.firstName,
                    lastName: ctx.state.user.lastName,
                    telephone: ctx.state.user.telephone,
                    mobilePhone: ctx.state.user.mobilePhone,
                    billing_address: billing_address,
                    shipping_address
                }
            }
        } catch (error) {
            console.log(error)
        }
    }
}));
