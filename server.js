const express = require('express');
const cors = require('cors');
const app = express();
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
app.use(cors());
app.use('/login', (req, res)=>{
    res.send({
        token: 'test1234'
    });
});

// create connection to DB;
// create login logic;
// generate and save token - create function to generate token;
// send token to frontend; 
// send token to DB;
app.listen(8080,()=> console.log('API is running on http://localhost:8080/login'));