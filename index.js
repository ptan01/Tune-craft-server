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


    
    app.get('/users/admin/:email',verifyJWT, async (req, res) => {
      const email = req.params?.email;

      if (req.decoded.email !== email) {
        return res.send({ admin: false })
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' };
      res.send(result)
    })


    app.get('/users/instructor/:email',verifyJWT, async (req, res) => {
      const email = req.params?.email;

      if (req.decoded.email !== email) {
        return res.send({ admin: false })
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === 'instructor' };
      res.send(result)
    })




    app.get('/users',verifyJWT, async (req, res)=> {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })

    app.get('/users/instructor', async(req,res)=>{
      const query = {role : 'instructor'}
      const result = await usersCollection.find(query).toArray()
      res.send(result)
    })

    app.get('/users/best/instructor', async(req,res)=>{
      const query = {role : 'instructor'}
      const result = await usersCollection.find(query).limit(6).toArray()
      res.send(result)
    })

    app.patch('/user/instructor/:id',verifyJWT, async(req, res)=>{
      const id = req.params.id ;
      const filter = {_id : new ObjectId(id)} ;
      const updatedDoc = {
        $set : {
          role : 'instructor'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc) ;
      res.send(result)
    })


    app.patch('/user/admin/:id',verifyJWT, async(req, res)=>{
      const id = req.params.id ;
      const filter = {_id : new ObjectId(id)} ;
      const updatedDoc = {
        $set : {
          role : 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc) ;
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

    app.get('/all/classes',verifyJWT, async(req, res)=> {
      const result = await classCollection.find().toArray()
      res.send(result)
    })

    app.get('/classes/:id', async(req, res)=> {
      const id = req.params.id ;
      const query = {_id : new ObjectId(id)}
      const result = await classCollection.findOne(query);
      res.send(result)
    })

    app.get('/all/approve/classes', async(req, res)=> {
      const query = {status : 'approved'}
      const result = await classCollection.find(query).toArray()
      res.send(result)
    })

    app.get('/popular/classes', async(req ,res)=>{
      const result = await classCollection.find().sort("enrollStudent",-1).limit(6).toArray() ;
      res.send(result)
    })


    app.post('/classes', verifyJWT, async(req, res)=> {
        const newClass = req.body ;
        const result = await classCollection.insertOne(newClass)
        res.send(result)
    })

    app.patch('/classes/feedback/:id', async(req, res)=> {
      const id = req.params.id ;
      const feedback = req.body.feedback ;
      const filter = {_id : new ObjectId(id)} ;
      const updatedDoc = {
        $set: {feedback : feedback}
      }
      const result = await classCollection.updateOne(filter, updatedDoc) ;
      res.send(result)
    })

    app.patch('/classes/update/:id', async(req, res)=> {
        const id = req.params.id ;
        const classInfo = req.body ;
        const query = {_id : new ObjectId(id)};
        const updatedDoc = {
          $set: {
            className: classInfo.name,
            img: classInfo.img,
            seats: classInfo.seats
          }
        }
        const result = await classCollection.updateOne(query, updatedDoc)
        res.send(result)
    })


    app.patch('/classes/approve/:id', async(req, res)=> {
      const id = req.params.id ;
      const query = {_id : new ObjectId(id)}
      const updatedDoc = {
        $set : {status : 'approved'}
      }
      const result = await classCollection.updateOne(query, updatedDoc) ;
      res.send(result)
    })

    app.patch('/classes/deny/:id', async(req, res)=> {
      const id = req.params.id ;
      const query = {_id : new ObjectId(id)}
      const updatedDoc = {
        $set : {status : 'deny'}
      }
      const result = await classCollection.updateOne(query, updatedDoc) ;
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
      const updatedDoc = {$inc: { seats: -1, enrollStudent: +1 }} ;
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
      const result =await paymentCollection.find(query).sort({_id : -1}).toArray()
      res.send(result)
    })

    app.get('/payments/total/:email', async(req,res)=> {
      const email = req.params.email
      const filter = {instructor: email}
      const count = await paymentCollection.countDocuments(filter) ;
      res.send({count})
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
