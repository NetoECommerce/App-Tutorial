const express = require('express');
const routes = require('./routes');
const passport = require('./passport');

const app = express();

app.use(require('cors')());
app.use(require('body-parser').urlencoded({ extended: true }));
app.use(passport.initialize());
app.use(routes);

app.listen(3000, (err) => {
  if (err) throw err;
  console.log(`Listening on http://localhost:3000`);
});
