const redis = require('redis')
const util = require('util')

const client = redis.createClient();

module.exports = {
    getAsync: util.promisify(client.get).bind(client),
    setAsync: util.promisify(client.set).bind(client)
}