const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');

const app = express();
const prisma = new PrismaClient();
const s3 = new S3Client({
    credentials: {
        accessKeyId: process.env.ACCESS_KEY,
        secretAccessKey: process.env.SECRET_ACCESS_KEY
    },
    region: process.env.BUCKET_LOCATION
});

app.use(bodyParser.json());
app.use(cors());

const storage = multer.memoryStorage();
const upload = multer({storage: storage});

app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    try {
        const existingUser = await prisma.user.findUnique({
            where: {
                username,
            },
        });

        if (existingUser) {
            return res.status(400).json({ message: 'Username already taken' });
        }

        const hashedPassword = await bcrypt.hash(password, 10); 

        const newUser = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                token: ''
            },
        });

        console.log('User registered:', newUser.username);
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ message: 'Registration failed' });
    }
});

const checkUserExists = async (req, res, next) => {
    const { username } = req.body;

    try {
        const user = await prisma.user.findFirst({
            where: {
                username,
            },
        });

        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        req.user = user; 
        next();
    } catch (error) {
        console.error('Error while checking user existence:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const checkPassword = async (req, res, next) => {
    const { password } = req.body;
    const { user } = req;

    try {
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        next();
    } catch (error) {
        console.error('Error while checking password:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

app.post('/login', checkUserExists, checkPassword, async (req, res) => {
    const { user } = req;

    try {
        const token = jwt.sign({ userId: user.id }, process.env.SECRET_KEY, {
            expiresIn: '1h', 
        });

        await prisma.user.update({
            where: { id: user.id },
            data: { token },
        });

        console.log('User logged in:', user.username);
        res.status(200).json({ message: 'ok', token });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

const validateToken = (req, res, next) => {
    const token = req.header('x-auth-token'); // Assuming you send the token in a header

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.SECRET_KEY); // Replace with your secret key
        req.user = decoded;
        next();
    } catch (ex) {
        res.status(400).json({ message: 'Invalid token.' });
    }
}

app.get('/protected', validateToken, (req, res) => {
    res.json({ message: 'Valid token. Access granted.' });

});

const randomName = () => {
    return crypto.randomBytes(32).toString('hex');
}

app.post('/post', validateToken, upload.single('image'), async (req, res)=>{
    console.log('req.body', req.body)
    console.log('req.file', req.file)

    const userId = req.user.userId
    const params = {
        Bucket: process.env.BUCKET_NAME,
        Key: randomName(),
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
    }
    const command = new PutObjectCommand(params)
    
    await s3.send(command)
    const post = await prisma.image.create({
        data:{
            imageName: params.Key,
            description: req.body.description,
            authorId: userId
        }
    })
    res.send(post)
})



app.listen(8080,()=> console.log('API is running on http://localhost:8080/'));