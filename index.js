const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
const res = require('express/lib/response');
const port = process.env.PORT || 5000;
const app = express();
const jwt = require('jsonwebtoken');

// middleware
app.use(cors());
app.use(express.json());
require('dotenv').config();

// stripe
const stripe = require("stripe")(process.env.STRIPE_KEY);



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rsoub.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).send('unauthorized access!')
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send('forbidden access!');
        }
        req.decoded = decoded;
        next();
    })
}

async function run() {
    try {
        await client.connect();
        const toolsCollection = client.db('eco-electric').collection('tools');
        const reviewsCollection = client.db('eco-electric').collection('reviews');
        const ordersCollection = client.db('eco-electric').collection('orders');
        const profilesCollection = client.db('eco-electric').collection('profile');
        const usersCollection = client.db('eco-electric').collection('users');


        // --------------------------------- tools -------------------------------------
        // tools api

        app.post('/tools', async (req, res) => {
            const toolsDetails = req.body;
            const result = await toolsCollection.insertOne(toolsDetails);
            res.send(result);
        })
        app.get('/tools', async (req, res) => {
            const query = {};
            const cursor = toolsCollection.find(query);
            const items = await cursor.toArray();
            res.send(items);
        });

        // getting a specific item by id
        app.get('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const tool = await toolsCollection.findOne(query);
            res.send(tool);
        });

        app.delete('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const results = await toolsCollection.deleteOne(query);
            res.send(results);
        })


        // updating quantity
        app.put('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: { availableQuantity: data.modifiedQuantity }
            };
            const result = await toolsCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        });

        // --------------------------------- tools ends-------------------------------------


        // --------------------------------- orders starts-------------------------------------

        // order details posting
        app.post('/orders', async (req, res) => {
            const orderDetails = req.body;
            const result = await ordersCollection.insertOne(orderDetails);
            res.send(result);
        });



        // specific users orders collection 
        app.get('/orders', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email === decodedEmail) {
                const query = { email };
                const cursor = ordersCollection.find(query);
                const items = await cursor.toArray();
                return res.send(items);
            } else {
                return res.status(403).send('forbidden access');
            }
        });

        // getting orders by id in payment section
        app.get('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await ordersCollection.findOne(query);
            res.send(result);
        });

        // delete a specific order
        app.delete('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await ordersCollection.deleteOne(query);
            res.send(result);
        });

        app.put('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const data = req.body;

            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: { order: data.order }
            };
            const result = await ordersCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        });

        // getting all orders 
        app.get('/orders', async (req, res) => {
            const orders = await ordersCollection.find().toArray();
            res.send(orders);
        })

        // --------------------------------- orders -------------------------------------

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await usersCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin });
        })



        // review api
        app.get('/reviews', async (req, res) => {
            const reviews = await reviewsCollection.find({}).toArray();
            res.send(reviews);
        });


        app.post('/reviews', async (req, res) => {
            const reviewDetails = req.body;
            const result = await reviewsCollection.insertOne(reviewDetails);
            res.send(result);
        });





        // --------------------------------- profile -------------------------------------


        // updating profile
        app.put('/profile', async (req, res) => {
            const email = req.query.email;
            const data = req.body;
            const filter = { email };
            const options = { upsert: true };
            const updatedDoc = {
                $set: { data }
            };
            const result = await profilesCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        });

        app.get('/profile', async (req, res) => {
            const email = req.query.email;
            // const query = { email }
            const results = await profilesCollection.findOne({ email: email })
            res.send(results);
        })


        // --------------------------------- users -------------------------------------
        app.put('/users/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const options = { upsert: true };
            const user = req.body;
            const updatedDoc = {
                $set: user
            };
            const result = usersCollection.updateOne(filter, updatedDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
            res.send({ result, token });
        });

        app.put('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await usersCollection.findOne({ email: requester })
            if (requesterAccount?.role === 'admin') {
                const filter = { email: email };
                const updatedDoc = {
                    $set: { role: 'admin' }
                };
                const result = usersCollection.updateOne(filter, updatedDoc);
                res.send(result);
            } else {
                res.status(403).send('forbidden')
            }
        });

        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        });

        app.get('/users', async (req, res) => {
            const users = await usersCollection.find({}).toArray();
            res.send(users);
        })




        // --------------------------------- payment -------------------------------------
        app.post('/create-payment-intent', async (req, res) => {
            const serive = req.body;
            const price = serive.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });

        })



    } finally { }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Hello World!')
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
});
