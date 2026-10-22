const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { Resend } = require("resend");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
require("dotenv").config();

const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const serviceAccount = require("./serviceAccountKey.json");

// ==========================================================================
// 1. INITIALIZATION & MIDDLEWARE SETUP
// ==========================================================================
// Database Connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("🟢 Connected to MongoDB Cloud Database"))
  .catch((err) => console.error("🔴 MongoDB Connection Error:", err));

  
const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);

// Firebase Admin SDK
initializeApp({
  credential: cert(serviceAccount),
});
console.log("🟢 Firebase Admin SDK Initialized");

const makeAuthenticatedRequest = async () => {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    console.error("No user logged in!");
    return;
  }

  // Passing `true` forces Firebase to refresh the token if it's expired/expiring
  const freshToken = await user.getIdToken(/* forceRefresh */ true);

  const response = await fetch("http://localhost:5000/api/protected-route", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${freshToken}`
    }
  });

  const data = await response.json();
  return data;
};



// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer Storage for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "printlab_team",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [
      { width: 600, height: 600, crop: "fill", gravity: "face" } // Auto-detects face center!
    ],
  },
});

const upload = multer({ storage });

// Wrapper to intercept Multer/Cloudinary errors and return JSON instead of HTML
const uploadSingleImage = (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      console.error("🔴 Image Upload Error:", err);
      return res.status(500).json({
        success: false,
        message: `Image upload failed: ${err.message || "Cloudinary connection error"}`,
      });
    }
    next();
  });
};

// CORS Setup
const allowedOrigins = [
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  process.env.CLIENT_ORIGIN,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS Policy Restriction"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));



// ==========================================================================
// 2. SCHEMAS & MODELS
// ==========================================================================

// Booking Schema
const bookingSchema = new mongoose.Schema({
  bookingId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  service: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  status: {
    type: String,
    enum: ["Pending", "Confirmed", "Completed", "Cancelled"],
    default: "Pending",
  },
  createdAt: { type: Date, default: Date.now },
});
const Booking = mongoose.model("Booking", bookingSchema);

// Service Schema
const serviceSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  badge: { type: String, default: "Service", trim: true },
  icon: { type: String, default: "layers" },
  createdAt: { type: Date, default: Date.now },
});
const Service = mongoose.model("Service", serviceSchema);

// Team Member Schema
const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    imageUrl: { type: String, default: "" },
    bio: { type: String, trim: true, default: "" },
    linkedin: { type: String, trim: true, default: "" },
    twitter: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);
const TeamMember = mongoose.model("TeamMember", teamSchema);

// ==========================================================================
// 3. FIREBASE AUTHENTICATION MIDDLEWARE
// ==========================================================================
const authenticateAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized access. No token provided." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    req.admin = decodedToken;
    next();
  } catch (error) {
    console.error("🔒 Firebase Auth Verification Failed:", error.message);
    return res
      .status(403)
      .json({ success: false, message: "Forbidden. Session expired or invalid token." });
  }
};

// ==========================================================================
// 4. PUBLIC ENDPOINTS
// ==========================================================================

// POST /api/bookings
app.post("/api/bookings", async (req, res) => {
  try {
    const { name, phone, email, service, date, time } = req.body;

    if (!name || !phone || !email || !service || !date || !time) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    const customId = "BK-" + Date.now().toString(36).toUpperCase();

    const newBooking = await Booking.create({
      bookingId: customId,
      name,
      phone,
      email,
      service,
      date,
      time,
      status: "Pending",
    });

    console.log(`📥 Cloud Saved: Booking ${newBooking.bookingId} for ${name}`);

    resend.emails
      .send({
        from: "Printlab Bookings <onboarding@resend.dev>",
        to: [process.env.ADMIN_EMAIL],
        reply_to: email,
        subject: `🚨 New Booking: ${service} - ${name}`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 24px; background: #111; color: #fff; border-radius: 8px;">
          <h2 style="color: #25D366;">New Service Booking (${newBooking.bookingId})</h2>
          <p><strong>Client:</strong> ${name}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Service:</strong> ${service}</p>
          <p><strong>Target Date:</strong> ${date} at ${time}</p>
        </div>
      `,
      })
      .catch((err) => console.error("Admin Email Warning:", err.message));

    return res.status(200).json({
      success: true,
      message: "Booking submitted successfully!",
      booking: {
        id: newBooking.bookingId,
        ...newBooking.toObject(),
      },
    });
  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// GET /api/services
app.get("/api/services", async (req, res) => {
  try {
    const services = await Service.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, services });
  } catch (error) {
    console.error("Fetch Services Error:", error);
    res.status(500).json({ success: false, message: "Failed to load services." });
  }
});

// GET /api/team
app.get("/api/team", async (req, res) => {
  try {
    const team = await TeamMember.find().sort({ createdAt: -1 });
    res.json({ success: true, team });
  } catch (error) {
    console.error("Fetch Team Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch team." });
  }
});

// ==========================================================================
// 5. PROTECTED ADMIN ENDPOINTS
// ==========================================================================

// Bookings
app.get("/api/admin/bookings", authenticateAdmin, async (req, res) => {
  try {
    const rawBookings = await Booking.find().sort({ createdAt: -1 });
    const bookings = rawBookings.map((b) => ({
      ...b.toObject(),
      id: b.bookingId,
    }));
    res.status(200).json({ success: true, count: bookings.length, bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching bookings from cloud." });
  }
});

app.patch("/api/admin/bookings/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["Pending", "Confirmed", "Completed", "Cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status value." });
    }

    const updated = await Booking.findOneAndUpdate(
      { bookingId: id },
      { status },
      { returnDocument: "after" }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Booking not found." });
    }

    res.status(200).json({
      success: true,
      booking: { id: updated.bookingId, ...updated.toObject() },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update status." });
  }
});

app.delete("/api/admin/bookings/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Booking.findOneAndDelete({ bookingId: id });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Booking not found." });
    }

    res.status(200).json({ success: true, message: `Booking ${id} deleted.` });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete booking." });
  }
});

// Services
app.post("/api/admin/services", authenticateAdmin, async (req, res) => {
  try {
    const { title, description, badge, icon } = req.body;

    if (!title || !description) {
      return res
        .status(400)
        .json({ success: false, message: "Title and description are required." });
    }

    const service = await Service.create({
      title,
      description,
      badge: badge && badge.trim() !== "" ? badge.trim() : "Service",
      icon: icon || "layers",
    });

    res.status(201).json({ success: true, service });
  } catch (error) {
    console.error("Create Service Error:", error);
    res.status(500).json({ success: false, message: "Failed to create service." });
  }
});

app.delete("/api/admin/services/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Service.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Service not found." });
    }

    res.status(200).json({ success: true, message: "Service deleted successfully." });
  } catch (error) {
    console.error("Delete Service Error:", error);
    res.status(500).json({ success: false, message: "Failed to delete service." });
  }
});

// Team Management
app.post("/api/admin/team", authenticateAdmin, uploadSingleImage, async (req, res) => {
  try {
    const { name, role, bio, linkedin, twitter } = req.body;

    if (!name || !role) {
      return res.status(400).json({ success: false, message: "Name and role are required." });
    }

    const imageUrl = req.file ? req.file.path : "";

    const member = await TeamMember.create({
      name: name.trim(),
      role: role.trim(),
      imageUrl,
      bio: bio ? bio.trim() : "",
      linkedin: linkedin ? linkedin.trim() : "",
      twitter: twitter ? twitter.trim() : "",
    });

    res.status(201).json({ success: true, member });
  } catch (error) {
    console.error("Add Team Member Error:", error);
    res.status(500).json({ success: false, message: "Failed to create team member." });
  }
});

app.put("/api/admin/team/:id", authenticateAdmin, uploadSingleImage, async (req, res) => {
  try {
    const { name, role, bio, linkedin, twitter } = req.body;
    const updateData = { name, role, bio, linkedin, twitter };

    if (req.file) {
      updateData.imageUrl = req.file.path;
    }

    const updatedMember = await TeamMember.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedMember) {
      return res.status(404).json({ success: false, message: "Team member not found." });
    }

    res.json({ success: true, member: updatedMember });
  } catch (error) {
    console.error("Update Team Member Error:", error);
    res.status(500).json({ success: false, message: "Failed to update team member." });
  }
});

app.delete("/api/admin/team/:id", authenticateAdmin, async (req, res) => {
  try {
    const deleted = await TeamMember.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Team member not found." });
    }
    res.json({ success: true, message: "Member deleted successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete team member." });
  }
});

// ==========================================================================
// CATEGORY & PROJECT SCHEMAS
// ==========================================================================

// 1. Parent Category Schema
const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

const Category = mongoose.model("Category", categorySchema);

// 2. Child Project Schema (References Category)
const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    imageUrl: { type: String, required: true },
    description: { type: String, trim: true, default: "" },
    clientName: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

const Project = mongoose.model("Project", projectSchema);

// GET /api/categories (Public: Fetch all categories for filter buttons)
app.get("/api/categories", async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json({ success: true, categories });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch categories." });
  }
});

// POST /api/admin/categories (Admin: Create a new category)
app.post("/api/admin/categories", authenticateAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ success: false, message: "Category name is required." });
    }

    const category = await Category.create({
      name: name.trim(),
      description: description ? description.trim() : "",
    });

    res.status(201).json({ success: true, category });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "Category name already exists." });
    }
    res.status(500).json({ success: false, message: "Failed to create category." });
  }
});

// DELETE /api/admin/categories/:id (Admin: Delete category & its projects)
app.delete("/api/admin/categories/:id", authenticateAdmin, async (req, res) => {
  try {
    const categoryId = req.params.id;

    // Delete category
    const deletedCategory = await Category.findByIdAndDelete(categoryId);
    if (!deletedCategory) {
      return res.status(404).json({ success: false, message: "Category not found." });
    }

    // Clean up all child projects associated with this category
    await Project.deleteMany({ category: categoryId });

    res.json({ success: true, message: "Category and associated projects deleted." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete category." });
  }
});

// // // //  // // // // // // // // // // // // // // // // // // // // //

// GET /api/projects (Public: Get all projects with populated category details)
app.get("/api/projects", async (req, res) => {
  try {
    // .populate("category") automatically attaches category name to each project
    const projects = await Project.find()
      .populate("category", "name")
      .sort({ createdAt: -1 });

    res.json({ success: true, projects });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch projects." });
  }
});

// POST /api/admin/projects (Admin: Create Project under a Category with Image)
app.post("/api/admin/projects", authenticateAdmin, uploadSingleImage, async (req, res) => {
  try {
    const { title, categoryId, description, clientName } = req.body;

    if (!title || !categoryId) {
      return res.status(400).json({
        success: false,
        message: "Title and Category selection are required.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Project image upload is required.",
      });
    }

    const project = await Project.create({
      title: title.trim(),
      category: categoryId,
      imageUrl: req.file.path, // Cloudinary HTTPS URL
      description: description ? description.trim() : "",
      clientName: clientName ? clientName.trim() : "",
    });

    // Fetch populated project so frontend gets category name immediately
    const populatedProject = await Project.findById(project._id).populate("category", "name");

    res.status(201).json({ success: true, project: populatedProject });
  } catch (error) {
    console.error("Create Project Error:", error);
    res.status(500).json({ success: false, message: "Failed to create project." });
  }
});

// DELETE /api/admin/projects/:id (Admin: Delete a single project)
app.delete("/api/admin/projects/:id", authenticateAdmin, async (req, res) => {
  try {
    const deleted = await Project.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Project not found." });
    }
    res.json({ success: true, message: "Project deleted successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete project." });
  }
}); 


// ADD TESTIMONIAL //
// Testimonial Schema & Model
const testimonialSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, required: true },
  testimony: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5, default: 5 },
  createdAt: { type: Date, default: Date.now }
});

const Testimonial = mongoose.model('Testimonial', testimonialSchema);

// GET: Fetch all testimonials
app.get('/api/testimonials', async (req, res) => {
  try {
    const testimonials = await Testimonial.find().sort({ createdAt: -1 });
    res.json({ success: true, testimonials });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error fetching testimonials' });
  }
});

// POST: Add new testimonial
app.post('/api/testimonials', async (req, res) => {
  try {
    const { name, role, testimony, rating } = req.body;

    if (!name || !role || !testimony) {
      return res.status(400).json({ success: false, message: 'Please provide name, role, and testimony.' });
    }

    const newTestimonial = await Testimonial.create({
      name,
      role,
      testimony,
      rating: Number(rating) || 5
    });

    res.status(201).json({ success: true, testimonial: newTestimonial });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create testimonial' });
  }
});

// DELETE: Remove testimonial
app.delete('/api/testimonials/:id', async (req, res) => {
  try {
    await Testimonial.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Testimonial deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete testimonial' });
  }
});

// ==========================================================================
// FAQ
// ==========================================================================

// Define FAQ Schema directly in server.js
const faqSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Faq = mongoose.models.Faq || mongoose.model('Faq', faqSchema);

// 1. GET ALL FAQs (Public - for index.html)
app.get('/api/faqs', async (req, res) => {
  try {
    const faqs = await Faq.find().sort({ createdAt: -1 });
    res.json({ success: true, faqs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. GET ALL FAQs (Admin)
app.get('/api/admin/faqs',  async (req, res) => {
  try {
    const faqs = await Faq.find().sort({ createdAt: -1 });
    res.json({ success: true, faqs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. POST CREATE FAQ (Admin)
app.post('/api/admin/faqs',  async (req, res) => {
  try {
    const { question, answer } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ success: false, message: "Both question and answer are required." });
    }
    const newFaq = new Faq({ question, answer });
    await newFaq.save();
    res.json({ success: true, faq: newFaq });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. DELETE FAQ (Admin)
app.delete('/api/admin/faqs/:id',  async (req, res) => {
  try {
    await Faq.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "FAQ deleted successfully." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Newsletter Subscriber Schema
const subscriberSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true, 
    trim: true 
  },
  createdAt: { type: Date, default: Date.now }
});

const Subscriber = mongoose.models.Subscriber || mongoose.model('Subscriber', subscriberSchema);

// ==========================================================================
// NEWSLETTER ROUTES
// ==========================================================================

// 1. PUBLIC: Subscribe to Newsletter
app.post('/api/newsletter/subscribe', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: "Please provide a valid email address." });
    }

    const existing = await Subscriber.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: "You're already subscribed to our newsletter!" });
    }

    const subscriber = new Subscriber({ email: email.toLowerCase().trim() });
    await subscriber.save();

    res.json({ success: true, message: "Thank you for subscribing!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. ADMIN: Get All Subscribers
app.get('/api/admin/subscribers',  async (req, res) => {
  try {
    const subscribers = await Subscriber.find().sort({ createdAt: -1 });
    res.json({ success: true, subscribers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. ADMIN: Delete Subscriber
app.delete('/api/admin/subscribers/:id',  async (req, res) => {
  try {
    await Subscriber.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Subscriber removed successfully." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================================================
// 6. SERVER LISTEN
// ==========================================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));