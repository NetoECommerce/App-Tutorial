# Build an add-on for Neto using Node.js, Redis and React

> Note: Neto does not require add-ons be developed using a particular tech stack. As long as your backend can make requests to the Neto App URLs and complete the required OAuth flow your application can be built using whatever technology you or your team are most familiar with.
>
> The following guide is meant as an example only, it is not production ready and should not be used in a production environment. When building your application ensure all OAuth Keys and merchant/customer data is securely stored.

## Introduction

This tutorial will walk you through building an add-on for Neto using Node.js, Redis and React. The add-on will be a widget that displays on a merchant's webstore that shows recently purchased products. This type of add-on is commonly called social proof.

While the add-on itself will be quite simple, this tutorial aims to show you features and techniques that are available to you as an add-on developer. At the end of this tutorial you will have built a functional add-on that runs in a local environment. In this tutorial you will set up:

- A back-end in Node.js that can complete the OAuth handshake with Neto and can handle order history requests.
- A Redis store with Docker.
- A front-end widget in React that injects itself into a merchant's webstore.

Note that while this add-on is functional you should not use it as a perfect example of a production optimised add-on.

If you would prefer to jump ahead to the code you can see the completed code on Github.

### Requirements

To complete this tutorial you should have a good understanding of:

- Command line and text editor tools
- HTML, CSS and Javascript
- NPM and packages

This tutorial will also set up a very basic store with Redis using Docker. While not necessary, it may help to have a basic understanding of Docker.

You should also have an existing partner account with Neto and an existing sandbox store, or the ability to create sandbox stores given by the Neto team.

### Tools

You will use a number of tools in this tutorial. You should be at least somewhat familiar with them in order to complete this tutorial.

#### Node.js

Node.js is an open-source, cross-platform JavaScript run-time environment. You'll use it to create your add-on's back-end.

#### Redis

Redis is a simple, open-source key / value store. You'll use it to cache requests from Neto and secret keys. However, in a production environment you should store secret keys in a persistent location.

#### Docker

Docker is an open source tool designed to make it easier to create, deploy, and run applications by using containers. You'll use it to quickly set up your Redis store.

#### React

React is a JavaScript library for building component-based user interfaces. You'll use it to create the widget that displays on the front-end.

## Set up the back-end

We'll start the tutorial by setting up the back-end of the add-on. This tutorial has been tested using the following dependencies and may not work as expected if your code uses anything newer:

- node v20.9.0 (npm v10.1.0)
- body-parser v1.20.2
- cors v2.8.5
- dotenv v16.4.5
- express v4.19.2
- passport v0.7.0
- passport-oauth2 v1.8.0
- redis v4.6.14


### Install Node.js

Download and install the latest stable version of [Node.js.](https://nodejs.org/en/download/)

You can check the installation by running the following in your command line:

```bash
node -v
```

Make sure that the version you have installed is at least 8.10 or later.

### Install Docker

Download and install [Docker Desktop](https://www.docker.com/products/docker-desktop).

You can check the installation by running the following in your command line:

```bash
docker -v
```

### Create your project folder

Create a new folder where you can store the contents of the back-end of your add-on:

```bash
mkdir addon-back-end
```

Navigate to your new folder:

```bash
cd addon-back-end
```

### Initialise project and add dependencies

Node.js includes a package manager tool called `npm` which makes it easier to install and manage packages that you'll use in the add-on. Create a new `package.json` file by running the following:

```bash
npm init
```

The `package.json` file defines your project.

Install your dependencies:

```bash
npm install --save body-parser cors dotenv express passport passport-oauth2 redis
```

### Configure Redis

Docker makes it easy to quickly start a redis store locally. Create a new file called `docker-compose.yml`. Open the file and add the following:

```yml
version: '3'
services:
  redis:
    image: redis:latest
    container_name: cache
    ports:
      - 6379:6379
```

Here we're defining a single container called `cache` that:

- Uses the latest official image provided by Redis
- Exposes the default port that Redis uses to your local environment

To start Redis run the following command:

`docker-compose up -d`

Note, if the above command or any of the commands outlined in this tutorial fail, close your command terminal, reopen it, and run the command again. Some of the file changes we are making will not update in the application without a "reset" - this might be the whole terminal, or just stopping the current running process, and running it again.

To interact with Redis in your code you'll use the redis package. Create a new file called `redis.js` and add the following:

```javascript
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
```

Here we are creating a new Redis Client and starting a connection. We also provide helper functions for the Clients GET and SET commands which allows us to leverage these later in our code.

### Set up application keys

When your partner account is set up and your add-on has been approved, the Neto team will provide you with a Client ID and a Client Secret Key. Keep your credentials private, do not store these in your code. Instead, use them as environment variables that are available when the code runs.

Create a new file called `.env` and add these values:

```
CLIENT_ID=YOUR_CLIENT_ID
CLIENT_SECRET=YOUR_SECRET_KEY
```

To make these environment variables available in your code, create a new file called `config.js` and add the following:

```javascript
require("dotenv").config();

module.exports = {
  CLIENT_ID: process.env.CLIENT_ID,
  CLIENT_SECRET: process.env.CLIENT_SECRET
};
```

### Set up Express server

Create a new file called `index.js`. This will serve as the entry point to your application. Add the following:

```javascript
const express = require('express');

const app = express();

app.use(require('cors')());
app.use(require('body-parser').urlencoded({ extended: true }));

app.listen(3000, (err) => {
  if (err) throw err;
  console.log(`Listening on http://localhost:3000`);
});
```

## Configure OAuth

To make the OAuth process easy, you'll be using a package called `passport`. It lets you define auth strategies easily. Create a new file called `passport.js` and add the following:

```javascript
const passport = require('passport');
const OAuth2Strategy = require('passport-oauth2');
const client = require('./redis');
const config = require('./config');

passport.use(
  'neto',
  new OAuth2Strategy(
    {
      authorizationURL: 'https://apps.getneto.com/oauth/v2/auth',
      tokenURL: 'https://apps.getneto.com/oauth/v2/token',
      clientID: config.CLIENT_ID,
      clientSecret: config.CLIENT_SECRET,
      callbackURL: 'http://localhost:3000/auth/callback',
      passReqToCallback: true,
    },
    async (
      req,
      accessToken,
      _refreshToken,
      { store_domain },
      info,
      callback
    ) => {
      client.setClient(`${store_domain}#token`, accessToken);
      callback(null, {});
    }
  )
);

module.exports = passport;
```

In `passport`, we are creating a new OAuth2 strategy by:

- Defining Neto's OAuth endpoints
- Supplying your application credentials
- Defining your callback URL

Please note, for the purposes of this tutorial, we are using the callback URL: `http://localhost:3000/auth/callback`. If you have requested a different callback URL you will need to update this in the above code and anywhere else `/auth/callback` is referenced in this tutorial.

The second argument to the auth strategy is a function where you can process the access token that you received from Neto. For this tutorial you'll simply be storing the access token in the Redis cache using the store domain as the key.

You'll need to define some routes in your application to use this auth strategy. Create a new file called `routes.js` and add the following:

```javascript
const express = require('express');
const passport = require('passport');

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

module.exports = router;
```

In the above code we create a new Express `Router` and add a pair of routes to it. In the `/auth/callback` route we use the `passport` auth strategy that was defined earlier. Specify `session: false` because `passport` is not being used to cache user sessions in this context.

If your application is able to receive an access token and store it in Redis, the user will be redirected to `/auth/success`. Here we send the user a simple success message to them know the add-on installed successfully.

Open your index.js file and add the following:

```diff
const express = require('express');
+ const routes = require('./routes');
+ const passport = require('./passport');

const app = express();

app.use(require('cors')());
app.use(require('body-parser').urlencoded({ extended: true }));
+ app.use(passport.initialize());
+ app.use(routes);

app.listen(3000, (err) => {
  if (err) throw err;
  console.log(`Listening on http://localhost:3000`);
});

```

You can now start the application by running `node index.js` in the command line. You should see the following in the command line if the application is running successfully:

```
Listening on http://localhost:3000
```

When your add-on is listed on Neto a merchant can have up to two methods of installing your add-on:

- The user can discover your add-on in their Neto control panel and install it from there which will begin the OAuth flow.
- You can redirect the user to the following URL to initiate the flow yourself:
  `https://apps.getneto.com/oauth/v2/auth?store_domain={store_domain}&client_id={client_id}&response_type=code&redirect_uri={callback_uri}`

For the purpose of this tutorial, supply your sandbox store domain without the HTTP protocol as the `store_domain` parameter, your Client ID as the `client_id` parameter and your specified callback URL e.g. `http://localhost:3000/auth/callback` as the `redirect_uri` parameter.

Go to the complete URI in your browser which should take you to the Neto application authorisation portal. Log into the portal using an Admin level staff user on your sandbox store.

If everything has been set up correctly you should be redirected back to your localhost and see `Successfully authenticated!` in the browser.

## Fetch data from Neto

Now that you are able to receive and store access information for each merchant you can start making requests to Neto's API. Create a new file called `neto.js` and add the following:

```javascript
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
```

We're creating two functions in this file, one to fetch orders from Neto's API that were placecd in the last day, and another to remove personal information from the orders and return only the information you need for the widget. To authenticate with Neto's API we supply the `X_ACCESS_KEY` and `X_SECRET_KEY` tokens which are your Client ID and Access Token for the merchant's store, respectively.

Open the `routes.js` file and add the following:

```diff
const express = require('express');
const passport = require('passport');
+ const client = require('./redis');
+ const { getOrders, mapOrders } = require('./neto');

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

+ router.get('/history', async (req, res) => {
+     const store_domain = req.get('Origin').replace('https://', '');
+     const expiryDate = await client.getClient(`${store_domain}#expiry`);
+
+     // serve new orders
+     if (new Date() > new Date(expiryDate || 0)) {
+         const secret = await client.getClient(`${store_domain}#token`);
+         const json = await getOrders(store_domain, secret);
+         const orders = mapOrders(json.Order);
+         res.json(orders);
+         await client.setClient(`${store_domain}#expiry`, new Date(Date.now() + 5184000000).toISOString());
+         await client.setClient(`${store_domain}#orders`, JSON.stringify(orders));
+     }
+     // serve cached orders
+     else {
+         const json = await client.getClient(`${store_domain}#orders`);
+         const orders = JSON.parse(json);
+         res.json(orders);
+     }
+ });

module.exports = router;
```

In the above code we're setting up a new route at `/history` and returning orders that we're fetching from the Neto API.

For the purpose of this tutorial we simply check the origin of the request to determine what store the orders need to be retrieved from. In a production environment you would likely be polling for data using the store_domain provided by the OAuth handshake, not waiting for a webstore to send your application data. In either case, you should opt for a more secure method of determining which store orders to return.

We use Redis to cache the orders fetched from the Neto API for a day to limit the number of requests the add-on is making to the API. You should review our best practices to understand what measures to take to comply.

In your addon-back-end terminal, close and restart the `node index.js` command then open your sandbox store in your browser. Open the browser console in developer tools and run the following:

```
fetch("http://localhost:3000/history")
    .then((res) => res.json())
    .then((json) => console.log(json))
```

Shortly after you should see an array of orders returned.

Your applications backend is now setup and handles the Neto OAuth handshake as well as polling for data via the Neto API. At this point you could expand on the backend code y adding additional routes, API calls, etc. For this tutorial we will keep things simple and move onto the frontend of our application.


## Set up the front-end

We'll use `create-react-app` to quickly setup a widget that can be rendered on your sandbox store. This tool was deprecated in 2023, but works fine for this tutorial. In a production environment you should consider generating a React App using [Vite](https://vitejs.dev/) or [Next.js](https://nextjs.org/). 

Navigate out of your back-end project folder and run the following:

```bash
npx create-react-app addon-front-end
```

Navigate into the `addon-front-end` folder. We'll install a single package which will make it easier to inject our widget as a custom script in Neto:

```bash
npm install -D react-app-rewired
```

Create a new file in the root of the project folder called `config-overrides.js` and add the following:

```javascript
module.exports = function override(config) {
  config.optimization.runtimeChunk = false;
  config.optimization.splitChunks = {
    cacheGroups: {
      default: false,
    },
  };
  return config;
};
```

Open your `package.json` file and replace the "build" script command with the following:

```diff
{
  ...
  "scripts": {
     "start": "react-scripts start",
-    "build: "react-scripts build",
+    "build": "react-app-rewired build",
     "test": "react-scripts test",
     "eject": "react-scripts eject"
  },
  ...
}
```

This tells `create-react-app` that you only want a single file when you build your widget.

## Build your widget

Open `src/App.js` and remove the existing content. Add the following:

```javascript
import React, { useEffect, useState } from "react";

const App = () => {
  const [orders, setOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState({});

  useEffect(() => {
    fetch("http://localhost:3000/history")
      .then((res) => res.json())
      .then((json) => {
        setOrders(json);
      });
  }, []);

  useEffect(() => {
    if (orders.length) {
      let i = 0;
      setActiveOrder(orders[i]);
      const interval = setInterval(() => {
        if (i === orders.length - 1) {
          i = 0;
        } else {
          i += 1;
        }
        setActiveOrder(orders[i]);
      }, [1000 * 10]);
      return () => {
        clearInterval(interval);
      };
    }
  }, [orders]);

  const { city, name, date_placed } = activeOrder;

  return Object.keys(activeOrder).length ? (
    <div>
      <p>
        Someone in <strong>{city}</strong> bought <strong>{name}</strong>!
      </p>
    </div>
  ) : null;
};

export default App;
```

Let's break down what happens here:

1. We define two state components, the active order that we are showing in the widget and the list of orders.
2. In the first effect we fetch orders from our server application and save them from state. Because we supply no dependencies in the effect this effect only runs when the component mounts onto the page.
3. In the second effect we setup an interval that loops through the list of orders that were returned from our server application and sets a single one as the `activeOrder` at a time. Because this effect relies on the orders that we fetched from the server application, we supply `orders` as a dependency.
4. Finally, we render a small widget if there is an active order that says:
   > Someone in **{city}** bought **{name}**!

Add the below to this file to provide some styling and an additional message which displays the elapsed time since the order was placed:

```diff
import React, { useEffect, useState } from "react";

+  const styles = {
+  position: "fixed",
+  bottom: 100,
+  right: 50,
+  width: 400,
+  height: 80,
+  zIndex: 2000,
+  boxShadow: "4px 4px 4px grey",
+  border: "1px solid #fafafa",
+  fontSize: 12,
+  background: "white",
+  padding: 8,
+  display: 'flex',
+  flexDirection: 'column',
+  alignItems: 'center',
+  justifyContent: 'center',
+  textAlign: 'center'
+};
+
+  const getElapsedTime = (time) => {
+  const since = Number(time);
+  const elapsed = Date.now() - since;
+  const second = 1000;
+  const minute = second * 60;
+  const hour = minute * 60;
+  const day = hour * 24;+
+
+  if (elapsed >= second && elapsed < minute) {
+    const seconds = Math.floor(elapsed / second);
+    return `${seconds} second${seconds > 1 ? "s" : ""} ago`;
+  }
+  if (elapsed >= minute && elapsed < hour) {
+    const minutes = Math.floor(elapsed / minute);
+    return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
+  }
+  if (elapsed >= hour && elapsed < day) {
+    const hours = Math.floor(elapsed / hour);
+    return `${hours} hour${hours > 1 ? "s" : ""} ago`;
+  }
+  const days = Math.floor(elapsed / day);
+  return `${days} day${days > 1 ? "s" : ""} ago`;
+};

const App = () => {

  ...

  return Object.keys(activeOrder).length ? (
-    <div>
+    <div style={styles}>
      <p>
        Someone in <strong>{city}</strong> bought <strong>{name}</strong>!
      </p>
+      <small style={{ flexGrow: 1 }}>{getElapsedTime(new Date(date_placed))}</small>
    </div>
  ) : null;
};

export default App;
```

Depending on your add-on's requirements, you can use this environment to develop and run the script that you intend to inject into the webstore when your add-on is published. For this tutorial, we'll jump straight to testing our widget in a custom script in Neto.

## Add your custom script

Run the following in your command line:

```bash
npm run build
```

This will create a new folder in your widget's project directory called build. Navigate to `build/static/*.*.js`, this is your widget's bundle file which can be used as a custom script in Neto.

In a production scenario you would upload this script on your own infrastructure, most likely on a CDN. For this tutorial we'll upload it straight to your sandbox store's theme folder. Use the [following guide](https://developers.maropost.com/documentation/neto-designer-documentation/news-and-tips/how-to-connect-to-neto-via-ftp/) to connect to your sandbox store's FTP directory. Navigate to `httpdocs/assets/themes/{your_theme}/js` and add your bundle file, renaming it to `tutorial.min.js`.

Log into your sandbox store's control panel and go to **Settings & tools** > **All settings & tools** > **Custom Scripts**. Add a new custom script. Click on the `Page Footer` tab and add the following:

```html
<div id="root"></div>
<script
  async
  src="[%ntheme_asset%]js/tutorial.min.js[%/ntheme_asset%]"
  type="text/javascript"
></script>
```

Note that you can make use of Neto's B@SE template language in a custom script. This is useful for accessing server-side variables in your script which can be accessed by passing them through the window object:

```html
<div id="root"></div>
<script type="text/javascript">
  window.__myAddon_emailAddress = "[@email@]";
  window.__myAddon_pageId = "[@id@]";
</script>
<script
  async
  src="[%ntheme_asset%]js/tutorial.min.js[%/ntheme_asset%]"
  type="text/javascript"
></script>
```

Save your new custom script. Ensure your backend is still running, then go to your sandbox store's webstore and you should see your add-on widget.

When your add-on is officially listed on the Neto platform custom scripts can be added automatically when your add-on is installed by a merchant. You may even want to request a number of values from the user to add to your custom script such as an API key or account number. These will be added into the custom fields in the script which can be accessed using the `[@referral_keyX@]` tag, replacing `X` with the corresponding value number (1-4).

## Get listed
Looking to build out an official Neto add-on? Reach out to our [Partner Team](https://partner.maropost.com/commerce-cloud/technology-partner/) first so we can discuss your requirements. 

## Complete
Congratulations on completing this tutorial! You should have a basic understanding of what features are available to you as an add-on developer.

Not all add-ons will contain all of these components; some may be very simple scripts that inject on a merchant's webstore whereas others may be an API connector which doesn't have any visible interface in Neto. If you have any questions about building an add-on, reach out to our partner team at any time.
