require('dotenv').config();
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');

// Database connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch((err) => console.error('Database connection error:', err));

// Middleware setup
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use('/public', express.static(process.cwd() + '/public'));

// Serve HTML
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// Mongoose Schemas
const Schema = mongoose.Schema;

const exerciseUsersSchema = new Schema({
  username: { type: String, unique: true, required: true }
});

const ExerciseUsers = mongoose.model('ExerciseUsers', exerciseUsersSchema);

const exercisesSchema = new Schema({
  userId: { type: String, required: true },
  description: { type: String, required: true },
  duration: { type: Number, min: 1, required: true },
  date: { type: Date, default: Date.now }
});

const Exercises = mongoose.model('Exercises', exercisesSchema);

// Utility function to handle errors
const handleError = (res, message, code = 400) => {
  res.status(code).json({ error: message });
};

// Route to create a new user
app.post('/api/users', async (req, res) => {
  const { username } = req.body;
  
  if (!username) {
    return handleError(res, 'Username is required');
  }

  try {
    const existingUser = await ExerciseUsers.findOne({ username });
    
    if (existingUser) {
      return handleError(res, 'Username already exists');
    }

    const newUser = new ExerciseUsers({ username });
    const savedUser = await newUser.save();

    res.json({ _id: savedUser._id, username: savedUser.username });
  } catch (error) {
    handleError(res, 'Error creating user');
  }
});

// Route to get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await ExerciseUsers.find();
    res.json(users);
  } catch (error) {
    handleError(res, 'Error fetching users');
  }
});

// Route to add an exercise
app.post('/api/users/:_id/exercises', async (req, res) => {
  const { _id } = req.params;
  const { description, duration, date } = req.body;

  if (!_id || !description || !duration) {
    return handleError(res, '_id, description, and duration are required');
  }

  const exerciseDate = date ? new Date(date) : new Date();

  if (isNaN(duration)) {
    return handleError(res, 'Duration must be a number');
  }

  if (isNaN(exerciseDate)) {
    return handleError(res, 'Invalid date format');
  }

  try {
    // Replacing findById with findOne
    const user = await ExerciseUsers.findOne({ _id });
    
    if (!user) {
      return handleError(res, 'User not found');
    }

    const newExercise = new Exercises({
      userId: _id,
      description,
      duration: parseInt(duration),
      date: exerciseDate
    });

    const savedExercise = await newExercise.save();

    res.json({
      _id: user._id,
      username: user.username,
      description: savedExercise.description,
      duration: savedExercise.duration,
      date: savedExercise.date.toDateString()
    });
  } catch (error) {
    handleError(res, 'Error adding exercise');
  }
});

// Route to get exercise logs for a user
app.get('/api/users/:_id/logs', async (req, res) => {
  const { _id } = req.params;
  const { from, to, limit } = req.query;
  const conditions = { userId: _id };

  if (from || to) {
    conditions.date = {};

    if (from) {
      const fromDate = new Date(from);
      if (isNaN(fromDate)) return handleError(res, 'Invalid "from" date format');
      conditions.date.$gte = fromDate;
    }

    if (to) {
      const toDate = new Date(to);
      if (isNaN(toDate)) return handleError(res, 'Invalid "to" date format');
      conditions.date.$lte = toDate;
    }
  }

  const exerciseLimit = limit ? parseInt(limit) : 0;

  if (isNaN(exerciseLimit)) {
    return handleError(res, 'Limit must be a number');
  }

  try {
    // Replacing findById with findOne
    const user = await ExerciseUsers.findOne({ _id });
    
    if (!user) {
      return handleError(res, 'User not found');
    }

    const exercises = await Exercises.find(conditions)
      .sort({ date: 'asc' })
      .limit(exerciseLimit);

    res.json({
      _id: user._id,
      username: user.username,
      log: exercises.map(exercise => ({
        description: exercise.description,
        duration: exercise.duration,
        date: exercise.date.toDateString()
      })),
      count: exercises.length
    });
  } catch (error) {
    handleError(res, 'Error fetching logs');
  }
});

// Not found middleware
app.use((req, res, next) => {
  return next({ status: 404, message: 'Not Found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  const errCode = err.status || 500;
  const errMessage = err.message || 'Internal Server Error';
  res.status(errCode).type('txt').send(errMessage);
});

// Start the server
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});
