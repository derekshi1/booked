const express = require('express');
const mongoose = require('mongoose');
const { spawn } = require('child_process');

const app = express();
const port = 8080;
// MongoDB Connection
const mongoUri = 'mongodb+srv://derekshi:Rsds0601@library.k27zbxq.mongodb.net/?retryWrites=true&w=majority&appName=library';
mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// Mongoose Schema and Model for Users
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  friends: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
  friendRequests: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FriendRequest' }], default: [] },
  profilePicture: { type: String, default: 'default-profile.png' } 
});

const activitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  bookTitle: { type: String, required: true }, // Store the book title directly
  isbn: { type: String }, // Store the ISBN directly
  thumbnail: { type: String }, // Store the thumbnail URL directly
  timestamp: { type: Date, default: Date.now }
});

const friendRequestSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

// Models
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
    rating: Number
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
    rating: Number
  }]
});
const UserLibrary = mongoose.model('UserLibrary', userLibrarySchema);

app.use(express.static('public'));
app.use(express.json());

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/html/index.html');
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


// Get books from user's library
app.get('/api/library/:username', async (req, res) => {
  const { username } = req.params;

  try {
    let userLibrary = await UserLibrary.findOne({ username });
    if (!userLibrary) {
      // If no userLibrary found, create an empty one for the user
      userLibrary = new UserLibrary({ username, books: [], readList: [], top5: [] });
      await userLibrary.save();
    }

    const totalBooks = userLibrary.books.length;
    const totalPages = userLibrary.books.reduce((sum, book) => sum + book.pageCount, 0);
    res.status(200).json({ success: true, books: userLibrary.books, totalBooks, totalPages });
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

    const pythonProcess = spawn('python3', ['public/functions/recommendations.py', JSON.stringify(library)]);

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


app.get('/api/book-recommendations', async (req, res) => {
  const isbn = req.query.isbn; // Get the isbn from the query string
  if (!isbn) {
    return res.status(400).json({ success: false, message: 'ISBN is required' });
  }

  try {
    const pythonProcess = spawn('python3', ['public/functions/singleRecs.py', isbn]);

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
  const { username, isbn, review, rating } = req.body;

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

    await userLibrary.save();

    // Log review as an activity
    const user = await User.findOne({ username });
    if (user) {
      const newActivity = new Activity({
        userId: user._id,
        action: 'reviewed',
        bookTitle: book.title,  // Assuming book.title is available
        isbn: book.isbn,
        thumbnail: book.thumbnail,  // Assuming book.thumbnail is available
        timestamp: new Date(),
      });
      await newActivity.save();
    }

    res.status(200).json({ success: true, message: 'Review saved successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Fetch a specific book's review and rating from user's library
app.get('/api/library/review/:username/:isbn', async (req, res) => {
  const { username, isbn } = req.params;

  try {
    const userLibrary = await UserLibrary.findOne({ username });
    if (!userLibrary) {
      return res.status(404).json({ success: false, message: 'No library found for user' });
    }

    const book = userLibrary.books.find(book => book.isbn === isbn);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found in library' });
    }

    res.status(200).json({ success: true, review: book.review, rating: book.rating });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PUT route to update a review for a book in user's library
app.put('/api/library/review', async (req, res) => {
  const { username, isbn, review, rating } = req.body;

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
  const { username} = req.params;

  try {
    const userLibrary = await UserLibrary.findOne({ username });
    if (userLibrary) {
      res.status(200).json({ success: true, readList: userLibrary.readList});
    } else {
      userLibrary = new UserLibrary({ username, books: [], top5: [], readList: [] });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Endpoint to generate book lists

app.post('/api/generate-lists', (req, res) => {
  const query = req.body.query;

  if (!query) {
    return res.status(400).json({ error: 'No query provided' });
  }

  const pythonProcess = spawn('python3', ['public/functions/listgeneration.py', query]);

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

    const pythonProcess = spawn('python3', ['public/functions/oppositerecommendations.py', JSON.stringify(library)]);

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
    // Find the friend request by ID
    const friendRequest = await FriendRequest.findById(requestId).populate('from to');

    if (!friendRequest) {
      return res.status(404).json({ success: false, message: 'Friend request not found' });
    }

    const user = await User.findById(friendRequest.to._id);
    const friend = await User.findById(friendRequest.from._id);

    if (!user || !friend) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Initialize the friends array if it doesn't exist
    if (!user.friends) user.friends = [];
    if (!friend.friends) friend.friends = [];

    // Add each other as friends
    user.friends.push(friend._id);
    friend.friends.push(user._id);

    // Save both users
    await user.save();
    await friend.save();

     // Log the activity for the user accepting the request
     const userActivity = new Activity({
      userId: user._id,
      action: `became friends with`,
      bookTitle: friend.username, // Use this field to log friend's username
      isbn: '', // No ISBN for this action
      thumbnail: '', // No thumbnail for this action
      timestamp: new Date(),
    });
    await userActivity.save();

    // Log the activity for the friend who was accepted
    const friendActivity = new Activity({
      userId: friend._id,
      action: `became friends with`,
      bookTitle: user.username, // Use this field to log friend's username
      isbn: '', // No ISBN for this action
      thumbnail: '', // No thumbnail for this action
      timestamp: new Date(),
    });
    await friendActivity.save();
    // Remove the friend request after it's accepted
    await FriendRequest.findByIdAndDelete(requestId);

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
      
      // For each friend, fetch their activities only after the friendship was established
      for (const friend of user.friends) {
          const activities = await Activity.find({ userId: friend._id }).sort({ timestamp: -1 });
          activities.forEach(activity => {
            friendsActivities.push({
              username: friend.username,
              action: activity.action,
              bookTitle: activity.bookTitle, // Access the book's title directly
              isbn: activity.isbn,       // Access the ISBN directly
              thumbnail: activity.thumbnail, // Access the thumbnail directly
              timestamp: activity.timestamp
            });
          });
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
      const user = await User.findOne({ username }).populate('friends').populate('friendRequests');
      const friend = await User.findOne({ username: friendUsername });

      if (!user || !friend) {
          return res.status(404).json({ success: false, message: 'User or friend not found' });
      }

      // Check if the users are already friends
      const isFriend = user.friends.some(f => f.username === friendUsername);
      if (isFriend) {
          return res.status(200).json({ success: true, status: 'friend' });
      }

      // Check if there is a pending friend request
      const isPending = await FriendRequest.findOne({ from: friend._id, to: user._id, status: 'pending' });
      if (isPending) {
          return res.status(200).json({ success: true, status: 'pending' });
      }

      // If not friends and no pending request, return 'none'
      return res.status(200).json({ success: true, status: 'none' });

  } catch (error) {
      console.error('Error checking friendship status:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
  }
});


app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});