import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import axios from "axios";
import bodyParser from "body-parser";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// Middlewares
app.use(bodyParser.json());
app.use(cors());

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((error) => console.error("Could not connect to MongoDB:", error));

const { Schema } = mongoose;

const ratingSchema = new Schema({
  Source: String,
  Value: String,
});

const movieSchema = new Schema({
  Title: String,
  Year: String,
  Rated: String,
  Released: String,
  Runtime: String,
  Genre: String,
  Director: String,
  Writer: String,
  Actors: String,
  Plot: String,
  Language: String,
  Country: String,
  Awards: String,
  Ratings: [ratingSchema], // Nested schema for ratings
  Metascore: String,
  imdbRating: String,
  imdbVotes: String,
  imdbID: { type: String, unique: true }, // Ensure no duplicate entries for the same movie
  BoxOffice: String,
  myScore: Number, // Additional field for storing custom user score
  myReview: String, // Additional field for storing the user's review
});

const Movie = mongoose.model("Movie", movieSchema);

// Routes
// POST route to fetch movie data by IMDb ID and save it with myScore
app.post("/api/movies/by-id", async (req, res) => {
  const { id, myScore, myReview } = req.body; // Expecting 'id' and 'myScore' from the request body
  console.log("myScore" + myScore);

  if (!id) {
    return res.status(400).json({ message: "Movie ID is required" });
  }

  const apiUrl = `https://www.omdbapi.com/?i=${encodeURIComponent(id)}&apikey=${
    process.env.OMDB_API_KEY
  }`;
  console.log(apiUrl);
  try {
    const response = await axios.get(apiUrl);

    if (response.data.Response === "True") {
      const movieData = {
        ...response.data,
        myScore: parseInt(myScore, 10),
        myReview,
      };

      // Check for existing movie in DB and update or save accordingly
      let movie = await Movie.findOne({ imdbID: id });
      if (movie) {
        // If the movie already exists, update it
        await Movie.updateOne({ imdbID: id }, movieData);
      } else {
        // If the movie does not exist, save the new data
        movie = new Movie(movieData);
        await movie.save();
      }

      res.json(movieData);
    } else {
      res.status(404).json({ message: "Movie not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST route to fetch movie data by title and save it with myScore
app.post("/api/movies/by-title", async (req, res) => {
  const { title, year, myScore, myReview } = req.body;
  console.log(req);

  let apiUrl = `https://www.omdbapi.com/?apikey=${process.env.OMDB_API_KEY}`;
  if (title) apiUrl += `&t=${encodeURIComponent(title)}`;
  if (year) apiUrl += `&y=${encodeURIComponent(year)}`;

  try {
    console.log(apiUrl);
    const response = await axios.get(apiUrl);

    if (response.data.Response === "True") {
      const movieData = {
        ...response.data,
        myScore: parseInt(myScore, 10),
        myReview,
      };

      // Check for existing movie in DB and update or save accordingly
      let movie = await Movie.findOne({ imdbID: response.data.imdbID });
      if (movie) {
        await Movie.updateOne({ imdbID: response.data.imdbID }, movieData);
      } else {
        movie = new Movie(movieData);
        await movie.save();
      }
      res.json(movieData);
    } else {
      res.status(404).json({ message: "Movie not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/movies", async (req, res) => {
  try {
    const movies = await Movie.find(); // Fetch all movies
    res.json(movies);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.patch("/api/movies/:imdbID", async (req, res) => {
  const { imdbID } = req.params;
  const { myScore, myReview } = req.body; // Extract the updated score and review from the request body

  try {
    // Build the update object dynamically to include only fields provided in the request
    const updateData = {};
    if (myScore !== undefined) updateData.myScore = myScore;
    if (myReview !== undefined) updateData.myReview = myReview;

    // Find the movie by imdbID and update it with the new score and/or review
    const updatedMovie = await Movie.findOneAndUpdate(
      { imdbID: imdbID },
      { $set: updateData },
      { new: true }
    );

    if (updatedMovie) {
      res.json(updatedMovie); // Send back the updated document
    } else {
      res.status(404).json({ message: "Movie not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/movies/:imdbID", async (req, res) => {
  const { imdbID } = req.params; // Extract imdbID from URL parameters
  try {
    const movie = await Movie.findOne({ imdbID: imdbID }); // Find movie by imdbID
    if (movie) {
      res.json(movie);
    } else {
      res.status(404).json({ message: "Movie not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete("/api/movies/:imdbID", async (req, res) => {
  const { imdbID } = req.params; // Extract imdbID from URL parameters

  try {
    // Attempt to delete the movie by imdbID
    const deletionResult = await Movie.findOneAndDelete({ imdbID: imdbID });

    if (deletionResult) {
      // If a document was found and deleted, send a success response
      res.status(200).json({
        message: "Movie successfully deleted",
        deletedMovie: deletionResult,
      });
    } else {
      // If no document was found to delete, send a 404 not found response
      res.status(404).json({ message: "Movie not found" });
    }
  } catch (error) {
    // If an error occurs, send a 500 internal server error response
    res.status(500).json({ message: error.message });
  }
});
  

// Starting the Server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
