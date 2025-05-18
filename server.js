const express = require('express');
const mongoose = require('mongoose');
const { spawn } = require('child_process');
const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
const multer = require('multer'); // Add this to your imports
const path = require('path');
const { GridFsStorage } = require('multer-gridfs-storage');
const crypto = require('crypto');
const cron = require('node-cron');

const app = express();
const port = 8080;


// MongoDB Connection
require('dotenv').config();

const mongoUri = process.env.MONGODB_URI;

mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('MongoDB connected successfully');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});
// Mongoose Schema and Model for Users
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  friends: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
  friendRequests: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FriendRequest' }], default: [] },
  profilePicture: { type: String, default: '../profile.png' },
  // Add archetype fields
  archetype: {
    name: String,
    description: String,
    confidence: Number,
    lastUpdated: { type: Date, default: null },
    genreDistribution: { type: Map, of: Number },
    scores: { type: Map, of: Number },
    archetypeConfidences: { type: Map, of: Number },
    archetypeWeights: { type: Map, of: Object }
  }
});


const userListSchema = new mongoose.Schema({
  username: { type: String, required: true },
  listName: { type: String, required: true },
  tags: [String],
  visibility: { type: String, enum: ['private', 'friends', 'public'], default: 'public' },
  description: String,
  books: [{
    isbn: String,
    title: String,
    authors: String,
    description: String,
    thumbnail: String,
  }],
  likes: [{
    username: String,
    timestamp: { type: Date, default: Date.now }
  }],
  createdDate: { type: Date, default: Date.now }
});


const activitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  bookTitle: { type: String, required: true }, // Store the book title directly
  isbn: { type: String }, // Store the ISBN directly
  thumbnail: { type: String }, // Store the thumbnail URL directly
  timestamp: { type: Date, default: Date.now },
  visibility: { type: String, enum: ['private', 'friends', 'public'], default: 'public' }, // Add visibility field
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] // Array of users who have read this activity
});

const friendRequestSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  isRead: { type: Boolean, default: false } // Add isRead field
});


// Models
const UserList = mongoose.model('UserList', userListSchema);
const User = mongoose.model('User', userSchema);
const Activity = mongoose.model('Activity', activitySchema);
const FriendRequest = mongoose.model('FriendRequest', friendRequestSchema);

// Optional: If the Friend schema is necessary, ensure it's used correctly.
const friendSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  friendId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });  // Automatically adds createdAt and updatedAt fields
const Friend = mongoose.model('Friend', friendSchema);

// Book Schema (unchanged)
const bookSchema = new mongoose.Schema({
  title: String,
  author: String,
  description: String,
  isbn: String,
  imageUrl: String,
  categories: [String],
  pageCount: Number,
});
const Book = mongoose.model('Book', bookSchema);

const userLibrarySchema = new mongoose.Schema({
  username: String,
  books: [{
    isbn: String,
    title: String,
    authors: String,
    description: String,
    thumbnail: String,
    categories: [String],
    pageCount: Number,
    review: String,
    rating: Number,
    reviewDate: Date,
    visibility: { type: String, enum: ['private', 'friends', 'public'], default: 'public' },
    likes: [{
      username: String,
      timestamp: { type: Date, default: Date.now },
      isRead: { type: Boolean, default: false } // Add isRead field for each like
    }]
  }],
  top5: [{
    isbn: String,
    title: String,
    authors: String,
    description: String,
    thumbnail: String,
    categories: [String],
    pageCount: Number,
    review: String,
    rating: Number
  }],
  readList: [{
    isbn: String,
    title: String,
    authors: String,
    description: String,
    thumbnail: String,
    categories: [String],
    pageCount: Number,
    review: String,
    rating: Number,
  }],
  currentlyReading: {
    books: [{
      isbn: String,
      title: String,
      authors: String,
      description: String,
      thumbnail: String,
      categories: [String],
      pageCount: Number,
      startDate: { type: Date, default: Date.now },
      endDate: { type: Date, default: null }
    }]
  },
  // Add this new field to track reading history
  readingHistory: [{
    isbn: String,
    title: String,
    authors: String,
    description: String,
    thumbnail: String,
    categories: [String],
    pageCount: Number,
    startDate: Date,
    endDate: Date
  }]
});
const UserLibrary = mongoose.model('UserLibrary', userLibrarySchema);

app.use(express.static('public'));
app.use(express.json());

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/html/index.html');
});

app.post('/api/users/:username/lists', async (req, res) => {
  const { username } = req.params; // Get username from URL parameters
  const { listName, tags, visibility, description, books } = req.body; // Get list data from request body

  try {
    // Create a new UserList instance
    const newList = new UserList({
      username,
      listName,
      tags,
      visibility,
      description,
      books
    });

    // Save the list to the database
    await newList.save();

    // Respond with the newly created list
    res.status(201).json({
      success: true,
      message: 'List created successfully',
      list: newList
    });
  } catch (error) {
    console.error('Error creating list:', error);
    res.status(500).json({ success: false, message: 'Failed to create list' });
  }
});

// Endpoint to get count of unread activities
app.get('/api/activities/unread-count/:username', async (req, res) => {
    const { username } = req.params;

    try {
        const user = await User.findOne({ username });
        if (!user) {
            console.log('❌ User not found');
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Count unread activities from friends, filtering out any problematic ones
        const unreadActivities = await Activity.find({
            userId: { $in: user.friends },
            readBy: { $ne: user._id },
            action: { $in: ['reviewed', 'added to library', 'added to top 5', 'added to reading list'] }
        }).populate('userId', 'username');

        // Filter out any activities with missing or invalid data
        const validUnreadActivities = unreadActivities.filter(activity => {
            try {
                // Check if activity has all required fields
                return activity.userId && 
                       activity.action && 
                       (activity.action === 'reviewed' ? activity.bookTitle : true);
            } catch (error) {
                console.log('Filtered out invalid activity:', error);
                return false;
            }
        });

        const unreadActivitiesCount = validUnreadActivities.length;

        // Count unread friend requests
        const unreadFriendRequests = await FriendRequest.find({
            to: user._id,
            status: 'pending',
            isRead: false
        }).populate('from', 'username');

        const unreadFriendRequestsCount = unreadFriendRequests.length;

        // Get unread likes on user's reviews
        const userLibrary = await UserLibrary.findOne({ username });
        let unreadLikesCount = 0;
        let unreadLikesDetails = [];

        if (userLibrary && userLibrary.books) {
            userLibrary.books.forEach(book => {
                if (book.likes) {
                    try {
                        // Get unread likes with full details, filtering out invalid ones
                        const unreadLikes = book.likes.filter(like => {
                            try {
                                return !like.isRead && 
                                       typeof like === 'object' && 
                                       like.username;
                            } catch (error) {
                                console.log('Filtered out invalid like:', error);
                                return false;
                            }
                        });
                        
                        if (unreadLikes.length > 0) {
                            unreadLikesDetails.push({
                                bookTitle: book.title,
                                isbn: book.isbn,
                                unreadLikes: unreadLikes.map(like => ({
                                    username: like.username,
                                    timestamp: like.timestamp,
                                    isRead: like.isRead
                                }))
                            });
                            console.log(`Book "${book.title}" has ${unreadLikes.length} unread likes:`, unreadLikes);
                        }
                        unreadLikesCount += unreadLikes.length;
                    } catch (error) {
                        console.log(`Error processing likes for book "${book.title}":`, error);
                        // Skip this book's likes but continue with others
                    }
                }
            });
        }

        // Count unread nudges
        const unreadNudges = await Activity.find({
            userId: user._id,
            action: 'nudge',
            readBy: { $ne: user._id }
        }).populate('userId', 'username');

        const unreadNudgesCount = unreadNudges.length;

        // Total unread count
        const totalUnreadCount = unreadActivitiesCount + unreadFriendRequestsCount + unreadLikesCount + unreadNudgesCount;
       
        res.json({ 
            success: true, 
            unreadCount: totalUnreadCount,
            details: {
                activities: unreadActivitiesCount,
                friendRequests: unreadFriendRequestsCount,
                likes: unreadLikesCount,
                nudges: unreadNudgesCount
            }
        });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Mark all activities as read
// Mark all activities as read
app.post('/api/activities/mark-read/:username', async (req, res) => {
  const { username } = req.params;

  try {
    // Find the user by their username
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Find unread activities (those not read by this specific user)
    const unreadActivities = await Activity.find({ readBy: { $ne: user._id } });
    console.log(`Marking ${unreadActivities.length} activities as read for user ${username}`);

    // Mark these activities as read for the user by adding the user to the 'readBy' array
    const updateResult = await Activity.updateMany(
      { readBy: { $ne: user._id } },  // Ensure the user hasn't already read these activities
      { $addToSet: { readBy: user._id } }  // Add the user's ID to the 'readBy' array
    );

    console.log(`Updated ${updateResult.nModified} activities to mark them as read for ${username}`);

    res.status(200).json({ success: true, message: 'All activities marked as read for the user' });
  } catch (error) {
    console.error('Error marking activities as read:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});




// User Registration
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = new User({ username, password });
    await user.save();
    res.status(201).send('User created');
  } catch (err) {
    res.status(400).send('Error creating user');
  }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  console.log(`Login attempt: username=${username}, password=${password}`);
  try {
    const user = await User.findOne({ username });
    if (!user) {
      console.log(`User not found: username=${username}`);
      return res.status(400).send('Invalid username or password');
    }

    if (password !== user.password) {
      console.log(`Invalid password for user: username=${username}`);
      return res.status(400).send('Invalid username or password');
    }

    console.log(`User logged in successfully: username=${username}`);
    res.status(200).send('Logged in');
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).send('Internal server error');
  }
});

app.post('/api/auth/change-username', async (req, res) => {
  const { oldUsername, newUsername } = req.body;

  try {
    // Find the user by the old username
    const user = await User.findOne({ username: oldUsername });
    if (!user) {
      return res.status(404).send('User not found');
    }

    // Check if the new username is already taken
    const existingUser = await User.findOne({ username: newUsername });
    if (existingUser) {
      return res.status(400).send('Username is already taken');
    }

    // Update the username
    user.username = newUsername;
    await user.save();

    res.status(200).send('Username updated successfully');
  } catch (err) {
    console.error('Error updating username:', err);
    res.status(500).send('Internal server error');
  }
});


// Create a new book
app.post('/books', async (req, res) => {
  const { title, author, description, isbn, imageUrl, categories, pageCount} = req.body;
  try {
    const book = new Book({ title, author, description, isbn, imageUrl, categories, pageCount });
    await book.save();
    res.status(201).json(book);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all books
app.get('/books', async (req, res) => {
  try {
    const books = await Book.find();
    res.status(200).json(books);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get a single book by ID
app.get('/books/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const book = await Book.findById(id);
    if (book) {
      res.status(200).json(book);
    } else {
      res.status(404).json({ message: 'Book not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update a book by ID
app.put('/books/:id', async (req, res) => {
  const { id } = req.params;
  const { title, author, description, isbn, imageUrl, categories, pageCount} = req.body;
  try {
    const book = await Book.findByIdAndUpdate(id, { title, author, description, isbn, imageUrl, categories, pageCount }, { new: true });
    if (book) {
      res.status(200).json(book);
    } else {
      res.status(404).json({ message: 'Book not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete a book by ID
app.delete('/books/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const book = await Book.findByIdAndDelete(id);
    if (book) {
      res.status(200).json({ message: 'Book deleted successfully' });
    } else {
      res.status(404).json({ message: 'Book not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add book to user's library
app.post('/api/library/add', async (req, res) => {
  const { username, isbn, title, authors, description, thumbnail, categories, pageCount } = req.body;

  // Debugging logs
  console.log("Add to Library Request Body:", req.body);

  try {
    let userLibrary = await UserLibrary.findOne({ username });
    if (!userLibrary) {
      userLibrary = new UserLibrary({ username, books: [] });
    }

    const existingBook = userLibrary.books.find(book => book.isbn === isbn);
    if (existingBook) {
      console.log(`Book with ISBN ${isbn} already exists in the library.`);
      return res.status(400).json({ success: false, message: 'Book already in library' });
    }

    console.log("Adding book to user library:", { isbn, title, authors, description, thumbnail, categories, pageCount });
    userLibrary.books.push({ isbn, title, authors, description, thumbnail, categories, pageCount });
    await userLibrary.save();
    console.log("Book successfully added to user library.");

    const user = await User.findOne({ username });
    if (user) {
      // More debugging logs
      console.log("Creating Activity with:", { title, isbn, thumbnail });

      const newActivity = new Activity({
        userId: user._id,
        action: 'added to library',
        bookTitle: title,
        isbn: isbn,
        thumbnail: thumbnail,
        timestamp: new Date()
      });

      await newActivity.save();
      console.log("Activity created and saved successfully:", newActivity);
    } else {
      console.error(`User not found: ${username}`);
    }

    res.status(200).json({ success: true, message: 'Book added to library' });
  } catch (error) {
    console.error("Error occurred while adding book to library:", error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});



// Remove book from user's library
app.post('/api/library/remove', async (req, res) => {
  const { username, isbn } = req.body;

  try {
      let userLibrary = await UserLibrary.findOne({ username });
      if (!userLibrary) {
          return res.status(404).json({ success: false, message: 'No library found for user' });
      }

      // Find the book to get its title before removing it
      const bookToRemove = userLibrary.books.find(book => book.isbn === isbn);
      if (!bookToRemove) {
          return res.status(404).json({ success: false, message: 'Book not found in library' });
      }

      const title = bookToRemove.title;

      // Remove the book from the library
      userLibrary.books = userLibrary.books.filter(book => book.isbn !== isbn);
      await userLibrary.save();


      res.status(200).json({ success: true, message: 'Book removed from library' });
  } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Internal server error' });
  }
});


app.get('/api/library/:username', async (req, res) => {
  const { username } = req.params;
  const { page = 1, limit = 16 } = req.query;

  try {
    // Calculate the offset for pagination
    const offset = (page - 1) * limit;

    // Fetch the UserLibrary for the user
    let userLibrary = await UserLibrary.findOne({ username });
    if (!userLibrary) {
      // If no userLibrary found, create an empty one for the user
      userLibrary = new UserLibrary({ username, books: [], readList: [], top5: [] });
      await userLibrary.save();
    }
    console.log('User Library Books:', userLibrary.books);

    //Category Counts
    const categoryCounts = userLibrary.books.reduce((acc, book) => {
      acc[book.categories] = (acc[book.categories] || 0) + 1;
      return acc;
    }, {});
    
    if (categoryCounts.hasOwnProperty("")) {
      categoryCounts["other"] = (categoryCounts["Other"] || 0) + categoryCounts[""];
      delete categoryCounts[""];
    }

    console.log('Category Counts:', categoryCounts);

    // Fetch the paginated books from the userLibrary
    const paginatedBooks = userLibrary.books.slice(offset, offset + limit);

    // Calculate total pages across all books
    const totalPages = userLibrary.books.reduce((sum, book) => {
      const pageCount = book.pageCount || 0; // Use 0 if pageCount is null or undefined
      return sum + pageCount;
    }, 0);    
    // Calculate the total number of books in the user's library
    const totalBooks = userLibrary.books.length;

    // Calculate the number of pagination pages based on the limit
    const totalPaginationPages = Math.ceil(totalBooks / limit);

    res.status(200).json({
      success: true,
      books: paginatedBooks,
      totalBooks,
      currentPage: Number(page),
      totalPages,   // This represents the total pages across all books
      totalPaginationPages, // This represents the total pages for pagination
      categoryCounts //for category pie chart
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});




app.get('/api/recommendations/:username', async (req, res) => {
  const { username } = req.params;
  try {
      const userLibrary = await UserLibrary.findOne({ username });
      if (!userLibrary) {
          console.error(`No library found for user: ${username}`);
          return res.status(404).json({ success: false, message: 'No library found for user' });
      }

      const library = userLibrary.books;
      
      // Check if the library is empty
      if (library.length === 0) {
          console.log(`User ${username} has an empty library.`);
          return res.status(200).json({ success: true, recommendations: [] });
      }

      // Spawn Python process with both library and username as arguments
      const pythonProcess = spawn(pythonCommand, [
          'public/functions/recommendations.py', 
          JSON.stringify(library)
      ]);

      let recommendations = '';
      pythonProcess.stdout.on('data', (data) => {
          recommendations += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
          console.error(`stderr: ${data}`);
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`Python process exited with code ${code}`);
            return res.status(500).json({ success: false, message: 'Error generating recommendations' });
        }
        console.log('Raw recommendations output:', recommendations);  // Debugging line to print raw output
        try {
            const recommendationsJSON = JSON.parse(recommendations);
            console.log('Parsed recommendations JSON:', JSON.stringify(recommendationsJSON, null, 2));
            res.status(200).json({ success: true, recommendations: recommendationsJSON });
        } catch (error) {
            console.error('Error parsing recommendations:', error);
            res.status(500).json({ success: false, message: 'Error parsing recommendations' });
        }
    });


  } catch (error) {
      console.error('Error during recommendations generation:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
//THIS RECOMMENDATIONS USES the COLLABORATIVE RECS ONE FIRST, THEN FALLS BACK to CONTENT BASED
/*
app.get('/api/recommendations/:username', async (req, res) => {
  const { username } = req.params;

  try {
      const userLibrary = await UserLibrary.findOne({ username });
      if (!userLibrary) {
          console.error(`No library found for user: ${username}`);
          return res.status(404).json({ success: false, message: 'No library found for user' });
      }

      const library = userLibrary.books;

      // Check if the library is empty
      if (library.length === 0) {
          console.log(`User ${username} has an empty library.`);
          return res.status(200).json({ success: true, recommendations: [] });
      }

      // Step 1: Call NetflixRecommendations (Collaborative Filtering)
      console.log(`Calling NetflixRecommendations for user: ${username}`);
      let recommendations = '';

      const pythonProcessCF = spawn(pythonCommand, [
          'public/functions/NetflixRecommendations.py',
          username, // Pass username to the collaborative filtering script
          '10'      // Number of recommendations to generate
      ]);

      pythonProcessCF.stdout.on('data', (data) => {
          recommendations += data.toString();
      });

      pythonProcessCF.stderr.on('data', (data) => {
          console.error(`NetflixRecommendations stderr: ${data}`);
      });

      pythonProcessCF.on('close', async (code) => {
          if (code !== 0) {
              console.error(`NetflixRecommendations script failed with code ${code}`);
              return fallbackToContentBased();
          }

          console.log('Raw NetflixRecommendations output:', recommendations);

          try {
              const parsedRecommendations = JSON.parse(recommendations);
              if (parsedRecommendations.length > 0) {
                  // If collaborative filtering returned results, send them
                  console.log('NetflixRecommendations returned results.');
                  return res.status(200).json({ success: true, recommendations: parsedRecommendations });
              } else {
                  // If no results, call the fallback function
                  console.log('NetflixRecommendations returned no results. Falling back to content-based recommendations.');
                  return fallbackToContentBased();
              }
          } catch (error) {
              console.error('Error parsing NetflixRecommendations output:', error);
              return fallbackToContentBased();
          }
      });

      // Step 2: Fallback to Content-Based Recommendations
      const fallbackToContentBased = async () => {
          console.log(`Calling content-based recommendations for user: ${username}`);
          const pythonProcessCB = spawn(pythonCommand, [
              'public/functions/recommendations.py', 
              JSON.stringify(library)
          ]);

          let contentBasedRecommendations = '';

          pythonProcessCB.stdout.on('data', (data) => {
              contentBasedRecommendations += data.toString();
          });

          pythonProcessCB.stderr.on('data', (data) => {
              console.error(`Content-based stderr: ${data}`);
          });

          pythonProcessCB.on('close', (code) => {
              if (code !== 0) {
                  console.error(`Content-based script failed with code ${code}`);
                  return res.status(500).json({ success: false, message: 'Failed to generate recommendations' });
              }

              try {
                  const parsedRecommendations = JSON.parse(contentBasedRecommendations);
                  console.log('Content-based recommendations returned successfully.');
                  return res.status(200).json({ success: true, recommendations: parsedRecommendations });
              } catch (error) {
                  console.error('Error parsing content-based recommendations:', error);
                  return res.status(500).json({ success: false, message: 'Error parsing recommendations' });
              }
          });
      };

  } catch (error) {
      console.error('Error during recommendations generation:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
*/



app.get('/api/group-recommendations', async (req, res) => {
  const { usernames } = req.query; // Expect usernames to be passed as a comma-separated string
  if (!usernames) {
      return res.status(400).json({ success: false, message: 'Usernames are required' });
  }

  const usernameArray = usernames.split(',');

  try {
      // Fetch libraries for all users
      const userLibraries = await UserLibrary.find({ username: { $in: usernameArray } });
      
      // Check if any libraries were found
      if (!userLibraries || userLibraries.length === 0) {
          console.error('No libraries found for the given users.');
          return res.status(404).json({ success: false, message: 'No libraries found for the given users' });
      }

      // Merge all books from the libraries into one combined library
      const combinedLibrary = [];
      userLibraries.forEach(userLibrary => {
          combinedLibrary.push(...userLibrary.books);
      });

      // Remove duplicates from combinedLibrary if necessary
      const uniqueBooks = Array.from(new Set(combinedLibrary.map(book => book.isbn)))
          .map(isbn => combinedLibrary.find(book => book.isbn === isbn));

      // Spawn Python process with the combined library
      const pythonProcess = spawn(pythonCommand, [
          'public/functions/recommendations.py',
          JSON.stringify(uniqueBooks)
      ]);

      let recommendations = '';
      pythonProcess.stdout.on('data', (data) => {
          recommendations += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
          console.error(`stderr: ${data}`);
      });

      pythonProcess.on('close', (code) => {
          if (code !== 0) {
              console.error(`Python process exited with code ${code}`);
              return res.status(500).json({ success: false, message: 'Error generating recommendations' });
          }
          console.log('Raw recommendations output:', recommendations); // Debugging line
          try {
              const recommendationsJSON = JSON.parse(recommendations);
              console.log('Parsed recommendations JSON:', JSON.stringify(recommendationsJSON, null, 2));
              res.status(200).json({ success: true, recommendations: recommendationsJSON });
          } catch (error) {
              console.error('Error parsing recommendations:', error);
              res.status(500).json({ success: false, message: 'Error parsing recommendations' });
          }
      });

  } catch (error) {
      console.error('Error during recommendations generation:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
  }
});


app.get('/api/book-recommendations', async (req, res) => {
  const isbn = req.query.isbn; // Get the isbn from the query string
  if (!isbn) {
    return res.status(400).json({ success: false, message: 'ISBN is required' });
  }

  try {
    const pythonProcess = spawn(pythonCommand, ['public/functions/singleRecs.py', isbn]);

    let recommendations = '';
    pythonProcess.stdout.on('data', (data) => {
      recommendations += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`stderr: ${data.toString()}`);
  });
  

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python process exited with code ${code}`);
        return res.status(500).json({ success: false, message: 'Error generating recommendations' });
      }
      try {
        const recommendationsJSON = JSON.parse(recommendations);
        res.status(200).json({ success: true, recommendations: recommendationsJSON });
      } catch (error) {
        console.error('Error parsing recommendations:', error);
        res.status(500).json({ success: false, message: 'Error parsing recommendations' });
      }
    });
  } catch (error) {
    console.error('Error during recommendations generation:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
// Add book to user's top 5
app.post('/api/library/top5/add', async (req, res) => {
  const { username, isbn, title, authors, description, thumbnail, categories, pageCount } = req.body;
  try {
    let userLibrary = await UserLibrary.findOne({ username });
    if (!userLibrary) {
      return res.status(404).json({ success: false, message: 'No library found for user' });
    }

    // Check if the book is already in the top 5
    const existingBook = userLibrary.top5.find(book => book.isbn === isbn);
    if (existingBook) {
      return res.status(400).json({ success: false, message: 'Book already in top 5' });
    }

    // Check if the top 5 list is full
    if (userLibrary.top5.length >= 5) {
      return res.status(400).json({ success: false, message: 'Top 5 list is full' });
    }

    userLibrary.top5.push({ isbn, title, authors, description, thumbnail, categories, pageCount });
    await userLibrary.save();
    // Example of activity logging when adding a book to top 5
    const user = await User.findOne({ username });

    const newActivity = new Activity({
      userId: user._id,
      action: 'added to top 5',
      bookTitle: title, // The book's title
      isbn: isbn, // The book's ISBN
      thumbnail: thumbnail, // The book's thumbnail
      timestamp: new Date(),
    });
    await newActivity.save();

    res.status(200).json({ success: true, message: 'Book added to top 5' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get user's top 5 books
app.get('/api/library/top5/:username', async (req, res) => {
  const { username } = req.params;
  
  try {
    const userLibrary = await UserLibrary.findOne({ username });
    if (userLibrary) {
      res.status(200).json({ success: true, top5: userLibrary.top5 });
    } else {
      res.status(404).json({ success: false, message: 'No library found for user' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.post('/api/library/top5/remove', async (req, res) => {
  const { username, isbn } = req.body;
  try {
      let userLibrary = await UserLibrary.findOne({ username });
      if (!userLibrary) {
          return res.status(404).json({ success: false, message: 'No library found for user' });
      }

      const bookIndex = userLibrary.top5.findIndex(book => book.isbn === isbn);
      if (bookIndex === -1) {
          return res.status(404).json({ success: false, message: 'Book not found in top 5' });
      }

      userLibrary.top5.splice(bookIndex, 1);
      await userLibrary.save();

      res.status(200).json({ success: true, message: 'Book removed from top 5' });
  } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Save review for a book in user's library
app.post('/api/library/review', async (req, res) => {
    const { username, isbn, review, rating, visibility = 'public' } = req.body;

    try {
        // Find or create user library
        let userLibrary = await UserLibrary.findOne({ username });
        if (!userLibrary) {
            return res.status(404).json({ success: false, message: 'No library found for user' });
        }

        // Find the book in user's library
        const book = userLibrary.books.find(book => book.isbn === isbn);
        if (!book) {
            return res.status(404).json({ success: false, message: 'Book not found in library' });
        }

        // Update the review in the user's library (old schema)
        book.review = review;
        book.rating = rating;
        book.reviewDate = new Date();
        book.visibility = visibility;

        // Save to user library
        await userLibrary.save();

        // Create or update the review in the Review collection (new schema)
        const reviewData = {
            username,
            isbn,
            bookTitle: book.title,
            review,
            rating,
            visibility,
            reviewDate: new Date()
        };

        await Review.findOneAndUpdate(
            { username, isbn },
            reviewData,
            { upsert: true, new: true }
        );

        // Log review as an activity
        const user = await User.findOne({ username });
        if (user) {
            const newActivity = new Activity({
                userId: user._id,
                action: 'reviewed',
                bookTitle: book.title,
                isbn: book.isbn,
                thumbnail: book.thumbnail,
                timestamp: new Date(),
                visibility,
                isRead: false
            });
            await newActivity.save();
        }

        res.status(200).json({ success: true, message: 'Review saved successfully' });
    } catch (error) {
        console.error('Error saving review:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.get('/api/library/:username/ratings', async (req, res) => {
  const { username } = req.params;

  try {
    const userLibrary = await UserLibrary.findOne({ username });
    if (!userLibrary) {
      return res.status(404).json({ success: false, message: 'No library found for user' });
    }

    // Extract only the ratings from the user's books
    const ratings = userLibrary.books
      .map(book => book.rating) // Access each book's rating
      .filter(rating => rating != null); // Filter out null or undefined ratings

    res.status(200).json({
      success: true,
      ratings: ratings,
      totalRatings: ratings.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Fetch a specific book's review and rating from user's library
app.get('/api/library/:username/books', async (req, res) => {
  const { username } = req.params;
  const { sortBy, page = 1, limit = 16, loggedInUsername } = req.query; // Accept the loggedInUsername from the query

  try {
    const userLibrary = await UserLibrary.findOne({ username });
    if (!userLibrary) {
      return res.status(404).json({ success: false, message: 'No library found for user' });
    }

    let books = userLibrary.books;

    // Filter the books based on visibility
    books = books.filter(book => {
      if (book.visibility === 'public') {
        return true; // Public reviews are visible to everyone
      }
      if (book.visibility === 'private') {
        return username === loggedInUsername; // Private reviews are only visible to the owner
      }
      if (book.visibility === 'friends') {
        return checkFriendship(username, loggedInUsername); // Friends-only reviews are visible to friends
      }
      return false;
    });

    // Sort the books based on the sortBy parameter
    if (sortBy === 'reviewDate') {
      books = books.sort((a, b) => {
        const dateA = a.reviewDate ? new Date(a.reviewDate) : new Date(0);
        const dateB = b.reviewDate ? new Date(b.reviewDate) : new Date(0);
        return dateB - dateA; // Sort in descending order
      });
    } else if (sortBy === 'rating') {
      books = books.sort((a, b) => b.rating - a.rating); // Sort by rating in descending order
    }

    // Pagination logic
    const startIndex = (page - 1) * limit;
    const paginatedBooks = books.slice(startIndex, startIndex + parseInt(limit));

    console.log(`[FETCH LIBRARY] Paginating books from index ${startIndex} to ${startIndex + limit}`);
    console.log(`[FETCH LIBRARY] Paginated books count: ${paginatedBooks.length}`);
    console.log(`[BACKEND] Books for page ${page}:`, paginatedBooks);

    // Total number of pages
    const totalPages = Math.ceil(books.length / limit);

    // Send the paginated books and total info back to the frontend
    res.status(200).json({
      success: true,
      books: paginatedBooks,
      currentPage: parseInt(page),
      totalPages: totalPages,
      totalBooks: books.length,
      //visibility: book.visibility
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
// Helper function to check if the logged-in user is a friend of the user whose library is being viewed
async function checkFriendship(username, loggedInUsername) {
  
  if (!loggedInUsername) {
    return false;
  }

  try {
    const user = await User.findOne({ username }).populate('friends');
    const loggedInUser = await User.findOne({ username: loggedInUsername });

    if (!user || !loggedInUser) {
      return false;
    }

    const isFriend = user.friends.some(friend => friend._id.equals(loggedInUser._id));
    return isFriend;
  } catch (error) {
    return false;
  }
}



// Add this new route to handle fetching a specific book's review by username and ISBN
app.get('/api/library/review/:username/:isbn', async (req, res) => {
  const { username, isbn } = req.params;

  try {
    // Find the user's library
    const userLibrary = await UserLibrary.findOne({ username });
    if (!userLibrary) {
      return res.status(404).json({ success: false, message: 'No library found for user' });
    }

    // Find the specific book in the user's library
    const book = userLibrary.books.find(book => book.isbn === isbn);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found in library' });
    }

    // Return the review and rating for that book
    res.status(200).json({
      success: true,
      review: book.review,
      rating: book.rating,
      reviewDate: book.reviewDate || null,
      visibility: book.visibility || 'public',  // Include visibility,
      isRead: false 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});


    

// PUT route to update a review for a book in user's library
app.put('/api/library/review', async (req, res) => {
  const { username, isbn, review, rating, visibility = 'public' } = req.body; // Default visibility to 'public' if not provided

  try {
    const userLibrary = await UserLibrary.findOne({ username });
    if (!userLibrary) {
      return res.status(404).json({ success: false, message: 'No library found for user' });
    }

    const book = userLibrary.books.find(book => book.isbn === isbn);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found in library' });
    }

    book.review = review;
    book.rating = rating;
    book.reviewDate = reviewDate || new Date(); // Update the date to the provided or current date
    book.visibility = visiblity;

    await userLibrary.save();

    // Log review update as an activity
    const user = await User.findOne({ username });
    if (user) {
      const newActivity = new Activity({
        userId: user._id,
        action: 'updated review for',
        bookTitle: book.title,  // Assuming book.title is available
        isbn: book.isbn,
        thumbnail: book.thumbnail,  // Assuming book.thumbnail is available
        timestamp: new Date(),
        username: user.username,
        isRead: false 
      });
      await newActivity.save();
    }

    res.status(200).json({ success: true, message: 'Review updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});


//add book to reading list
app.post('/api/library/readList/add', async (req, res) => {
  const { username, isbn, title, authors, description, thumbnail, categories, pageCount} = req.body;
  try {
    let userLibrary = await UserLibrary.findOne({ username });
    if (!userLibrary) {
      userLibrary = new UserLibrary({ username, books: [], top5: [], readList: [] });
    }

    // Check if the book is already in the reading list
    const existingBook = userLibrary.readList.find(book => book.isbn === isbn);
    if (existingBook) {
      return res.status(400).json({ success: false, message: 'Book already in reading list' });
    }

    userLibrary.readList.push({ isbn, title, authors, description, thumbnail, categories, pageCount});
    await userLibrary.save();
    const user = await User.findOne({ username });
    // Example of activity logging when adding a book to the reading list
    const newActivity = new Activity({
      userId: user._id,
      action: 'added to reading list',
      bookTitle: title, // The book's title
      isbn: isbn, // The book's ISBN
      thumbnail: thumbnail, // The book's thumbnail
      timestamp: new Date(),
      isRead: false 
    });
    await newActivity.save();

    res.status(200).json({ success: true, message: 'Book added to reading list' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
// Remove book from user's reading list
app.post('/api/library/readList/remove', async (req, res) => {
  const { username, isbn } = req.body;

  try {
      let userLibrary = await UserLibrary.findOne({ username });
      if (!userLibrary) {
          return res.status(404).json({ success: false, message: 'No reading list found for user' });
      }

      userLibrary.readList = userLibrary.readList.filter(book => book.isbn !== isbn);
      await userLibrary.save();

      res.status(200).json({ success: true, message: 'Book removed from reading list' });
  } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
//get books in reading list
app.get('/api/library/readList/:username', async (req, res) => {
  const { username } = req.params;
  const { page = 1, limit = 16 } = req.query; // Accept pagination parameters

  try {
    let userLibrary = await UserLibrary.findOne({ username });
    
    if (!userLibrary) {
      // If no userLibrary found, create an empty one for the user
      userLibrary = new UserLibrary({ username, books: [], top5: [], readList: [] });
      await userLibrary.save();
    }

    // Calculate the offset for pagination
    const offset = (page - 1) * limit;

    // Fetch the paginated readList items
    const paginatedReadList = userLibrary.readList.slice(offset, offset + limit);

    // Calculate total number of readList items
    const totalReadListItems = userLibrary.readList.length;

    // Calculate the number of pagination pages based on the limit
    const totalPaginationPages = Math.ceil(totalReadListItems / limit);

    res.status(200).json({
      success: true,
      readList: paginatedReadList,
      totalReadListItems,
      currentPage: Number(page),
      totalPaginationPages, // This represents the total pages for pagination
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});


app.get('/api/reviews/books/:isbn', async (req, res) => {
  const { isbn } = req.params;
  const { loggedInUsername } = req.query;

  try {
    // Find all reviews for this book
    const reviews = await Review.find({ isbn });

    if (!reviews || reviews.length === 0) {
        return res.status(404).json({ success: false, message: 'No reviews found for this book' });
    }

    const processedReviews = await Promise.all(reviews.map(async (review) => {
        // Check if the logged-in user has liked this review
        const isLikedByUser = review.likes.some(like => like.username === loggedInUsername);

        // Check visibility
        if (review.username === loggedInUsername) {
            // User can always see their own reviews
            return {
                _id: review._id,
                username: review.username,
                review: review.review,
                rating: review.rating,
                reviewDate: review.reviewDate,
                visibility: review.visibility,
                likes: review.likes.length,
                isLikedByUser
            };
        } else if (review.visibility === 'public') {
            // Public reviews are visible to everyone
            return {
                _id: review._id,
                username: review.username,
                review: review.review,
                rating: review.rating,
                reviewDate: review.reviewDate,
                visibility: review.visibility,
                likes: review.likes.length,
                isLikedByUser
            };
        } else if (review.visibility === 'friends') {
            // Check if users are friends
            const isFriend = await checkFriendship(review.username, loggedInUsername);
            if (isFriend) {
                return {
                    _id: review._id,
                    username: review.username,
                    review: review.review,
                    rating: review.rating,
                    reviewDate: review.reviewDate,
                    visibility: review.visibility,
                    likes: review.likes.length,
                    isLikedByUser
                };
            }
        }
        return null;
    }));

    // Filter out null values (reviews that shouldn't be visible)
    const visibleReviews = processedReviews.filter(review => review !== null);

    res.status(200).json({ success: true, reviews: visibleReviews });
  } catch (error) {
    console.error('Error fetching reviews for book:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});


// Endpoint to generate book lists

app.post('/api/generate-lists', (req, res) => {
  const query = req.body.query;

  if (!query) {
    return res.status(400).json({ error: 'No query provided' });
  }

  const pythonProcess = spawn(pythonCommand, ['public/functions/listgeneration.py', query]);

  let list = '';
  pythonProcess.stdout.on('data', (data) => {
    list += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });

  pythonProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`Python process exited with code ${code}`);
      return res.status(500).json({ error: 'Error generating recommendations' });
    }
    try {
      const listJSON = JSON.parse(list);
      res.status(200).json({ success: true, list: listJSON.list });
    } catch (error) {
      console.error('Error parsing list:', error);
      res.status(500).json({ error: 'Error parsing list' });
    }
  });
});

// New Opposite Recommendations Route
app.get('/api/opposite-recommendations/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const userLibrary = await UserLibrary.findOne({ username });
    if (!userLibrary) {
      console.error(`No library found for user: ${username}`);
      return res.status(404).json({ success: false, message: 'No library found for user' });
    }

    const library = userLibrary.books;
    if (library.length === 0) {
      console.log(`User ${username} has an empty library.`);
      return res.status(200).json({ success: true, recommendations: [] });
    }

    const pythonProcess = spawn(pythonCommand, ['public/functions/oppositerecommendations.py', JSON.stringify(library)]);

    let recommendations = '';
    pythonProcess.stdout.on('data', (data) => {
      recommendations += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python process exited with code ${code}`);
        return res.status(500).json({ success: false, message: 'Error generating recommendations' });
      }
      try {
        const recommendationsJSON = JSON.parse(recommendations);
        console.log('Parsed recommendations JSON:', JSON.stringify(recommendationsJSON, null, 2));
        res.status(200).json({ success: true, recommendations: recommendationsJSON });
      } catch (error) {
        console.error('Error parsing recommendations:', error);
        res.status(500).json({ success: false, message: 'Error parsing recommendations' });
      }
    });

  } catch (error) {
    console.error('Error during recommendations generation:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});


app.get('/api/search-users', async (req, res) => {
  const query = req.query.query;
  try {
    const users = await User.find({ username: new RegExp(query, 'i') }).select('username');
    res.status(200).json({ success: true, users });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Endpoint to send a friend request
// Endpoint to send a friend request
app.post('/api/add-friend', async (req, res) => {
  const { username, friendUsername } = req.body;

  try {
      const user = await User.findOne({ username });
      const friend = await User.findOne({ username: friendUsername });

      if (!user || !friend) {
          return res.status(404).json({ success: false, message: 'User or friend not found' });
      }

      // Check if a friend request already exists
      const existingRequest = await FriendRequest.findOne({ from: user._id, to: friend._id });
      if (existingRequest) {
          return res.status(400).json({ success: false, message: 'Friend request already sent' });
      }

      // Create a new friend request
      const friendRequest = new FriendRequest({
          from: user._id,
          to: friend._id,
      });

      await friendRequest.save();

      res.status(200).json({ success: true, message: 'Friend request sent successfully' });
  } catch (error) {
      console.error('Error sending friend request:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
  }
});




// Endpoint to accept a friend request
app.post('/api/accept-friend', async (req, res) => {
  const { username, requestId } = req.body;

  try {
    const friendRequest = await FriendRequest.findById(requestId).populate('from to');

    if (!friendRequest) {
      return res.status(404).json({ success: false, message: 'Friend request not found' });
    }

    const user = await User.findById(friendRequest.to._id);
    const friend = await User.findById(friendRequest.from._id);

    if (!user || !friend) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Add each other as friends
    user.friends.push(friend._id);
    friend.friends.push(user._id);
    await user.save();
    await friend.save();

    // Remove the friend request after it's accepted
    await FriendRequest.findByIdAndDelete(requestId);

    // Log activity for both users that they became friends
    const newFriendshipActivity = new Activity({
      userId: user._id,
      action: `became friends with`,
      bookTitle: friend.username,  // Using bookTitle as a placeholder for the friend's name
      timestamp: new Date(),
      isRead: false 
    });
    await newFriendshipActivity.save();

    const reciprocalFriendshipActivity = new Activity({
      userId: friend._id,
      action: `became friends with`,
      bookTitle: user.username,  // Using bookTitle as a placeholder for the friend's name
      timestamp: new Date(),
      isRead: false 
    });
    await reciprocalFriendshipActivity.save();

    res.status(200).json({ success: true, message: 'Friend request accepted' });
  } catch (error) {
    console.error('Error accepting friend request:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});





app.get('/api/number-of-friends/:username', async (req, res) => {
  const { username } = req.params;
  try {
      const user = await User.findOne({ username }).populate('friends');
      console.log('User data:', user);

      if (!user) {
          console.error(`User not found: ${username}`);
          return res.status(404).json({ success: false, message: 'User not found' });
      }

      if (!Array.isArray(user.friends)) {
          console.error(`User's friends: ${user.friends}`);
          console.log('User has no friends or friends field is not an array');
          return res.status(200).json({ success: true, numberOfFriends: 0 });
      }

      const numberOfFriends = user.friends.length;
      console.log(`User ${username} has ${numberOfFriends} friends.`);
      
      res.status(200).json({ success: true, numberOfFriends });
  } catch (error) {
      console.error('Error fetching number of friends:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
app.get('/api/friends/:username', async (req, res) => {
  const { username } = req.params;

  try {
    // Find the user by username and populate the friends list
    const user = await User.findOne({ username }).populate('friends');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, friends: user.friends });
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});


app.get('/api/friends-activities/:username', async (req, res) => {
    const { username } = req.params;
    try {
        const user = await User.findOne({ username }).populate('friends');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (!Array.isArray(user.friends) || user.friends.length === 0) {
            return res.status(200).json({ success: true, activities: [] });
        }

        const friendsActivities = [];

        // Single loop through friends
        for (const friend of user.friends) {
            // Get all activities for this friend
            const activities = await Activity.find({
                userId: friend._id,
                action: { $ne: 'nudge' },  // Exclude nudges
                $or: [
                    { visibility: 'public' },
                    { visibility: 'friends' },
                    { visibility: 'private', userId: friend._id }
                ]
            }).sort({ timestamp: -1 });

            // Get the friend's library to access review data
            const friendLibrary = await UserLibrary.findOne({ username: friend.username });
            
            console.log(`Activities found for friend ${friend.username}:`, activities);
            console.log(`Library found for friend ${friend.username}:`, friendLibrary);

            // Group activities by book
            const bookActivities = {};
            activities.forEach(activity => {
                if (!bookActivities[activity.bookTitle]) {
                    bookActivities[activity.bookTitle] = {
                        added: null,
                        reviewed: null,
                        libraryBook: friendLibrary ? 
                            friendLibrary.books.find(book => book.isbn === activity.isbn) : null
                    };
                }
                
                if (activity.action === 'added to library') {
                    bookActivities[activity.bookTitle].added = activity;
                } else if (activity.action === 'reviewed') {
                    bookActivities[activity.bookTitle].reviewed = activity;
                }
            });

            // Process each book's activities
            Object.entries(bookActivities).forEach(([bookTitle, actions]) => {
                console.log(`Processing book ${bookTitle} for friend ${friend.username}:`, actions);

                if (actions.reviewed) {
                    // Get the book data from the friend's library
                    const libraryBook = actions.libraryBook;
                    
                    // Check if the current user has liked this review
                    const isLikedByUser = libraryBook && libraryBook.likes ? 
                        libraryBook.likes.some(like => like.username === username) : false;
                    
                    // If there's a review, create a combined activity with library data
                    friendsActivities.push({
                        username: friend.username,
                        action: 'reviewed',
                        bookTitle: bookTitle,
                        isbn: actions.reviewed.isbn,
                        thumbnail: actions.reviewed.thumbnail,
                        review: libraryBook ? libraryBook.review : null,
                        rating: libraryBook ? libraryBook.rating : null,
                        timestamp: actions.reviewed.timestamp,
                        visibility: libraryBook ? libraryBook.visibility : 'public',
                        isRead: actions.reviewed.readBy.includes(user._id),
                        likes: libraryBook ? libraryBook.likes : [],
                        comments: libraryBook ? libraryBook.comments : [],
                        isLikedByUser: isLikedByUser
                    });
                } else if (actions.added) {
                    // If there's only an add action, include that
                    friendsActivities.push({
                        username: friend.username,
                        action: 'added to library',
                        bookTitle: bookTitle,
                        isbn: actions.added.isbn,
                        thumbnail: actions.added.thumbnail,
                        timestamp: actions.added.timestamp,
                        visibility: actions.added.visibility,
                        isRead: actions.added.readBy.includes(user._id)
                    });
                }
            });
        }

        // Sort all activities by timestamp
        friendsActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Filter out any activities with missing or invalid data
        const validActivities = friendsActivities.filter(activity => {
            try {
                return activity.username && 
                       activity.action && 
                       activity.bookTitle &&
                       activity.isbn;
            } catch (error) {
                console.log('Filtered out invalid activity:', error);
                return false;
            }
        });

        res.json({ success: true, activities: validActivities });
    } catch (error) {
        console.error('Error fetching activities:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.get('/api/friend-requests/:username', async (req, res) => {
  // Ensure this route is correctly defined and matches the client-side fetch call.
  try {
      const username = req.params.username;
      const user = await User.findOne({ username });

      if (!user) {
          return res.status(404).json({ success: false, message: 'User not found' });
      }

      const friendRequests = await FriendRequest.find({ to: user._id, status: 'pending' }).populate('from', 'username');
      res.status(200).json({ success: true, friendRequests });
  } catch (error) {
      console.error('Error fetching friend requests:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Endpoint to check friendship status between two users
app.post('/api/check-friendship-status', async (req, res) => {
  const { username, friendUsername } = req.body;

  try {
    const user = await User.findOne({ username }).populate('friends');
    const friend = await User.findOne({ username: friendUsername });

    if (!user || !friend) {
      return res.status(404).json({ success: false, message: 'User or friend not found' });
    }

    // Check if the users are already friends
    const isFriend = user.friends.some(f => f.username === friendUsername);
    if (isFriend) {
      return res.status(200).json({ success: true, status: 'friend' });
    }

    // Check if there is a pending friend request from the logged-in user to the friend
    const isPendingFromUser = await FriendRequest.findOne({ from: user._id, to: friend._id, status: 'pending' });
    if (isPendingFromUser) {
      return res.status(200).json({ success: true, status: 'pending' });
    }

    // Check if there is a pending friend request from the friend to the logged-in user
    const isPendingFromFriend = await FriendRequest.findOne({ from: friend._id, to: user._id, status: 'pending' });
    if (isPendingFromFriend) {
      return res.status(200).json({ success: true, status: 'pending' });
    }

    // If not friends and no pending request, return 'none'
    return res.status(200).json({ success: true, status: 'none' });

  } catch (error) {
    console.error('Error checking friendship status:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
//add to your own current reading
app.post('/api/library/currently-reading/add', async (req, res) => {
  try {
    const { username, isbn, title, authors, description, thumbnail, categories, pageCount } = req.body;

    if (!username || !isbn || !title) {
      return res.status(400).json({ error: 'Username, ISBN, and Title are required.' });
    }

    const userLibrary = await UserLibrary.findOne({ username });

    if (!userLibrary) {
      console.error('User library not found for username:', username);
      return res.status(404).json({ error: 'User library not found.' });
    }

    // Check if the book already exists in Currently Reading
    const isAlreadyReading = userLibrary.currentlyReading.books.some(book => book.isbn === isbn);
    if (isAlreadyReading) {
      return res.status(400).json({ error: 'Book is already in your Currently Reading list.' });
    }

    // Set the start date to the current date (beginning of the day)
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    // Add the book to Currently Reading
    userLibrary.currentlyReading.books.push({
      isbn,
      title,
      authors,
      description,
      thumbnail,
      categories,
      pageCount,
      startDate,
    });

    // Also add to reading history immediately
    if (!userLibrary.readingHistory) {
      userLibrary.readingHistory = [];
    }

    // Add to reading history with the same start date
    userLibrary.readingHistory.push({
      isbn,
      title,
      authors,
      description,
      thumbnail,
      categories,
      pageCount,
      startDate,
      endDate: null // null endDate indicates still reading
    });

    await userLibrary.save();

    res.status(200).json({ 
      message: 'Book added to Currently Reading!', 
      currentlyReading: userLibrary.currentlyReading.books 
    });
  } catch (error) {
    console.error('Error in /api/library/currently-reading/add:', error.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});



//get a users' current reading
app.get('/api/library/:username/currently-reading', async (req, res) => {
  try {
    const username = req.params.username;

    // Find the user's library and ensure 'currentlyReading.books' is fully retrieved
    const userLibrary = await UserLibrary.findOne({ username }).select('currentlyReading');

    if (!userLibrary) {
      return res.status(404).json({ error: 'User library not found.' });
    }

    const currentlyReading = userLibrary.currentlyReading.books.map(book => ({
      isbn: book.isbn,
      title: book.title,
      authors: book.authors,
      description: book.description,
      thumbnail: book.thumbnail,
      categories: book.categories,
      pageCount: book.pageCount,
      startDate: book.startDate, // Include startDate
    }));

    res.status(200).json({
      success: true,
      currentlyReading
    });
  } catch (error) {
    console.error('Error fetching currently reading:', error.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});
app.post('/api/library/:username/currently-reading/end', async (req, res) => {
  try {
    const { username } = req.params;
    const { isbn } = req.body;

    if (!isbn) {
      return res.status(400).json({ success: false, message: 'ISBN is required to end currently reading.' });
    }

    const userLibrary = await UserLibrary.findOne({ username });

    if (!userLibrary) {
      return res.status(404).json({ success: false, message: 'User library not found.' });
    }

    // Find the book in currently reading
    const bookIndex = userLibrary.currentlyReading.books.findIndex(book => book.isbn === isbn);

    if (bookIndex === -1) {
      return res.status(400).json({ success: false, message: 'Book not found in Currently Reading list.' });
    }

    // Set end date to current date (beginning of the day)
    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);

    // Find and update the corresponding entry in reading history
    const historyIndex = userLibrary.readingHistory.findIndex(book => book.isbn === isbn && !book.endDate);
    if (historyIndex !== -1) {
      userLibrary.readingHistory[historyIndex].endDate = endDate;
    }

    // Remove from currently reading
    userLibrary.currentlyReading.books.splice(bookIndex, 1);

    await userLibrary.save();

    res.status(200).json({
      success: true,
      message: 'Reading ended successfully.',
      currentlyReading: userLibrary.currentlyReading.books
    });
  } catch (error) {
    console.error('Error ending currently reading:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// adding likes
app.post('/api/library/review/:reviewId/like', async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { username } = req.body;

    const userLibrary = await UserLibrary.findOne({ "books._id": reviewId });

    if (!userLibrary) {
      return res.status(404).json({ success: false, message: 'User library not found' });
    }

    const book = userLibrary.books.find(book => book._id.toString() === reviewId);

    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    if (!book.likes.includes(username)) {
      book.likes.push(username);
    } else {
      return res.status(400).json({ success: false, message: 'You already liked this review.' });
    }

    await userLibrary.save();
    res.status(200).json({ success: true, likes: book.likes.length });
  } catch (error) {
    console.error('Error liking review:', error);
    res.status(500).json({ success: false, message: 'Error liking review' });
  }
});

// Removing likes
app.post('/api/library/review/:reviewId/unlike', async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { username } = req.body;

    const userLibrary = await UserLibrary.findOne({ "books._id": reviewId });

    if (!userLibrary) {
      return res.status(404).json({ success: false, message: 'User library not found' });
    }

    const book = userLibrary.books.find(book => book._id.toString() === reviewId);

    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    book.likes = book.likes.filter(user => user !== username);

    await userLibrary.save();
    res.status(200).json({ success: true, likes: book.likes.length });
  } catch (error) {
    console.error('Error unliking review:', error);
    res.status(500).json({ success: false, message: 'Error unliking review' });
  }
});

// Create a new list
app.post('/api/lists/create', async (req, res) => {
  const { username, listName, tags, visibility, description, books } = req.body;

  try {
      const newList = new UserList({
          username,
          listName,
          tags,
          visibility,
          description,
          books,
          createdAt: new Date()
      });

      await newList.save();
      res.status(201).json({ success: true, list: newList });
  } catch (error) {
      console.error('Error creating list:', error);
      res.status(500).json({ success: false, message: 'Failed to create list' });
  }
});

// Get user's lists
app.get('/api/users/:username/lists', async (req, res) => {
  const { username } = req.params;

  try {
      const lists = await UserList.find({ username }).sort({ createdAt: -1 });
      res.status(200).json({ success: true, lists });
  } catch (error) {
      console.error('Error fetching lists:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch lists' });
  }
});

// Delete a list
app.delete('/api/lists/:listId', async (req, res) => {
  const { listId } = req.params;
  const { username } = req.body;

  try {
      const list = await UserList.findOne({ _id: listId, username });
      if (!list) {
          return res.status(404).json({ success: false, message: 'List not found' });
      }

      await UserList.findByIdAndDelete(listId);
      res.status(200).json({ success: true });
  } catch (error) {
      console.error('Error deleting list:', error);
      res.status(500).json({ success: false, message: 'Failed to delete list' });
  }
});

app.get('/api/sample-books', async (req, res) => {
  try {
    // Generate a random search term from this list of common words
    const searchTerms = ['love', 'mystery', 'adventure', 'science', 'history', 'fantasy'];
    const randomTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
    
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${randomTerm}&maxResults=10&langRestrict=en`
    );
    const data = await response.json();
    
    // Format the books data
    const books = data.items.map(item => ({
      title: item.volumeInfo.title,
      authors: item.volumeInfo.authors || ['Unknown Author'],
      thumbnail: item.volumeInfo.imageLinks?.thumbnail || '',
      isbn: item.volumeInfo.industryIdentifiers?.[0]?.identifier || ''
    }));

    res.json({ success: true, books });
  } catch (error) {
    console.error('Error fetching sample books:', error);
    res.status(500).json({ success: false, message: 'Error fetching sample books' });
  }
});

// Add book to list
app.post('/api/lists/:listId/books', async (req, res) => {
    const { listId } = req.params;
    const { username, book } = req.body;

    try {
        const list = await UserList.findOne({ _id: listId, username });
        if (!list) {
            return res.status(404).json({ success: false, message: 'List not found' });
        }

        list.books.push(book);
        await list.save();

        res.json({ success: true, list });
    } catch (error) {
        console.error('Error adding book to list:', error);
        res.status(500).json({ success: false, message: 'Failed to add book to list' });
    }
});

// Remove book from list
app.delete('/api/lists/:listId/books/:isbn', async (req, res) => {
    const { listId, isbn } = req.params;
    const { username } = req.body;

    try {
        const list = await UserList.findOne({ _id: listId, username });
        if (!list) {
            return res.status(404).json({ success: false, message: 'List not found' });
        }

        list.books = list.books.filter(book => book.isbn !== isbn);
        await list.save();

        res.json({ success: true, list });
    } catch (error) {
        console.error('Error removing book from list:', error);
        res.status(500).json({ success: false, message: 'Failed to remove book from list' });
    }
});

// Update list
app.put('/api/lists/:listId', async (req, res) => {
    const { listId } = req.params;
    const { username, listName, tags, visibility, description, books } = req.body;

    try {
        const list = await UserList.findOneAndUpdate(
            { _id: listId, username },
            { 
                listName, 
                tags, 
                visibility, 
                description,
                books, // Include the updated books array
                updatedAt: new Date()
            },
            { new: true }
        );

        if (!list) {
            return res.status(404).json({ success: false, message: 'List not found' });
        }

        res.json({ success: true, list });
    } catch (error) {
        console.error('Error updating list:', error);
        res.status(500).json({ success: false, message: 'Failed to update list' });
    }
});


app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

// Like a list
app.post('/api/lists/:listId/like', async (req, res) => {
    try {
        const { listId } = req.params;
        const { username } = req.body;

        const list = await UserList.findById(listId);
        if (!list) {
            return res.status(404).json({ success: false, message: 'List not found' });
        }

        // Check if user has already liked this list
        const hasLiked = list.likes.some(like => like.username === username);
        if (hasLiked) {
            return res.status(400).json({ success: false, message: 'You have already liked this list' });
        }

        // Add like with timestamp
        list.likes.push({
            username: username,
            timestamp: new Date()
        });
        await list.save();

        res.json({ success: true, likes: list.likes });
    } catch (error) {
        console.error('Error liking list:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.post('/api/lists/:listId/unlike', async (req, res) => {
    try {
        const { listId } = req.params;
        const { username } = req.body;

        const list = await UserList.findById(listId);
        if (!list) {
            return res.status(404).json({ success: false, message: 'List not found' });
        }

        // Remove like by username
        list.likes = list.likes.filter(like => like.username !== username);
        await list.save();

        res.json({ success: true, likes: list.likes });
    } catch (error) {
        console.error('Error unliking list:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.post('/api/reviews/:isbn/like', async (req, res) => {
    try {
        const { isbn } = req.params;
        const { username } = req.body;
        
        console.log(`[LIKE REVIEW] Attempting to toggle like for ISBN: ${isbn} by user: ${username}`);

        // Find the review by ISBN
        let review = await Review.findOne({ isbn });
        console.log('[LIKE REVIEW] Query result from Review collection:', {
            found: !!review,
            query: { isbn },
            review: review ? {
                username: review.username,
                isbn: review.isbn,
                likes: review.likes
            } : null
        });
        
        // If not found in Review collection, check the old schema
        if (!review) {
            console.log(`[LIKE REVIEW] Review not found in new schema, checking old schema`);
            const userLibrary = await UserLibrary.findOne({
                "books.isbn": isbn
            });

            if (userLibrary) {
                const book = userLibrary.books.find(b => b.isbn === isbn);
                if (book && (book.review || book.rating)) {
                    // Create new review in Review collection
                    review = new Review({
                        username: userLibrary.username,
                        isbn: book.isbn,
                        bookTitle: book.title,
                        review: book.review,
                        rating: book.rating,
                        reviewDate: book.reviewDate || new Date(),
                        visibility: book.visibility || 'public',
                        likes: book.likes || []
                    });
                    await review.save();
                    console.log(`[LIKE REVIEW] Created new review from old schema for ${book.title}`);
                }
            }
        }

        if (!review) {
            console.log(`[LIKE REVIEW] No review found for ISBN: ${isbn}`);
            return res.status(404).json({ success: false, message: 'Review not found' });
        }

        // Check if user has already liked this review
        const existingLikeIndex = review.likes.findIndex(like => like.username === username);
        
        if (existingLikeIndex !== -1) {
            // User has already liked the review, so unlike it
            review.likes.splice(existingLikeIndex, 1);
            console.log(`[LIKE REVIEW] Removed like by user ${username}`);
        } else {
            // User hasn't liked the review, so add a like with isRead=false
            review.likes.push({
                username: username,
                timestamp: new Date(),
                isRead: false
            });
            console.log(`[LIKE REVIEW] Added like by user ${username} with isRead=false`);
        }

        await review.save();

        // Also update the like in the old schema if it exists
        const oldReview = await UserLibrary.findOne({
            "books.isbn": isbn,
            username: review.username
        });
        if (oldReview) {
            const book = oldReview.books.find(b => b.isbn === isbn);
            if (book) {
                // Ensure the like has isRead=false when adding to old schema
                if (existingLikeIndex === -1) {
                    book.likes = book.likes || [];
                    book.likes.push({
                        username: username,
                        timestamp: new Date(),
                        isRead: false
                    });
                } else {
                    book.likes = book.likes.filter(like => like.username !== username);
                }
                await oldReview.save();
                console.log(`[LIKE REVIEW] Updated old schema with like status: isRead=false`);
            }
        }

        console.log(`[LIKE REVIEW] Successfully toggled like. New likes count: ${review.likes.length}`);

        res.json({ 
            success: true, 
            likes: review.likes,
            isLiked: existingLikeIndex === -1 // true if we just liked it, false if we just unliked it
        });
    } catch (error) {
        console.error('[LIKE REVIEW] Error toggling like:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.post('/api/reviews/:isbn/unlike', async (req, res) => {
    try {
        const { isbn } = req.params;
        const { username } = req.body;

        console.log(`[UNLIKE REVIEW] Attempting to unlike review for ISBN: ${isbn} by user: ${username}`);

        // Find the review by ISBN
        let review = await Review.findOne({ isbn });
        
        // If not found in Review collection, check the old schema
        if (!review) {
            console.log(`[UNLIKE REVIEW] Review not found in new schema, checking old schema`);
            const userLibrary = await UserLibrary.findOne({
                "books.isbn": isbn
            });

            if (userLibrary) {
                const book = userLibrary.books.find(b => b.isbn === isbn);
                if (book && (book.review || book.rating)) {
                    // Create new review in Review collection
                    review = new Review({
                        username: userLibrary.username,
                        isbn: book.isbn,
                        bookTitle: book.title,
                        review: book.review,
                        rating: book.rating,
                        reviewDate: book.reviewDate || new Date(),
                        visibility: book.visibility || 'public',
                        likes: book.likes || []
                    });
                    await review.save();
                    console.log(`[UNLIKE REVIEW] Created new review from old schema for ${book.title}`);
                }
            }
        }

        if (!review) {
            console.log(`[UNLIKE REVIEW] No review found for ISBN: ${isbn}`);
            return res.status(404).json({ success: false, message: 'Review not found' });
        }

        console.log(`[UNLIKE REVIEW] Found review by user: ${review.username}`);

        // Remove like by username
        review.likes = review.likes.filter(like => like.username !== username);
        await review.save();

        // Also update the like in the old schema if it exists
        const oldReview = await UserLibrary.findOne({
            "books.isbn": isbn,
            username: review.username
        });
        if (oldReview) {
            const book = oldReview.books.find(b => b.isbn === isbn);
            if (book) {
                book.likes = review.likes;
                await oldReview.save();
            }
        }

        console.log(`[UNLIKE REVIEW] Successfully removed like. New likes count: ${review.likes.length}`);

        res.json({ 
            success: true, 
            likes: review.likes,
            isLiked: false
        });
    } catch (error) {
        console.error('[UNLIKE REVIEW] Error unliking review:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Add this new endpoint to get friends' lists
app.get('/api/users/:username/friends-lists', async (req, res) => {
    const { username } = req.params;

    try {
        // Find the user and populate their friends
        const user = await User.findOne({ username }).populate('friends');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Get the usernames of all friends
        const friendUsernames = user.friends.map(friend => friend.username);

        // Find all public and friends-only lists from friends
        const friendsLists = await UserList.find({
            username: { $in: friendUsernames },
            visibility: { $in: ['public', 'friends'] }
        }).sort({ createdAt: -1 });

        res.status(200).json({ success: true, friendsLists });
    } catch (error) {
        console.error('Error fetching friends\' lists:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch friends\' lists' });
    }
});

// Add this to your server.js or appropriate route file
app.get('/api/library/:username/reading-history', async (req, res) => {
  try {
    const { username } = req.params;
    const userLibrary = await UserLibrary.findOne({ username });

    if (!userLibrary) {
      return res.status(404).json({ success: false, message: 'User library not found' });
    }

    // Get all reading history entries
    const readingHistory = (userLibrary.readingHistory || []).map(book => ({
      ...book.toObject(),
      isActive: !book.endDate // Book is active if it doesn't have an end date
    }));

    res.json({
      success: true,
      readingHistory
    });
  } catch (error) {
    console.error('Error fetching reading history:', error);
    res.status(500).json({ success: false, message: 'Error fetching reading history' });
  }
});

// Current unified search endpoint needs to be modified to:
// 1. Ensure proper ordering (users -> lists -> books)
// 2. Filter out books without thumbnails
// 3. Combine results in the desired order

app.get('/api/unified-search', async (req, res) => {
    const { query, type } = req.query;
    const results = {
        books: [],
        lists: [],
        users: []
    };

    try {
        // Search for users first
        if (!type || type === 'users') {
            const users = await User.find({
                username: { $regex: query, $options: 'i' }
            }).limit(5);

            results.users = users.map(user => ({
                type: 'user',
                username: user.username,
                profilePicture: user.profilePicture
            }));
        }

        // Then search for lists
        if (!type || type === 'lists') {
            const lists = await UserList.find({
                $or: [
                    { listName: { $regex: query, $options: 'i' } },
                    { description: { $regex: query, $options: 'i' } }
                ],
                visibility: 'public'
            }).limit(5);

            results.lists = lists.map(list => ({
                type: 'list',
                id: list._id,
                name: list.listName,
                description: list.description,
                username: list.username,
                bookCount: list.books.length,
                thumbnail: list.books[0]?.thumbnail || 'https://via.placeholder.com/128x192?text=No+Image'
            }));
        }

        // Finally search for books
        if (!type || type === 'books') {
            const apiKey = 'AIzaSyCFDaqjpgA8K_NqqCw93xorS3zumc_52u8';
            const googleBooksResponse = await fetch(
                `https://www.googleapis.com/books/v1/volumes?q=${query}&key=${apiKey}&maxResults=20` // Increased to 10 since we'll filter some out
            );
            const booksData = await googleBooksResponse.json();
            
            if (booksData.items) {
                // Filter out books without thumbnails and map the results
                results.books = booksData.items
                    .filter(item => item.volumeInfo.imageLinks?.thumbnail)
                    .slice(0, 15) // Keep only first 5 books that have thumbnails
                    .map(item => ({
                        type: 'book',
                        title: item.volumeInfo.title,
                        authors: item.volumeInfo.authors || ['Unknown'],
                        thumbnail: item.volumeInfo.imageLinks.thumbnail,
                        isbn: item.volumeInfo.industryIdentifiers?.[0]?.identifier || '',
                        description: item.volumeInfo.description || ''
                    }));
            }
        }

        // Combine results in the desired order: users -> lists -> books
        const combinedResults = [
            ...results.users,
            ...results.lists,
            ...results.books
        ];

        res.json({
            success: true,
            results: {
                users: results.users,
                lists: results.lists,
                books: results.books,
                combined: combinedResults
            }
        });

    } catch (error) {
        console.error('Error in unified search:', error);
        res.status(500).json({ success: false, message: 'Error performing search' });
    }
});

const fetchActivities = async () => {
    try {
        console.log('Fetching activities for user:', username);
        const response = await fetch(`/api/friends-activities/${username}`);
        
        if (!response.ok) {
            throw new Error(`Error fetching activities: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.success) {
            console.log('Raw response data:', data);
            
            // Log the first activity in detail if it exists
            if (data.activities && data.activities.length > 0) {
                console.log('First activity details:', {
                    full: data.activities[0],
                    keys: Object.keys(data.activities[0]),
                    review: data.activities[0].review,
                    rating: data.activities[0].rating,
                    action: data.activities[0].action,
                    bookTitle: data.activities[0].bookTitle
                });

                // Check each activity for review and rating
                data.activities.forEach((activity, index) => {
                    console.log(`Activity ${index} check:`, {
                        hasReview: 'review' in activity,
                        reviewValue: activity.review,
                        hasRating: 'rating' in activity,
                        ratingValue: activity.rating,
                        action: activity.action
                    });
                });
            }

            // Transform the activities to ensure review and rating are properly handled
            const processedActivities = data.activities.map(activity => ({
                ...activity,
                review: activity.review || null,
                rating: activity.rating || null,
                // Ensure all required properties are present
                username: activity.username,
                action: activity.action,
                bookTitle: activity.bookTitle,
                isbn: activity.isbn,
                thumbnail: activity.thumbnail,
                timestamp: activity.timestamp,
                visibility: activity.visibility || 'public',
                isRead: activity.isRead || false
            }));

            console.log('Processed activities:', processedActivities);

            // Render the processed activities
            renderActivitiesFeed(processedActivities);
        } else {
            console.error('Failed to fetch activities:', data.message);
        }
    } catch (error) {
        console.error('Error in fetchActivities:', error);
    }
};

// Add this endpoint to server.js
app.post('/api/decline-friend', async (req, res) => {
    const { username, requestId } = req.body;

    try {
        const friendRequest = await FriendRequest.findById(requestId);

        if (!friendRequest) {
            return res.status(404).json({ success: false, message: 'Friend request not found' });
        }

        // Delete the friend request
        await FriendRequest.findByIdAndDelete(requestId);

        res.status(200).json({ success: true, message: 'Friend request declined' });
    } catch (error) {
        console.error('Error declining friend request:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Add this endpoint to server.js
app.get('/api/likes-notifications/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const user = await User.findOne({ username });
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Get user's library to find reviews that have been liked
        const userLibrary = await UserLibrary.findOne({ username });
        const reviewLikes = [];

        if (userLibrary && userLibrary.books) {
            userLibrary.books.forEach(book => {
                if (book.likes && book.likes.length > 0) {
                    // Get the most recent likes with their timestamps
                    const recentLikes = book.likes.slice(-5).map(like => ({
                        username: like.username,
                        timestamp: like.timestamp
                    }));
                    
                    reviewLikes.push({
                        type: 'review',
                        bookTitle: book.title,
                        isbn: book.isbn,
                        thumbnail: book.thumbnail,
                        likedBy: recentLikes.map(like => like.username),
                        timestamp: recentLikes[recentLikes.length - 1].timestamp
                    });
                }
            });
        }

        // Get user's lists that have been liked
        const userLists = await UserList.find({ username });
        const listLikes = [];

        userLists.forEach(list => {
            if (list.likes && list.likes.length > 0) {
                // Get the most recent likes with their timestamps
                const recentLikes = list.likes.slice(-5).map(like => ({
                    username: like.username,
                    timestamp: like.timestamp
                }));
                
                listLikes.push({
                    type: 'list',
                    listName: list.listName,
                    listId: list._id,
                    likedBy: recentLikes.map(like => like.username),
                    timestamp: recentLikes[recentLikes.length - 1].timestamp
                });
            }
        });

        // Combine and sort all likes by timestamp in descending order
        const allLikes = [...reviewLikes, ...listLikes].sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );

        res.json({ success: true, likes: allLikes });
    } catch (error) {
        console.error('Error fetching likes notifications:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Add this endpoint to server.js
app.post('/api/nudge-friend', async (req, res) => {
    const { fromUsername, toUsername } = req.body;

    try {
        const fromUser = await User.findOne({ username: fromUsername });
        const toUser = await User.findOne({ username: toUsername });

        if (!fromUser || !toUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Create a new activity for the nudge
        const newActivity = new Activity({
            userId: toUser._id, // The recipient
            action: 'nudge',
            bookTitle: fromUsername, // Using bookTitle to store the sender's username
            timestamp: new Date(),
            isRead: false,
            type: 'nudge' // Add a type field to distinguish nudges
        });

        await newActivity.save();

        res.status(200).json({ success: true, message: 'Nudge sent successfully' });
    } catch (error) {
        console.error('Error sending nudge:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Add this endpoint to server.js
app.get('/api/nudge-notifications/:username', async (req, res) => {
    try {
        const { username } = req.params;
        console.log('Fetching nudges for user:', username);

        const user = await User.findOne({ username });
        
        if (!user) {
            console.log('User not found:', username);
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Remove the type condition since we're only using action
        const nudges = await Activity.find({
            userId: user._id,
            action: 'nudge'
        })
        .sort({ timestamp: -1 })
        .limit(5);

        console.log('Found nudges:', nudges);

        const transformedNudges = nudges.map(nudge => ({
            _id: nudge._id,
            fromUsername: nudge.bookTitle, // We stored the sender's username in bookTitle
            timestamp: nudge.timestamp,
            isRead: nudge.isRead || false
        }));

        console.log('Transformed nudges:', transformedNudges);

        res.json({ success: true, nudges: transformedNudges });
    } catch (error) {
        console.error('Error fetching nudge notifications:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Add this endpoint to mark notifications as read
app.post('/api/mark-notifications-read', async (req, res) => {
    const { username } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Mark all activities as read for this user
        try {
            await Activity.updateMany(
                { userId: { $in: user.friends }, readBy: { $ne: user._id } },
                { $addToSet: { readBy: user._id } }
            );
        } catch (activityError) {
            console.error('Error marking activities as read:', activityError);
            // Continue execution even if activities update fails
        }

        // Mark all friend requests as read
        try {
            await FriendRequest.updateMany(
                { to: user._id, isRead: false },
                { $set: { isRead: true } }
            );
        } catch (friendRequestError) {
            console.error('Error marking friend requests as read:', friendRequestError);
            // Continue execution even if friend requests update fails
        }

        // Initialize counter for updated likes
        let updatedLikesCount = 0;
        let problematicBooks = [];

        // Mark all likes as read in user's library
        const userLibrary = await UserLibrary.findOne({ username });
        if (userLibrary) {
            console.log('\n=== Marking likes as read ===');
            
            userLibrary.books.forEach(book => {
                if (book.likes) {
                    try {
                        // Convert any string likes to objects with isRead property
                        book.likes = book.likes.map(like => {
                            if (typeof like === 'string') {
                                return {
                                    username: like,
                                    timestamp: new Date(),
                                    isRead: true
                                };
                            } else if (!like.isRead) {
                                like.isRead = true;
                                updatedLikesCount++;
                                console.log(`Marking like from ${like.username} on book "${book.title}" as read`);
                            }
                            return like;
                        });
                    } catch (likeError) {
                        console.error(`Error processing likes for book "${book.title}":`, likeError);
                        problematicBooks.push({
                            title: book.title,
                            isbn: book.isbn,
                            error: likeError.message
                        });
                        // Skip this book's likes but continue with others
                    }
                }
            });
            
            console.log(`Total likes marked as read: ${updatedLikesCount}`);
            if (problematicBooks.length > 0) {
                console.log('Books with problematic likes:', problematicBooks);
            }
            
            try {
                await userLibrary.save();
            } catch (saveError) {
                console.error('Error saving user library:', saveError);
                // Continue execution even if save fails
            }
        }

        // Update lastNotificationCheck timestamp
        try {
            await User.findOneAndUpdate(
                { username },
                { lastNotificationCheck: new Date() }
            );
        } catch (timestampError) {
            console.error('Error updating last notification check:', timestampError);
            // Continue execution even if timestamp update fails
        }

        res.status(200).json({ 
            success: true, 
            message: 'All notifications marked as read',
            updatedLikesCount: updatedLikesCount,
            problematicBooks: problematicBooks
        });
    } catch (error) {
        console.error('Error marking notifications as read:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Add this endpoint to get suggested friends
app.get('/api/suggested-friends/:username', async (req, res) => {
    const { username } = req.params;
    const { limit = 5, skip = 0 } = req.query;

    console.log('\n=== Starting Friend Suggestions Process ===');
    console.log(`Looking for suggestions for user: ${username}`);
    console.log(`Limit: ${limit}, Skip: ${skip}`);

    try {
        const user = await User.findOne({ username }).populate('friends');
        if (!user) {
            console.log('❌ User not found');
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        console.log('\n=== Current User Info ===');
        console.log(`Username: ${user.username}`);
        console.log(`Number of current friends: ${user.friends.length}`);
        console.log('Current friends:', user.friends.map(f => f.username));

        // Get user's current friends' IDs
        const userFriendIds = user.friends.map(friend => friend._id);
        console.log('\n=== User Friend IDs ===');
        console.log('User friend IDs:', userFriendIds.map(id => id.toString()));

        // Get all users except the current user and their friends
        const allOtherUsers = await User.find({
            _id: { 
                $nin: [...userFriendIds, user._id] 
            }
        }).populate('friends');

        console.log('\n=== Potential Friends Found ===');
        console.log(`Total potential friends: ${allOtherUsers.length}`);
        console.log('Potential friend usernames:', allOtherUsers.map(u => u.username));

        // Calculate mutual friends for each potential friend
        console.log('\n=== Calculating Mutual Friends ===');
        const suggestedFriends = await Promise.all(allOtherUsers.map(async (potentialFriend) => {
            console.log(`\nProcessing ${potentialFriend.username}:`);
            console.log(`- Their friend IDs:`, potentialFriend.friends.map(f => f._id.toString()));
            
            // Debug the mutual friends calculation
            const mutualFriends = potentialFriend.friends.filter(friend => {
                const isMutual = userFriendIds.some(userFriend => {
                    const isMatch = userFriend.toString() === friend._id.toString();
                    if (isMatch) {
                        console.log(`Found mutual friend: ${friend.username}`);
                    }
                    return isMatch;
                });
                return isMutual;
            });

            console.log(`- Total friends: ${potentialFriend.friends.length}`);
            console.log(`- Mutual friends: ${mutualFriends.length}`);
            if (mutualFriends.length > 0) {
                console.log(`- Mutual friend names: ${mutualFriends.map(f => f.username).join(', ')}`);
            }

            return {
                username: potentialFriend.username,
                mutualFriendsCount: mutualFriends.length,
                mutualFriends: mutualFriends.map(friend => friend.username).slice(0, 3)
            };
        }));

        // Sort by number of mutual friends and get the requested slice
        console.log('\n=== Sorting and Filtering Suggestions ===');
        const sortedSuggestions = suggestedFriends
            .filter(friend => friend.mutualFriendsCount > 0)
            .sort((a, b) => b.mutualFriendsCount - a.mutualFriendsCount)
            .slice(skip, skip + parseInt(limit));

        console.log(`\nFinal suggestions count: ${sortedSuggestions.length}`);
        console.log('Final suggestions:', sortedSuggestions);

        console.log('\n=== Sending Response ===');
        res.json({
            success: true,
            suggestions: sortedSuggestions,
            hasMore: sortedSuggestions.length === parseInt(limit)
        });
        console.log('=== Friend Suggestions Process Complete ===\n');
    } catch (error) {
        console.error('\n❌ Error in friend suggestions process:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Add endpoint to dismiss a friend suggestion
app.post('/api/dismiss-friend-suggestion', async (req, res) => {
    const { username, suggestedUsername } = req.body;
    try {
        // Here you could store dismissed suggestions in a new collection if you want to persist them
        // For now, we'll just return success
        res.json({ success: true, message: 'Suggestion dismissed' });
    } catch (error) {
        console.error('Error dismissing friend suggestion:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Create GridFS storage engine
const storage = new GridFsStorage({
    url: mongoUri,
    options: { useNewUrlParser: true, useUnifiedTopology: true },
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(16, (err, buf) => {
                if (err) {
                    return reject(err);
                }
                const filename = buf.toString('hex') + path.extname(file.originalname);
                const fileInfo = {
                    filename: filename,
                    bucketName: 'profilePics',
                    metadata: {
                        username: req.body.username
                    }
                };
                resolve(fileInfo);
            });
        });
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Not an image! Please upload an image file.'), false);
        }
    }
});

// Initialize GridFS stream
let gfs;
mongoose.connection.once('open', () => {
    gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'profilePics'
    });
});

// Upload profile picture endpoint
app.post('/api/upload-profile-pic', upload.single('profilePic'), async (req, res) => {
    try {
        const { username } = req.body;
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        // Find and delete old profile picture if it exists
        const user = await User.findOne({ username });
        if (user.profilePicture && user.profilePicture !== '../profile.png') {
            try {
                await gfs.delete(new mongoose.Types.ObjectId(user.profilePicture));
            } catch (err) {
                console.log('No old file to delete or error deleting:', err);
            }
        }

        // Update user with new file ID
        const updatedUser = await User.findOneAndUpdate(
            { username },
            { profilePicture: req.file.id },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            fileId: req.file.id,
            message: 'Profile picture uploaded successfully'
        });
    } catch (error) {
        console.error('Error uploading profile picture:', error);
        res.status(500).json({ success: false, message: 'Error uploading profile picture' });
    }
});

// Get profile picture endpoint
app.get('/api/profile-pic/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const user = await User.findOne({ username });
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (!user.profilePicture || user.profilePicture === '../profile.png') {
            return res.json({ success: true, imageUrl: '../profile.png' });
        }

        // Verify the ID is valid before attempting to use it
        if (!mongoose.Types.ObjectId.isValid(user.profilePicture)) {
            return res.status(400).json({ success: false, message: 'Invalid profile picture ID' });
        }

        const files = await gfs.find({ _id: new mongoose.Types.ObjectId(user.profilePicture) }).toArray();
        
        if (!files || files.length === 0) {
            // Reset to default if file not found
            await User.findOneAndUpdate({ username }, { profilePicture: '../profile.png' });
            return res.json({ success: true, imageUrl: '../profile.png' });
        }

        res.json({ 
            success: true, 
            imageUrl: `/api/profile-pic/file/${user.profilePicture}`
        });
    } catch (error) {
        console.error('Error fetching profile picture:', error);
        res.status(500).json({ success: false, message: 'Error fetching profile picture' });
    }
});

// Stream profile picture file
app.get('/api/profile-pic/file/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Validate the ID format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid file ID format' });
        }

        const files = await gfs.find({ _id: new mongoose.Types.ObjectId(id) }).toArray();
        
        if (!files || files.length === 0) {
            return res.status(404).json({ success: false, message: 'No file exists' });
        }

        // Set appropriate headers
        res.set('Content-Type', files[0].contentType);
        
        const readStream = gfs.openDownloadStream(new mongoose.Types.ObjectId(id));
        readStream.on('error', (error) => {
            console.error('Error streaming file:', error);
            res.status(500).json({ success: false, message: 'Error streaming file' });
        });

        readStream.pipe(res);
    } catch (error) {
        console.error('Error streaming profile picture:', error);
        res.status(500).json({ success: false, message: 'Error streaming profile picture' });
    }
});

// Delete profile picture
app.delete('/api/profile-pic/:id', async (req, res) => {
    try {
        await gfs.delete(new mongoose.Types.ObjectId(req.params.id));
        res.json({ success: true, message: 'Profile picture deleted' });
    } catch (error) {
        console.error('Error deleting profile picture:', error);
        res.status(500).json({ success: false, message: 'Error deleting profile picture' });
    }
});

// Add new endpoint to determine and store user archetype
app.get('/api/user-archetype/:username', async (req, res) => {
    try {
        const { username } = req.params;
        console.log(`[ARCHETYPE] Starting analysis for user: ${username}`);
        
        // Find user and their library
        const user = await User.findOne({ username });
        const userLibrary = await UserLibrary.findOne({ username });
        
        if (!user) {
            console.log(`[ARCHETYPE] User not found: ${username}`);
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        if (!userLibrary || !userLibrary.books || userLibrary.books.length === 0) {
            console.log(`[ARCHETYPE] Library empty or not found for user: ${username}`);
            return res.status(400).json({ 
                success: false, 
                message: 'User library is empty or not found' 
            });
        }

        console.log(`[ARCHETYPE] Found ${userLibrary.books.length} books in library`);

        // Spawn Python process to analyze library
        console.log('[ARCHETYPE] Spawning Python process for analysis');
        const pythonProcess = spawn(pythonCommand, [
            'public/functions/user_archetype.py',
            JSON.stringify(userLibrary.books)
        ]);

        let result = '';
        pythonProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log(`[ARCHETYPE] Python stdout: ${output}`);
            result += output;
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`[ARCHETYPE] Python stderr: ${data}`);
        });

        pythonProcess.on('close', async (code) => {
            console.log(`[ARCHETYPE] Python process exited with code: ${code}`);
            if (code !== 0) {
                console.error('[ARCHETYPE] Analysis failed');
                return res.status(500).json({ 
                    success: false, 
                    message: 'Error analyzing user archetype' 
                });
            }

            try {
                console.log('[ARCHETYPE] Parsing analysis result');
                const analysisResult = JSON.parse(result);
                
                if (!analysisResult.success) {
                    console.error(`[ARCHETYPE] Analysis returned error: ${analysisResult.message}`);
                    return res.status(400).json({ 
                        success: false, 
                        message: analysisResult.message 
                    });
                }

                console.log('[ARCHETYPE] Updating user with archetype information');
                // Update user with archetype information
                const updatedUser = await User.findOneAndUpdate(
                    { username },
                    {
                        'archetype.name': analysisResult.archetype.name,
                        'archetype.description': analysisResult.archetype.description,
                        'archetype.confidence': analysisResult.archetype.confidence,
                        'archetype.lastUpdated': new Date(),
                        'archetype.genreDistribution': analysisResult.archetype.genreDistribution,
                        'archetype.scores': analysisResult.archetype.scores,
                        'archetype.archetypeConfidences': analysisResult.archetype.archetypeConfidences,
                        'archetype.archetypeWeights': analysisResult.archetype.archetypeWeights
                    },
                    { new: true }
                );

                console.log('[ARCHETYPE] Analysis complete, sending response');
                res.json({
                    success: true,
                    archetype: {
                        name: analysisResult.archetype.name,
                        description: analysisResult.archetype.description,
                        confidence: analysisResult.archetype.confidence,
                        lastUpdated: new Date(),
                        genreDistribution: analysisResult.archetype.genreDistribution,
                        scores: analysisResult.archetype.scores,
                        archetypeConfidences: analysisResult.archetype.archetypeConfidences,
                        archetypeWeights: analysisResult.archetype.archetypeWeights
                    }
                });

            } catch (error) {
                console.error('[ARCHETYPE] Error parsing archetype analysis:', error);
                res.status(500).json({ 
                    success: false, 
                    message: 'Error processing archetype analysis' 
                });
            }
        });

    } catch (error) {
        console.error('[ARCHETYPE] Error in user archetype endpoint:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// Add endpoint to get user's archetype
app.get('/api/users/:username/archetype', async (req, res) => {
    try {
        const { username } = req.params;
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        if (!user.archetype || !user.archetype.name) {
            return res.status(404).json({ 
                success: false, 
                message: 'No archetype found for user' 
            });
        }

        res.json({
            success: true,
            archetype: {
                name: user.archetype.name,
                description: user.archetype.description,
                confidence: user.archetype.confidence,
                lastUpdated: user.archetype.lastUpdated,
                genreDistribution: Object.fromEntries(user.archetype.genreDistribution || new Map()),
                scores: Object.fromEntries(user.archetype.scores || new Map()),
                archetypeConfidences: Object.fromEntries(user.archetype.archetypeConfidences || new Map()),
                archetypeWeights: Object.fromEntries(user.archetype.archetypeWeights || new Map())
            }
        });

    } catch (error) {
        console.error('Error fetching user archetype:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// Temporary debug endpoint to view likes data
app.get('/api/debug/likes/:username', async (req, res) => {
    try {
        const { username } = req.params;
        console.log(`[DEBUG] Fetching likes data for user: ${username}`);

        const userLibrary = await UserLibrary.findOne({ username });
        if (!userLibrary) {
            console.log(`[DEBUG] No library found for user: ${username}`);
            return res.status(404).json({ success: false, message: 'User library not found' });
        }

        // Get all books with likes
        const booksWithLikes = userLibrary.books.filter(book => book.likes && book.likes.length > 0);
        console.log(`[DEBUG] Found ${booksWithLikes.length} books with likes`);

        // Format the response
        const likesData = booksWithLikes.map(book => ({
            isbn: book.isbn,
            title: book.title,
            likes: book.likes,
            totalLikes: book.likes.length
        }));

        res.json({
            success: true,
            username,
            totalBooksWithLikes: booksWithLikes.length,
            likesData
        });
    } catch (error) {
        console.error('[DEBUG] Error fetching likes data:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Add Review Schema
const reviewSchema = new mongoose.Schema({
  username: { type: String, required: true },
  isbn: { type: String, required: true },
  bookTitle: { type: String, required: true },
  review: { type: String },
  rating: { type: Number },
  reviewDate: { type: Date, default: Date.now },
  visibility: { type: String, enum: ['private', 'friends', 'public'], default: 'public' },
  likes: [{
    username: String,
    timestamp: { type: Date, default: Date.now }
  }]
});

// Create compound index for username and isbn to ensure uniqueness
reviewSchema.index({ username: 1, isbn: 1 }, { unique: true });

// Create Review model
const Review = mongoose.model('Review', reviewSchema);

// Add migration endpoint
app.post('/api/migrate-reviews', async (req, res) => {
    try {
        console.log('[MIGRATION] Starting review migration');
        
        // Get all user libraries
        const userLibraries = await UserLibrary.find({});
        console.log(`[MIGRATION] Found ${userLibraries.length} user libraries to process`);

        let migratedCount = 0;
        let errorCount = 0;

        for (const userLibrary of userLibraries) {
            for (const book of userLibrary.books) {
                if (book.review || book.rating) {
                    try {
                        // Check if review already exists
                        const existingReview = await Review.findOne({
                            username: userLibrary.username,
                            isbn: book.isbn
                        });

                        if (!existingReview) {
                            // Create new review
                            const newReview = new Review({
                                username: userLibrary.username,
                                isbn: book.isbn,
                                bookTitle: book.title,
                                review: book.review,
                                rating: book.rating,
                                reviewDate: book.reviewDate || new Date(),
                                visibility: book.visibility || 'public',
                                likes: book.likes || []
                            });

                            await newReview.save();
                            migratedCount++;
                            console.log(`[MIGRATION] Migrated review for ${userLibrary.username}'s book ${book.title}`);
                        }
                    } catch (error) {
                        console.error(`[MIGRATION] Error migrating review for ${userLibrary.username}'s book ${book.title}:`, error);
                        errorCount++;
                    }
                }
            }
        }

        console.log(`[MIGRATION] Completed. Migrated ${migratedCount} reviews with ${errorCount} errors`);
        res.json({
            success: true,
            message: `Successfully migrated ${migratedCount} reviews`,
            errors: errorCount
        });
    } catch (error) {
        console.error('[MIGRATION] Error during migration:', error);
        res.status(500).json({
            success: false,
            message: 'Error during migration',
            error: error.message
        });
    }
});

// Google Authentication Endpoints
app.post('/api/auth/google-login', async (req, res) => {
    const { email, name, googleId, username } = req.body;

    try {
        // Check if user exists by username
        let user = await User.findOne({ username });
        
        if (!user) {
            return res.status(400).send('Username not found. Please register first.');
        }

        // Verify the Google ID matches
        if (user.password !== googleId) {
            return res.status(400).send('Invalid Google account');
        }

        res.status(200).send('Logged in');
    } catch (err) {
        console.error('Error during Google login:', err);
        res.status(500).send('Internal server error');
    }
});

app.post('/api/auth/google-register', async (req, res) => {
    const { email, name, googleId, username } = req.body;

    try {
        // Check if username is already taken
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).send('Username is already taken');
        }

        // Create new user with custom username
        const user = new User({
            username,
            password: googleId, // Store Google ID as password
            profilePicture: '../profile.png'
        });
        await user.save();

        res.status(201).send('User created');
    } catch (err) {
        console.error('Error during Google registration:', err);
        res.status(500).send('Internal server error');
    }
});