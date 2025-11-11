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


  
    // ARTWORK ROUTES
   

    // Get all public artworks 
    app.get('/api/artworks', async (req, res) => {
      try {
        const { search, category } = req.query;
        let query = { visibility: 'Public' };

        // Search by title or artist name
        if (search) {
          query.$or = [
            { title: { $regex: search, $options: 'i' } },
            { artistName: { $regex: search, $options: 'i' } }
          ];
        }

        // Filter by category
        if (category && category !== 'All') {
          query.category = category;
        }

        const artworks = await artworksCollection.find(query).toArray();
        res.json(artworks);
      } catch (error) {
        res.status(500).json({ message: 'Error fetching artworks', error: error.message });
      }
    });


   // Get recent 6 artworks for home page
    app.get('/api/artworks/featured', async (req, res) => {
      try {
        const artworks = await artworksCollection
          .find({ visibility: 'Public' })
          .sort({ createdAt: -1 })
          .limit(6)
          .toArray();
        res.json(artworks);
      } catch (error) {
        res.status(500).json({ message: 'Error fetching featured artworks', error: error.message });
      }
    });

    // Get single artwork by ID
    app.get('/api/artworks/:id', verifyToken, async (req, res) => {
      try {
        const artwork = await artworksCollection.findOne({ _id: new ObjectId(req.params.id) });
        if (!artwork) {
          return res.status(404).json({ message: 'Artwork not found' });
        }
        res.json(artwork);
      } catch (error) {
        res.status(500).json({ message: 'Error fetching artwork', error: error.message });
      }
    });

    // Get user's own artworks 
    app.get('/api/my-artworks', verifyToken, async (req, res) => {
      try {
        const userEmail = req.user.email;
        const artworks = await artworksCollection.find({ userEmail }).toArray();
        res.json(artworks);
      } catch (error) {
        res.status(500).json({ message: 'Error fetching user artworks', error: error.message });
      }
    });

    // Add new artwork
    app.post('/api/artworks', verifyToken, async (req, res) => {
      try {
        const newArtwork = {
          ...req.body,
          userEmail: req.user.email,
          likes: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        const result = await artworksCollection.insertOne(newArtwork);
        res.status(201).json({ message: 'Artwork added successfully', artworkId: result.insertedId });
      } catch (error) {
        res.status(500).json({ message: 'Error adding artwork', error: error.message });
      }
    });


   // Get recent 6 artworks for home page
    app.get('/api/artworks/featured', async (req, res) => {
      try {
        const artworks = await artworksCollection
          .find({ visibility: 'Public' })
          .sort({ createdAt: -1 })
          .limit(6)
          .toArray();
        res.json(artworks);
      } catch (error) {
        res.status(500).json({ message: 'Error fetching featured artworks', error: error.message });
      }
    });

    // Get single artwork by ID
    app.get('/api/artworks/:id', verifyToken, async (req, res) => {
      try {
        const artwork = await artworksCollection.findOne({ _id: new ObjectId(req.params.id) });
        if (!artwork) {
          return res.status(404).json({ message: 'Artwork not found' });
        }
        res.json(artwork);
      } catch (error) {
        res.status(500).json({ message: 'Error fetching artwork', error: error.message });
      }
    });

    // Get user's own artworks 
    app.get('/api/my-artworks', verifyToken, async (req, res) => {
      try {
        const userEmail = req.user.email;
        const artworks = await artworksCollection.find({ userEmail }).toArray();
        res.json(artworks);
      } catch (error) {
        res.status(500).json({ message: 'Error fetching user artworks', error: error.message });
      }
    });

    // Add new artwork
    app.post('/api/artworks', verifyToken, async (req, res) => {
      try {
        const newArtwork = {
          ...req.body,
          userEmail: req.user.email,
          likes: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        const result = await artworksCollection.insertOne(newArtwork);
        res.status(201).json({ message: 'Artwork added successfully', artworkId: result.insertedId });
      } catch (error) {
        res.status(500).json({ message: 'Error adding artwork', error: error.message });
      }
    });




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