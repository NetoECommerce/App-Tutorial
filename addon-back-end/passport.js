const passport= require("passport")
const OAuth2Strategy = require('passport-oauth2')
const { setAsync } = require('./redis')
const config = require('./config')

passport.use(
  "neto",
  new OAuth2Strategy(
    {
      authorizationURL: "https://apps.getneto.com/oauth/v2/auth",
      tokenURL: "https://apps.getneto.com/oauth/v2/token",
      clientID: config.CLIENT_ID,
      clientSecret: config.CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/callback",
      passReqToCallback: true
    },
    async (
      req,
      accessToken,
      _refreshToken,
      { store_domain },
      info,
      callback
    ) => {
      await setAsync(`${store_domain}#token`, accessToken);
      callback(null, {});
    }
  )
);

module.exports = passport
