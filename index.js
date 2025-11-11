const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();


const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());


// Firebase Admin SDK Init
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require('./artify-66e1e-firebase-adminsdk-fbsvc-94d7c40be6.json');

// Initialize Firebase admin only once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// MongoDB connection
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Verify firebase Token middleware
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token', error: error.message });
  }
};

async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB!");

    const db = client.db(process.env.DB_NAME);
    const artworksCollection = db.collection('artworks');
    const favoritesCollection = db.collection('favorites');
    const usersCollection = db.collection('users');




    // Root route
    app.get('/', (req, res) => {
      res.json({ message: 'Artify Server is running!' });
    });

    // Start server
    app.listen(port, () => {
      console.log(`Artify server is running on port ${port}`);
    });

  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
  }
}

run().catch(console.dir);