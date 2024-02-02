module.exports = (plugin) => {
    plugin.controllers.user.updateMe = async (ctx) => {
        if (!ctx.state.user || !ctx.state.user.id) {
            return ctx.response.status = 401;
        }

        const response = await strapi.entityService.update('plugin::users-permissions.user', ctx.state.user.id,
            {
                data: {
                    email: ctx.request.body.email,
                    firstName: ctx.request.body.firstName,
                    lastName: ctx.request.body.lastName,
                    telephone: ctx.request.body.telephone,
                    mobilePhone: ctx.request.body.mobilePhone,
                },
            }).then((res) => {
                ctx.response.status = 200
                ctx.response.body={message:"Hello"}
            })

        return ctx.response.body
    }

    plugin.routes['content-api'].routes.push({
        method: "PUT",
        path: "/user/me",
        handler: "user.updateMe",
        config: {
            prefix: "",
            policies: []
        }
    })

    return plugin;
}