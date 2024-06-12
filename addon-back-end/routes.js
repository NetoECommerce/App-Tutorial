const express = require('express');
const passport = require('passport');
const client = require('./redis');
const { getOrders, mapOrders } = require('./neto');

const router = express.Router();

router.get(
  '/auth/callback',
  passport.authenticate('neto', {
    session: false,
  }),
  (_req, res) => {
    res.redirect('/auth/success');
  }
);

router.get('/auth/success', (req, res) => {
  res.send('Successfully authenticated!');
});

router.get('/history', async (req, res) => {
    const store_domain = req.get('Origin').replace('https://', '');
    const expiryDate = await client.getClient(`${store_domain}#expiry`);

    // serve new orders
    if (new Date() > new Date(expiryDate || 0)) {
        const secret = await client.getClient(`${store_domain}#token`);
        const json = await getOrders(store_domain, secret);
        const orders = mapOrders(json.Order);
        res.json(orders);
        await client.setClient(`${store_domain}#expiry`, new Date(Date.now() + 5184000000).toISOString());
        await client.setClient(`${store_domain}#orders`, JSON.stringify(orders));
    }
    // serve cached orders
    else {
        const json = await client.getClient(`${store_domain}#orders`);
        const orders = JSON.parse(json);
        res.json(orders);
    }
});

module.exports = router;
