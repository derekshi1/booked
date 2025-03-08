const express = require('express');
const mongoose = require('mongoose');
const { spawn } = require('child_process');
const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';

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
  profilePicture: { type: String, default: '../profile.png' }
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
  createdAt: { type: Date, default: Date.now }
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
  pageCount: Number
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
    reviewDate: Date, // Ensure this field exists
    visibility: { type: String, enum: ['private', 'friends', 'public'], default: 'public' },
    likes: [String]
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
      startDate: { type: Date, default: Date.now } // Tracks when the user started reading the book
    }]  }
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
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Count all activities that are unread (isRead: false) for the user
    const unreadCount = await Activity.countDocuments({
      userId: { $in: user.friends },  // Only count activities from friends
      readBy: { $ne: user._id }       // Exclude activities that the user has marked as read
    });
    res.status(200).json({ success: true, unreadCount });
  } catch (error) {
    console.error('Error fetching unread activities count:', error);
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
    const userLibrary = await UserLibrary.findOne({ username });
    if (!userLibrary) {
      return res.status(404).json({ success: false, message: 'No library found for user' });
    }

    const book = userLibrary.books.find(book => book.isbn === isbn);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found in library' });
    }

    // Save the review, rating, and visibility for the book in the user's library
    book.review = review;
    book.rating = rating;
    book.reviewDate = new Date();
    book.visibility = visibility; // Add the visibility to the book

    await userLibrary.save();

    // Log review as an activity, but first check for duplicates
    const user = await User.findOne({ username });
    if (user) {
      // Find all "reviewed" activities for this user and book
      const reviewActivities = await Activity.find({
        userId: user._id,
        action: 'reviewed',
        isbn: book.isbn,
      }).sort({ timestamp: -1 }); // Sort by timestamp (newest first)

      if (reviewActivities.length > 0) {
        // Keep the most recent activity and remove the older duplicates
        const [mostRecentActivity, ...duplicateActivities] = reviewActivities;

        if (duplicateActivities.length > 0) {
          await Activity.deleteMany({ _id: { $in: duplicateActivities.map(activity => activity._id) } });
          console.log(`Removed ${duplicateActivities.length} duplicate activities for user ${username} and book ${isbn}`);
        }

        // Update the most recent activity with the new review details
        mostRecentActivity.timestamp = new Date(); // Update timestamp to the latest review time
        mostRecentActivity.review = review; // Ensure review text is updated
        mostRecentActivity.rating = rating; // Update rating if applicable
        mostRecentActivity.visibility = visibility; // Update visibility if changed
        await mostRecentActivity.save();
      } else {
        // If no existing activity, create a new one
        const newActivity = new Activity({
          userId: user._id,
          action: 'reviewed',
          bookTitle: book.title,
          isbn: book.isbn,
          thumbnail: book.thumbnail,
          timestamp: new Date(),
          visibility,
          isRead: false,
        });
        await newActivity.save();
      }
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
    // Find all user libraries that contain the book with the specified ISBN
    const userLibraries = await UserLibrary.find({ "books.isbn": isbn });

    if (!userLibraries || userLibraries.length === 0) {
      return res.status(404).json({ success: false, message: 'No reviews found for this book' });
    }

    let reviews = [];

    for (const library of userLibraries) {
      const book = library.books.find(book => book.isbn === isbn);

      if (book && book.review) {
        const isLikedByUser = book.likes.includes(loggedInUsername);

        // Always include the loggedInUsername's reviews, regardless of visibility
        if (library.username === loggedInUsername) {
          reviews.push({
            _id: book._id, 
            username: library.username,
            review: book.review,
            rating: book.rating,
            reviewDate: book.reviewDate,
            visibility: book.visibility, 
            likes: book.likes.length || 0,
            isLikedByUser,
          });
        } else {
          // Check visibility and include the review based on visibility for other users
          if (book.visibility === 'public') {
            reviews.push({
              _id: book._id, 
              username: library.username,
              review: book.review,
              rating: book.rating,
              reviewDate: book.reviewDate,
              visibility: book.visibility,
              likes: book.likes.length || 0,
              isLikedByUser,
            });
          } else if (book.visibility === 'friends') {
            const isFriend = await checkFriendship(library.username, loggedInUsername);
            if (isFriend) {
              reviews.push({
                _id: book._id, 
                username: library.username,
                review: book.review,
                rating: book.rating,
                reviewDate: book.reviewDate,
                visibility: book.visibility,
                likes: book.likes.length || 0,
                isLikedByUser,
              });
            }
          }
        }
      }
    }

    // Return reviews
    if (reviews.length > 0) {
      res.status(200).json({ success: true, reviews });
    } else {
      res.status(200).json({ success: true, reviews: [], message: 'No reviews available for this book' });
    }
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
      // Find the user and populate the friends field
      const user = await User.findOne({ username }).populate('friends');

      if (!user) {
          console.log('User not found');
          return res.status(404).json({ success: false, message: 'User not found' });
      }

      if (!Array.isArray(user.friends) || user.friends.length === 0) {
          return res.status(200).json({ success: true, activities: [] });  // No friends, no activities
      }

      const friendsActivities = [];

      for (const friend of user.friends) {
        // Find the earliest "became friends" activity between the user and the friend
        const friendshipActivity = await Activity.findOne({
            userId: { $in: [user._id, friend._id] },
            action: 'became friends with',
            bookTitle: { $in: [user.username, friend.username] }
        }).sort({ timestamp: 1 });  // Sort in ascending order to get the earliest
    
        for (const friend of user.friends) {
          const activities = await Activity.find({
            userId: friend._id,
            $or: [
              { visibility: 'public' },  // Public activities
              { visibility: 'friends' },  // Friends-only activities
              { visibility: 'private'}  // Private activities, but only for the owner
            ]          
          }).sort({ timestamp: -1 });  // Sort by most recent first 

          // Group activities by book title
          const groupedActivities = activities.reduce((acc, activity) => {
            const key = activity.bookTitle;  // Use book title as the grouping key

            if (!acc[key]) {
              acc[key] = [];
            }

            acc[key].push(activity);
            return acc;
          }, {});

          // Push the activities into the array and check if the user has read them
           for (const bookTitle in groupedActivities) {
        const bookActivities = groupedActivities[bookTitle];

        const addedActivity = bookActivities.find(activity => activity.action === 'added to library');
        const reviewedActivity = bookActivities.find(activity => activity.action === 'reviewed');

        if (addedActivity && reviewedActivity) {
          // Merge activities: prioritize review details but include both actions
          friendsActivities.push({
            username: friend.username,
            action: 'added to library and reviewed',
            bookTitle: addedActivity.bookTitle,
            isbn: addedActivity.isbn,
            thumbnail: addedActivity.thumbnail,
            review: reviewedActivity.review, // Include the review from the review action
            rating: reviewedActivity.rating, // Include rating
            timestamp: reviewedActivity.timestamp, // Use the timestamp of the review (most recent action)
            visibility: reviewedActivity.visibility,
            isRead: reviewedActivity.readBy.includes(user._id) // Check if the logged-in user has read this activity
          });
        } else {
          // If there's no review or added separately, just push individual activities
          bookActivities.forEach(activity => {
            friendsActivities.push({
              username: friend.username,
              action: activity.action,
              bookTitle: activity.bookTitle,
              isbn: activity.isbn,
              thumbnail: activity.thumbnail,
              review: activity.review || null,  // Include the review if available
              rating: activity.rating || null,  // Include rating if available
              timestamp: activity.timestamp,
              visibility: activity.visibility,
              isRead: activity.readBy.includes(user._id) // Check if the logged-in user has read this activity
            });
          });
        }
      }
    }
    
    }
    

      // Sort all activities by timestamp in descending order before sending the response
      friendsActivities.sort((a, b) => b.timestamp - a.timestamp);

      res.json({ success: true, activities: friendsActivities });
  } catch (error) {
      console.error('Error getting friends\' activities:', error);
      res.status(500).json({ success: false, message: 'Error getting friends\' activities' });
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
    // Extract the username from the request body
    const { username, isbn, title, authors, description, thumbnail, categories, pageCount } = req.body;

    // Validate input data
    if (!username || !isbn || !title) {
      return res.status(400).json({ error: 'Username, ISBN, and Title are required.' });
    }

    // Find the user's library
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

    // Add the book to Currently Reading
    userLibrary.currentlyReading.books.push({
      isbn,
      title,
      authors,
      description,
      thumbnail,
      categories,
      pageCount,
      startDate: new Date(), // Add current date
    });

    // Save the updated library
    await userLibrary.save();

    res.status(200).json({ message: 'Book added to Currently Reading!', currentlyReading: userLibrary.currentlyReading.books });
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
    const { username } = req.params; // Extract username from the request params
    const { isbn } = req.body; // Extract ISBN from the request body

    // Validate input
    if (!isbn) {
      return res.status(400).json({ success: false, message: 'ISBN is required to end currently reading.' });
    }

    // Find the user's library
    const userLibrary = await UserLibrary.findOne({ username });

    if (!userLibrary) {
      return res.status(404).json({ success: false, message: 'User library not found.' });
    }

    // Check if the book exists in the currently reading list
    const bookIndex = userLibrary.currentlyReading.books.findIndex(book => book.isbn === isbn);

    if (bookIndex === -1) {
      return res.status(400).json({ success: false, message: 'Book not found in Currently Reading list.' });
    }

    userLibrary.currentlyReading.books.splice(bookIndex, 1);

    await userLibrary.save();

    res.status(200).json({
      success: true,
      message: 'Book removed from Currently Reading list.',
      currentlyReading: userLibrary.currentlyReading.books
    });
  } catch (error) {
    console.error('Error in /api/library/:username/currently-reading/end:', error.message);
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


app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});