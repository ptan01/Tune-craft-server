const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()
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


    app.post('/jwt', (req, res)=>{
        const user = req.body ;
        const token = jwt.sign(user , process.env.JWT_SECRET ,{ expiresIn: '1h' })
        res.send({token})
    })


   

    // user related Api 

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

    app.post('/selects', async(req, res)=> {
      const classes = req.body,
      const result = await selectCollection.insertOne(classes) ;
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
