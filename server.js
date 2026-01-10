const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const path = require("path");
const bodyParser = require("body-parser");
const fs = require("fs");
const axios = require("axios");
const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// ==========================================
// 1. DATABASE CONNECTION
// ==========================================
let config;
try {
  const rawData = fs.readFileSync("config.json");
  config = JSON.parse(rawData);
} catch (error) {
  console.error("❌ Error reading config.json:", error);
  process.exit(1);
}

mongoose
  .connect(config.mongoURI)
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch((err) => console.error("❌ Connection Error:", err));

// ==========================================
// 2. SCHEMAS & MODELS
// ==========================================

// ⚠️ PlantSchema MUST be defined BEFORE UserSchema
const PlantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true }, // e.g., Vegetable, Fruit
  sowingDate: { type: Date, required: true },
  harvestDate: { type: Date },
  waterFrequency: { type: String, default: "Normal" }, // e.g., Daily, Weekly
  sunlight: { type: String, default: "Full Sun" }, // e.g., Shade, Partial
  diseases: { type: String, default: "None" }, // e.g., Leaf Spot, Rust
  careTips: { type: String }, // Custom user notes
});

const UserSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  plants: [PlantSchema], // Embeds the array of plants
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", UserSchema);

// ==========================================
// 3. AUTHENTICATION ROUTES
// ==========================================

// Register
app.post("/api/register", async (req, res) => {
  const { fullName, email, password } = req.body;

  if (!fullName || !email || !password) {
    return res.json({ success: false, message: "All fields are required" });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.json({ success: false, message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ fullName, email, password: hashedPassword });
    await newUser.save();

    res.json({ success: true, message: "Registration successful!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false, message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.json({ success: false, message: "Invalid credentials" });

    res.json({
      success: true,
      message: "Login successful!",
      user: { name: user.fullName, email: user.email },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ==========================================
// 4. PROFILE & SETTINGS ROUTES
// ==========================================

// Update Name
app.put("/api/update-profile", async (req, res) => {
  const { email, newName } = req.body;
  try {
    const user = await User.findOneAndUpdate(
      { email: email },
      { fullName: newName },
      { new: true }
    );
    if (!user) return res.json({ success: false, message: "User not found" });

    res.json({
      success: true,
      message: "Profile updated",
      user: { name: user.fullName, email: user.email },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Change Password
app.put("/api/change-password", async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false, message: "User not found" });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch)
      return res.json({
        success: false,
        message: "Incorrect current password",
      });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ==========================================
// 5. PLANT MANAGEMENT ROUTES (CRUD)
// ==========================================

// Add Plant
app.post("/api/add-plant", async (req, res) => {
  const { email, plant } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false, message: "User not found" });

    user.plants.push(plant);
    await user.save();

    res.json({ success: true, message: "Plant added!", plants: user.plants });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get Plants
app.post("/api/get-plants", async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false, message: "User not found" });

    res.json({ success: true, plants: user.plants });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Edit Plant (Update existing plant)
app.put("/api/edit-plant", async (req, res) => {
  const { email, plantId, updatedData } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false, message: "User not found" });

    const plant = user.plants.id(plantId);
    if (!plant) return res.json({ success: false, message: "Plant not found" });

    // Update all fields
    plant.name = updatedData.name;
    plant.type = updatedData.type;
    plant.sowingDate = updatedData.sowingDate;
    plant.harvestDate = updatedData.harvestDate;
    plant.waterFrequency = updatedData.waterFrequency;
    plant.sunlight = updatedData.sunlight;
    plant.diseases = updatedData.diseases;
    plant.careTips = updatedData.careTips;

    await user.save();
    res.json({ success: true, message: "Plant updated!", plants: user.plants });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Delete Plant
app.delete("/api/delete-plant", async (req, res) => {
  const { email, plantId } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false, message: "User not found" });

    user.plants = user.plants.filter((p) => p._id.toString() !== plantId);
    await user.save();

    res.json({ success: true, message: "Plant deleted", plants: user.plants });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});
// --- CONFIGURATION ---
// Your camera IP details
const CAM_HOST = "http://10.110.145.110:8080";
const SNAPSHOT_URL = `${CAM_HOST}/?action=snapshot`;

// Enable JSON parsing for potential future use
app.use(express.json());

// Serve static files (HTML, CSS, JS, and the captured image)
app.use(express.static(path.join(__dirname, "public")));

// Route: Handle the Capture Request
app.post("/capture", async (req, res) => {
  try {
    console.log("Capturing frame from camera...");

    // Fetch the snapshot from the IP camera
    const response = await axios({
      method: "GET",
      url: SNAPSHOT_URL,
      responseType: "stream",
    });

    // Save (overwrite) the image as 'plant.jpg' in the public folder
    const imagePath = path.join(__dirname, "public", "plant.jpg");
    const writer = fs.createWriteStream(imagePath);

    response.data.pipe(writer);

    writer.on("finish", () => {
      console.log("Image saved to public/plant.jpg");
      res.json({ success: true, filename: "plant.jpg" });
    });

    writer.on("error", (err) => {
      console.error("File write error:", err);
      res.status(500).json({ success: false, error: "Failed to write file" });
    });
  } catch (error) {
    console.error("Camera connection failed:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Could not connect to camera." });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
