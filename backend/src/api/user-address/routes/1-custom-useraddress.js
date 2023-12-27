module.exports = {
    routes: [
      {
        method: "POST",
        path: "/user-address/testPost",
        handler: "api::user-address.user-address.testPost",
      },
      {
        method: "GET",
        path: "/user-address/testGet",
        handler: "api::user-address.user-address.testGet",
      },
    ],
  };