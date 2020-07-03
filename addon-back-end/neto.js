const axios = require("axios");
const config = require('./config')

const getOrders = (store_domain, secret) => {
  return axios.post({
    url: `https://${store_domain}/do/WS/NetoAPI`,
    responseType: 'json',
    headers: {
      X_ACCESS_KEY: config.CLIENT_ID,
      X_SECRET_KEY: secret,
      NETOAPI_ACTION: "GetOrder",
    },
    body: {
      Filter: {
        DatePlacedFrom: new Date(Date.now() - 86400000).toISOString(),
        OutputSelector: [
          "OrderLine",
          "OrderLine.ProductName",
          "BillAddress",
          "DatePlaced",
        ],
      },
    },
  });
};

const mapOrders = (orders) => {
  return orders.map((order) => ({
    date_placed: order.DatePlaced,
    sku: order.OrderLine[0].SKU,
    name: order.OrderLine[0].ProductName,
    city: order.BillCity,
  }));
};

module.exports = {
    mapOrders,
    getOrders
}