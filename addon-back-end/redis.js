const { createClient } = require('redis');
const client = createClient();

const setClient = async (key, value) => {
    await client.set(key, value);
}
const getClient = async (key) => {
    const value = await client.get(key);
    return value;
}

(async () => {
    await client.connect();
})();

client.on('error', err => console.log('Redis Client Error', err));

module.exports = {
    setClient,
    getClient
};
