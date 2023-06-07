const express = require('express');
const cors = require('cors');
const app = express()
const port = process.env.PORT || 5000 ;


// middleware 
app.use(cors())
app.use(express.json())


app.get('/', (req, res)=>{
    res.send('Tune Craft is Running')
})


app.listen(port , ()=> {
    console.log('tune craft is running on port ', port)
})
