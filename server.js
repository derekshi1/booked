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
  password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

// Mongoose Schema and Model for Books
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
    pageCount: Number
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
  const { username, isbn, title, authors, description, thumbnail, categories, pageCount} = req.body;
  try {
    let userLibrary = await UserLibrary.findOne({ username });
    if (!userLibrary) {
      userLibrary = new UserLibrary({ username, books: [] });
    }

    // Check if the book is already in the library
    const existingBook = userLibrary.books.find(book => book.isbn === isbn);
    if (existingBook) {
      return res.status(400).json({ success: false, message: 'Book already in library' });
    }

    userLibrary.books.push({ isbn, title, authors, description, thumbnail, categories, pageCount});
    await userLibrary.save();

    res.status(200).json({ success: true, message: 'Book added to library' });
  } catch (error) {
    console.error(error);
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
    const userLibrary = await UserLibrary.findOne({ username });
    if (userLibrary) {
      res.status(200).json({ success: true, books: userLibrary.books });
    } else {
      res.status(404).json({ success: false, message: 'No library found for user' });
    }
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

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
