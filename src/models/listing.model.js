import mongoose from "mongoose";

const CATEGORY_ENUM = [
  "Nature", "Adventure", "Culture", "Spiritual", "Wildlife", "Relaxation", "Lifestyle", "Themes",
];

const TAGS = [
  "Mountains", "Hills", "Lakes", "Rivers", "Waterfalls", "Forests", "National Parks", "Caves",
  "Viewpoints", "Sunrise Spots", "Trekking", "Hiking", "Rafting", "Kayaking", "Paragliding",
  "Bungee Jumping", "Zipline", "Rock Climbing", "Mountain Biking", "Camping", "Canyoning",
  "Heli Tour", "Temples", "Monasteries", "Stupas", "Heritage Sites", "Museums", "Palaces",
  "Festivals", "Local Villages", "Traditions", "Crafts", "Architecture", "Food & Cuisine",
  "Cultural Shows", "Meditation", "Yoga Retreats", "Pilgrimage", "Spiritual Centers",
  "Holy Sites", "Peace Pagodas", "Monastic Life", "Safari", "Bird Watching", "Nature Walks",
  "Conservation Areas", "Eco Tours", "Jungle Walk", "Tiger Spotting", "Elephant Breeding Center",
  "Resorts", "Spa & Wellness", "Hot Springs", "Lakeside Leisure", "Luxury Lodges",
  "Countryside Retreats", "Riverside Camping", "Sunset Views", "Homestays", "Cooking Classes",
  "Tea Gardens", "Local Markets", "Shopping", "Nightlife", "Community Tourism", "Volunteering",
  "Family Travel", "Solo Travel", "Honeymoon", "Luxury Travel", "Budget Travel",
  "Offbeat Experiences", "Photography", "Festival Travel", "Eco Tourism", "Adventure Seekers",
  "Wellness Travel"
];

const listingSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },

    categories: {
      type: [String],
      enum: CATEGORY_ENUM,
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "At least one category is required",
      },
    },

    tags: { type: [String], enum: TAGS, default: [] },

    // GeoJSON Point: [lng, lat]
    location: {
      type: { type: String, enum: ["Point"], default: "Point", required: true },
      coordinates: {
        type: [Number],
        required: true,
        validate: [
          { validator: (v) => Array.isArray(v) && v.length === 2, message: "Coordinates must be [lng, lat]" },
          {
            validator: (v) =>
              typeof v?.[0] === "number" && typeof v?.[1] === "number" &&
              v[0] >= -180 && v[0] <= 180 && v[1] >= -90 && v[1] <= 90,
            message: "Coordinates out of range",
          },
        ],
      },
    },

    images: [
      {
        url:
        {
          type: String,
          trim: true
        },
        public_id: String,
        format: String
      }],

    permitsRequired: {
      type: Boolean,
      default: false
    },
    bestSeason: {
      type: String,
      trim: true
    },
    difficulty: {
      type: String,
      enum: ["Easy", "Moderate", "Challenging"]
    },
    extraAdvice: {
      type: String,
      trim: true
    },
    isVerified: {
      type: Boolean,
      default: false
    },

    // Denormalized for fast filters/sorts
    averageRating: {
      type: Number,
      default: 0
    },   // 0..5
    ratingsCount: {
      type: Number,
      default: 0
    },
    likesCount: {
      type: Number,
      default: 0
    },
    likedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
  },
  { timestamps: true }
);

// Indexes (define with the schema)
listingSchema.index({ location: "2dsphere" });              // distance
listingSchema.index({ averageRating: -1, createdAt: -1 });  // rating_desc
listingSchema.index({ likesCount: -1, createdAt: -1 });     // likes_desc
listingSchema.index({ createdAt: -1, _id: -1 });            // newest
listingSchema.index({ categories: 1 });
listingSchema.index({ tags: 1 });
listingSchema.index({ difficulty: 1 });

const Listing = mongoose.model("Listing", listingSchema);
export default Listing;
