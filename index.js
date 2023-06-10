const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SK_SECRET)
const app = express()
const port = process.env.PORT || 5000 ;


// middleware 
app.use(cors())
app.use(express.json())


const verifyJWT =(req, res, next)=>{
   const authorization = req.headers.authorization ;
   if(!authorization){
    return res.status(401).send({error: true , message: 'unauthorized access'})
   }
   const token = authorization.split(' ')[1]

   jwt.verify(token, process.env.JWT_SECRET, (error, decoded)=>{
    if(error){
        return res.status(401).send({error: true, message: 'unauthorized access'})
    }
    req.decoded = decoded ;
    next()
   })

}




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8hd0j1r.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const classCollection = client.db('tuneDb').collection('classes') ;
    const usersCollection = client.db('tuneDb').collection('users') ;
    const selectCollection = client.db('tuneDb').collection('selects') ;
    const enrollCollection = client.db('tuneDb').collection('enrolls') ;
    const paymentCollection = client.db('tuneDb').collection('payments') ;


    app.post('/jwt', (req, res)=>{
        const user = req.body ;
        const token = jwt.sign(user , process.env.JWT_SECRET ,{ expiresIn: '1h' })
        res.send({token})
    })


    app.post('/create-payment-intent',verifyJWT, async(req, res)=> {
      const price = req.body.price ;
      const calculatePrice = price * 100 ;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: calculatePrice ,
        currency: "usd",
        payment_method_types: ['card']
      })
      res.send({
        clientSecret: paymentIntent.client_secret,
      })
    })

   

    // user related Api 


    app.get('/users',verifyJWT, async (req, res)=> {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })


    

    app.post('/users', async (req ,res)=> {
      const user = req.body ;
      const query = {email : user.email} ;
      const existingUser = await usersCollection.findOne(query) ;
      if(existingUser){
        return res.send({message : 'user is already exist'})
      }
      const result = await usersCollection.insertOne(user)
      res.send(result)
    })




    // Classes Related api

    app.get('/instructor/classes',verifyJWT, async(req,res)=>{
      const email = req.query.email ;
      const query = {instructorEmail : email} ;
      const result = await classCollection.find(query).toArray();
      res.send(result)
    })

    app.get('/all/classes', async(req, res)=> {
      const result = await classCollection.find().toArray()
      res.send(result)
    })


    app.post('/classes', verifyJWT, async(req, res)=> {
        const newClass = req.body ;
        const result = await classCollection.insertOne(newClass)
        res.send(result)
    })


    // selected classes related api 

    app.get('/selects',verifyJWT, async(req, res)=>{
      const email = req.query.email ;
      if(email !== req.decoded.email){
        return res.status(403).send({error: true , message: 'forbidden access'})
      }
      const query = {studentEmail : email};
      const result = await selectCollection.find(query).toArray()
      res.send(result)
    })

    app.get('/selects/:id', async(req, res)=>{
      const id = req.params.id ;
      const query = {_id : new ObjectId(id)}
      const result = await selectCollection.findOne(query);
      res.send(result)
    })


    app.post('/selects',verifyJWT, async(req, res)=> {
      const classes = req.body
      const result = await selectCollection.insertOne(classes) ;
      res.send(result)
    })

    app.patch('/selects/reduced-seats', async (req, res)=>{
      const id = req.query.id ;
      const query = {_id : new ObjectId(id)} ;
      const updatedDoc = {$inc: { seats: -1 }} ;
      const result = await classCollection.updateOne(query, updatedDoc) ;
      res.send(result)
    })

    app.delete('/selects/delete/:id', async(req, res)=> {
      const id = req.params.id ;
      const query = {_id : new ObjectId(id)}
      const payClass = await selectCollection.findOne(query) ;
      if(payClass){
       enrollCollection.insertOne(payClass)
      }
      const result = await selectCollection.deleteOne(query)
      res.send(result)
    })

    app.delete('/selects/:id', verifyJWT, async (req, res)=> {
      const id = req.params.id ;
      const query = {_id : new ObjectId(id)} ;
      const result = await selectCollection.deleteOne(query) ;
      res.send(result)
    })

    // enroll related api 
    app.get('/enroll',verifyJWT, async(req, res)=> {
      const email = req.query.email ;
      const query = {studentEmail : email};
      const result = await enrollCollection.find(query).toArray();
      res.send(result)
    })

    // payment related api 

    app.get('/payments',verifyJWT, async(req, res)=> {
      const email = req.query.email ;
      const query = {email : email}
      const result =await paymentCollection.find(query).toArray()
      res.send(result)
    })


    app.post('/payments', async(req, res)=> {
      const payment = req.body ;
      const result = await paymentCollection.insertOne(payment) ;
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);





app.get('/', (req, res)=>{
    res.send('Tune Craft is Running')
})


app.listen(port , ()=> {
    console.log('tune craft is running on port ', port)
})
