//full optimization for vercel deployment
// also localhost is working fine 
//env will add to vercel .
//  for vercel , i have used app.listen conditionally at the bottom


const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const admin = require('firebase-admin');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Firebase Admin SDK init
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require('./artify-66e1e-firebase-adminsdk-fbsvc-94d7c40be6.json');

// Initialize Firebase Admin only once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// MongoDB Connection
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Connect mongodb set 
let db;
async function connectDB() {
  if (!db) {
    await client.connect();
    db = client.db(process.env.DB_NAME || 'artifyDB');
    console.log("Connected to MongoDB!");
  }
  return db;
}

// Verify firebase token 
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















// ARTWORK ROUTES









// Get all public artworks
app.get('/api/artworks', async (req, res) => {
  try {
    const database = await connectDB();
    const artworksCollection = database.collection('artworks');

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

// Get recent 6 artworks for home page logic fix
app.get('/api/artworks/featured', async (req, res) => {
  try {
    const database = await connectDB();
    const artworksCollection = database.collection('artworks');

    const artworks = await artworksCollection
      .find({ visibility: 'Public' })
      .sort({ createdAt: -1 })
      .limit(8)
      .toArray();
    res.json(artworks);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching featured artworks', error: error.message });
  }
});

// Get single artwork by id (PUBLIC - no authentication required)
app.get('/api/artworks/:id', async (req, res) => {
  try {
    const database = await connectDB();
    const artworksCollection = database.collection('artworks');

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
    const database = await connectDB();
    const artworksCollection = database.collection('artworks');

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
    const database = await connectDB();
    const artworksCollection = database.collection('artworks');

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

// Update artwork
app.put('/api/artworks/:id', verifyToken, async (req, res) => {
  try {
    const database = await connectDB();
    const artworksCollection = database.collection('artworks');

    const artworkId = req.params.id;
    const userEmail = req.user.email;

    // Check if artwork belongs to user or not 
    const artwork = await artworksCollection.findOne({ _id: new ObjectId(artworkId) });
    if (!artwork) {
      return res.status(404).json({ message: 'Artwork not found' });
    }
    if (artwork.userEmail !== userEmail) {
      return res.status(403).json({ message: 'Unauthorized to update this artwork' });
    }

    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };
    delete updateData._id;

    const result = await artworksCollection.updateOne(
      { _id: new ObjectId(artworkId) },
      { $set: updateData }
    );
    res.json({ message: 'Artwork updated successfully', modifiedCount: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: 'Error updating artwork', error: error.message });
  }
});

// Delete artwork
app.delete('/api/artworks/:id', verifyToken, async (req, res) => {
  try {
    const database = await connectDB();
    const artworksCollection = database.collection('artworks');

    const artworkId = req.params.id;
    const userEmail = req.user.email;

    // Check if artwork belongs to user
    const artwork = await artworksCollection.findOne({ _id: new ObjectId(artworkId) });
    if (!artwork) {
      return res.status(404).json({ message: 'Artwork not found' });
    }
    if (artwork.userEmail !== userEmail) {
      return res.status(403).json({ message: 'Unauthorized to delete this artwork' });
    }

    const result = await artworksCollection.deleteOne({ _id: new ObjectId(artworkId) });
    res.json({ message: 'Artwork deleted successfully', deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting artwork', error: error.message });
  }
});

// Like/Unlike artwork logic 
app.patch('/api/artworks/:id/like', verifyToken, async (req, res) => {
  try {
    const database = await connectDB();
    const artworksCollection = database.collection('artworks');

    const artworkId = req.params.id;
    const { action } = req.body; // 'like' or 'unlike'

    const increment = action === 'like' ? 1 : -1;
    const result = await artworksCollection.updateOne(
      { _id: new ObjectId(artworkId) },
      { $inc: { likes: increment } }
    );

    const updatedArtwork = await artworksCollection.findOne({ _id: new ObjectId(artworkId) });
    res.json({ message: 'Like updated successfully', likes: updatedArtwork.likes });
  } catch (error) {
    res.status(500).json({ message: 'Error updating likes', error: error.message });
  }
});












// FAVORITES ROUTES













// Get user's favorites
app.get('/api/favorites', verifyToken, async (req, res) => {
  try {
    const database = await connectDB();
    const favoritesCollection = database.collection('favorites');
    const artworksCollection = database.collection('artworks');

    const userEmail = req.user.email;
    const favorites = await favoritesCollection.find({ userEmail }).toArray();

    // Get full artwork details
    const artworkIds = favorites.map(fav => new ObjectId(fav.artworkId));
    const artworks = await artworksCollection.find({ _id: { $in: artworkIds } }).toArray();

    res.json(artworks);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching favorites', error: error.message });
  }
});

// Add to favorites
app.post('/api/favorites', verifyToken, async (req, res) => {
  try {
    const database = await connectDB();
    const favoritesCollection = database.collection('favorites');

    const { artworkId } = req.body;
    const userEmail = req.user.email;

    // Check if already favorited
    const existing = await favoritesCollection.findOne({ userEmail, artworkId });
    if (existing) {
      return res.status(400).json({ message: 'Already in favorites' });
    }

    const result = await favoritesCollection.insertOne({
      userEmail,
      artworkId,
      createdAt: new Date()
    });
    res.status(201).json({ message: 'Added to favorites successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error adding to favorites', error: error.message });
  }
});

// Remove from favorites
app.delete('/api/favorites/:artworkId', verifyToken, async (req, res) => {
  try {
    const database = await connectDB();
    const favoritesCollection = database.collection('favorites');

    const { artworkId } = req.params;
    const userEmail = req.user.email;

    const result = await favoritesCollection.deleteOne({ userEmail, artworkId });
    res.json({ message: 'Removed from favorites successfully', deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ message: 'Error removing from favorites', error: error.message });
  }
});














// USER ROUTES



















// Get artist info
app.get('/api/artists/:email', async (req, res) => {
  try {
    const database = await connectDB();
    const artworksCollection = database.collection('artworks');

    const email = req.params.email;
    const artworks = await artworksCollection.find({ userEmail: email }).toArray();
    const totalArtworks = artworks.length;

    // Get user info from first artwork or create basic info
    const artistInfo = {
      email,
      name: artworks[0]?.artistName || 'Unknown Artist',
      photoURL: artworks[0]?.artistPhoto || '',
      totalArtworks
    };

    res.json(artistInfo);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching artist info', error: error.message });
  }
});

// Dashboard Stats Endpoint
app.get('/api/dashboard/stats', verifyToken, async (req, res) => {
  try {
    const database = await connectDB();
    const artworksCollection = database.collection('artworks');
    const userEmail = req.user.email;

    // 1. Get Summary Stats
    const userArtworks = await artworksCollection.find({ userEmail }).toArray();
    const totalArtworks = userArtworks.length;
    const totalLikes = userArtworks.reduce((sum, art) => sum + (art.likes || 0), 0);
    const publicArtworks = userArtworks.filter(art => art.visibility === 'Public').length;
    const privateArtworks = userArtworks.filter(art => art.visibility !== 'Public').length;

    // 2. Data for Charts 

    // Distribution Pie Chart
    const pieChartData = [
      { name: 'Public', value: publicArtworks, fill: '#0088FE' },
      { name: 'Private', value: privateArtworks, fill: '#FFBB28' }
    ];

    // Likes over time (simplified - using created date) - Bar Chart
    // Group by category for another chart
    const categoryStats = userArtworks.reduce((acc, art) => {
      acc[art.category] = (acc[art.category] || 0) + 1;
      return acc;
    }, {});

    const barChartData = Object.keys(categoryStats).map(key => ({
      name: key,
      value: categoryStats[key]
    }));

    // Recent activity (last 5 artworks)
    const recentArtworks = userArtworks
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    res.json({
      summary: {
        totalArtworks,
        totalLikes,
        publicArtworks,
        privateArtworks
      },
      charts: {
        pie: pieChartData,
        bar: barChartData
      },
      recent: recentArtworks
    });

  } catch (error) {
    res.status(500).json({ message: 'Error fetching dashboard stats', error: error.message });
  }
});

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Artify Server is running!' });
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Export the Express app for Vercel
module.exports = app;

// For local development , , vercel optimize on upper section ,
if (require.main === module) {
  const port = process.env.PORT || 5000;
  app.listen(port, () => {
    console.log(`Artify server is running on port ${port}`);
  });
}
