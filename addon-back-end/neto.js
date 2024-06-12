const config = require('./config');

const getOrders = async (store_domain, secret) => {
  try {
    const res = await fetch(`https://${store_domain}/do/WS/NetoAPI`, {
      method: 'POST',
      headers: {
        X_ACCESS_KEY: config.CLIENT_ID,
        X_SECRET_KEY: secret,
        NETOAPI_ACTION: 'GetOrder',
        Accept: 'application/json',
      },
      body: `{
              "Filter": {
                "DatePlacedFrom": "${new Date(Date.now() - 86400000).toISOString()}",
                "OutputSelector": [
                  "OrderLine",
                  "OrderLine.ProductName",
                  "BillAddress",
                  "DatePlaced"
                ]
              }
            }`,
    });

    orders = await res.json();
    return orders;
  } catch (e) {
    return `Fetch Error. ${e}`;
  }
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
};
