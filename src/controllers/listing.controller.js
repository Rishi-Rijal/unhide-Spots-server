import Listing from '../models/listing.model.js';
import ApiError from '../utils/ApiError.js';
import AsyncHandler from '../utils/AsyncHandler.js';
import { uploadOnCloudinary } from '../utils/uploadCloudinary.js';
import { z } from "zod";
import mongoose from "mongoose";

/* ---------- validation helpers ---------- */

const stringOrArray = z
  .union([
    z.string().min(1).transform(v => v.trim()),
    z.array(z.string().min(1).transform(v => v.trim()))
  ])
  .optional()
  .transform(v => (Array.isArray(v) ? v : v ? [v] : []));


const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64");
const safeDecode = (s) => {
  try { return JSON.parse(Buffer.from(s, "base64").toString("utf8")); }
  catch { return null; }
};
const querySchema = z.object({
  categories: stringOrArray,
  tags: stringOrArray,
  minRating: z.coerce.number().min(0).max(5).optional(),
  difficulty: z.enum(["Easy", "Moderate", "Challenging"]).optional(),
  verifiedOnly: z.union([z.literal("true"), z.literal("false")]).optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),

  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  distanceKm: z.coerce.number().min(0).max(250).default(0),

  sort: z.enum(["newest", "rating_desc", "rating_asc", "likes_desc", "likes_asc", "distance"]).default("rating_desc"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
}).refine((q) => (q.sort !== "distance") || (Number.isFinite(q.lat) && Number.isFinite(q.lng)), {
  path: ["sort"],
  message: "Distance sorting requires lat & lng",
});


/* ---------- controller functions ---------- */
// create a new listing

const createListing = AsyncHandler(async (req, res) => {
  const { name, description, categories, tags, latitude, longitude, tipsPermits, tripsBestSeason, tripsDifficulty, tipsExtra } = req.body;
  if (!name || !description || !categories || !latitude || !longitude) {
    throw new ApiError(400, 'Please provide all required fields');
  }

  const location = {
    type: 'Point',
    coordinates: [longitude, latitude]
  };

  const images = req.files?.images || [];

  const imagesInfo = await Promise.all(
    images.map(async (image) => {
      const uploadResult = await uploadOnCloudinary(image.path);
      return { url: uploadResult.secure_url, public_id: uploadResult.public_id, format: uploadResult.format };
    })
  );

  const newListing = await Listing.create({
    name,
    description,
    categories,
    tags,
    location,
    images: imagesInfo,
    extraAdvice: tipsExtra || ""
  });

  const createdListing = Listing.findById(newListing._id);
  if (!createdListing) {
    throw new ApiError(500, 'Failed to create listing');
  }

  res.status(201).json(newListing);
});

const getListings = AsyncHandler(async (req, res) => {
  const listings = await Listing.find();
  res.status(200).json(listings);
});

const getListing = AsyncHandler(async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) {
    throw new ApiError(404, 'Listing not found');
  }

  res.status(200).json(listing);
});

const updateListing = AsyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, categories, tags, latitude, longitude, photos, tips } = req.body;
  if (!name || !description || !categories || !latitude || !longitude) {
    throw new ApiError(400, 'Please provide all required fields');
  }

  const location = {
    type: 'Point',
    coordinates: [longitude, latitude]
  };
  const updatedListing = await Listing.findByIdAndUpdate(id, { ...req.body, location }, { new: true });
  if (!updatedListing) {
    throw new ApiError(404, 'Listing not found');
  }

  res.status(200).json(updatedListing);
});

const deleteListing = AsyncHandler(async (req, res) => {
  const { id } = req.params;
  const deletedListing = await Listing.findByIdAndDelete(id);
  if (!deletedListing) {
    throw new ApiError(404, 'Listing not found');
  }

  res.status(200).json({ message: 'Listing deleted successfully' });
});

const getListingFiltered = AsyncHandler(async (req, res) => {
  try {
    const parsed = querySchema.safeParse(req.query ?? {})
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid query",
        errors: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }

    const {
      categories, tags, minRating, difficulty, verifiedOnly,
      lat, lng, distanceKm, sort, limit, cursor,
    } = parsed.data;
    const hasGeoPoint =
      typeof lat === "number" &&
      typeof lng === "number";

    const hasGeoFilter =
      hasGeoPoint &&
      typeof distanceKm === "number" &&
      distanceKm > 0;

    if (sort === "distance" && !hasGeoPoint) {
      return res.status(400).json({ error: "lat and lng are required for distance sort" });
    }

    const match = {};
    if (verifiedOnly) match.isVerified = true;
    if (categories?.length) match.categories = { $in: categories };
    if (tags?.length) match.tags = { $in: tags };
    if (minRating !== undefined) match.averageRating = { $gte: minRating };
    if (difficulty) match.difficulty = difficulty;

    // cursorMatch based on sort tuple
    const cursorMatch = {};
    const c = cursor ? safeDecode(cursor) : null;
    if (cursor && !c) return res.status(400).json({ error: "Invalid cursor" });
    if (c && c._id && !mongoose.isValidObjectId(c._id)) {
      return res.status(400).json({ error: "Invalid cursor _id" });
    }

    if (c) {
      if (sort === "newest" || !sort) {
        cursorMatch.$or = [
          { createdAt: { $lt: new Date(c.createdAt) } },
          { createdAt: new Date(c.createdAt), _id: { $lt: mongoose.Types.ObjectId.createFromHexString(c._id) } },
        ];
      } else if (sort === "rating_desc") {
        cursorMatch.$or = [
          { averageRating: { $lt: c.averageRating } },
          { averageRating: c.averageRating, createdAt: { $lt: new Date(c.createdAt) } },
          { averageRating: c.averageRating, createdAt: new Date(c.createdAt), _id: { $lt: mongoose.Types.ObjectId.createFromHexString(c._id) } },
        ];
      } else if (sort === "rating_asc") {
        cursorMatch.$or = [
          { averageRating: { $gt: c.averageRating } },
          { averageRating: c.averageRating, createdAt: { $lt: new Date(c.createdAt) } },
          { averageRating: c.averageRating, createdAt: new Date(c.createdAt), _id: { $lt: mongoose.Types.ObjectId.createFromHexString(c._id) } },
        ];
      } else if (sort === "likes_desc") {
        cursorMatch.$or = [
          { likesCount: { $lt: c.likesCount } },
          { likesCount: c.likesCount, createdAt: { $lt: new Date(c.createdAt) } },
          { likesCount: c.likesCount, createdAt: new Date(c.createdAt), _id: { $lt: mongoose.Types.ObjectId.createFromHexString(c._id) } },
        ];
      } else if (sort === "likes_asc") {
        cursorMatch.$or = [
          { likesCount: { $gt: c.likesCount } },
          { likesCount: c.likesCount, createdAt: { $lt: new Date(c.createdAt) } },
          { likesCount: c.likesCount, createdAt: new Date(c.createdAt), _id: { $lt: mongoose.Types.ObjectId.createFromHexString(c._id) } },
        ];
      } else if (sort === "distance") {
        cursorMatch.$or = [
          { distanceMeters: { $gt: c.distanceMeters } },
          { distanceMeters: c.distanceMeters, averageRating: { $lt: (c.averageRating ?? 0) } },
          { distanceMeters: c.distanceMeters, averageRating: (c.averageRating ?? 0), createdAt: { $lt: new Date(c.createdAt) } },
          { distanceMeters: c.distanceMeters, averageRating: (c.averageRating ?? 0), createdAt: new Date(c.createdAt), _id: { $lt: mongoose.Types.ObjectId.createFromHexString(c._id) } },
        ];
      }
    }

    const pipeline = [];
    const shouldRunGeoNear = hasGeoFilter || sort === "distance";

    if (shouldRunGeoNear) {
      const geo = {
        near: { type: "Point", coordinates: [lng, lat] },
        distanceField: "distanceMeters",
        spherical: true,
      };

      if (hasGeoFilter) {
        geo.maxDistance = distanceKm * 1000;
      }

      if (Object.keys(match).length) {
        geo.query = match;
      }

      pipeline.push({ $geoNear: geo });

      if (Object.keys(cursorMatch).length) {
        pipeline.push({ $match: cursorMatch });
      }
    } else {
      if (Object.keys(match).length) pipeline.push({ $match: match });
      if (Object.keys(cursorMatch).length) pipeline.push({ $match: cursorMatch });
    }


    // Project only what the list needs
    pipeline.push({
      $project: {
        name: 1,
        description: { $substrCP: ["$description", 0, 240] },
        categories: 1,
        tags: 1,
        images: { $slice: ["$images", 1] },
        averageRating: 1,
        ratingsCount: 1,
        likesCount: 1,
        createdAt: 1,
        ...(shouldRunGeoNear ? { distanceMeters: 1 } : {}),
      },
    });

    if (sort === "newest") {
      pipeline.push({ $sort: { createdAt: -1, _id: -1 } });
    } else if (sort === "rating_desc") {
      pipeline.push({ $sort: { averageRating: -1, createdAt: -1, _id: -1 } });
    } else if (sort === "rating_asc") {
      pipeline.push({ $sort: { averageRating: 1, createdAt: -1, _id: -1 } });
    } else if (sort === "likes_desc") {
      pipeline.push({ $sort: { likesCount: -1, createdAt: -1, _id: -1 } });
    } else if (sort === "likes_asc") {
      pipeline.push({ $sort: { likesCount: 1, createdAt: -1, _id: -1 } });
    } else if (sort === "distance") {
      pipeline.push({ $sort: { distanceMeters: 1, averageRating: -1, createdAt: -1, _id: -1 } });
    } else {
      // default: newest
      pipeline.push({ $sort: { createdAt: -1, _id: -1 } });
    }


    // Fetch one extra to detect next page
    pipeline.push({ $limit: limit + 1 });

    const rows = await Listing.aggregate(pipeline).allowDiskUse(true);
    const hasNextPage = rows.length > limit;
    const data = hasNextPage ? rows.slice(0, limit) : rows;

    // Build next cursor
    let nextCursor = null;
    if (hasNextPage && data.length) {
      const last = data[data.length - 1];

      if (sort === "newest" || !sort) {
        nextCursor = encode({ createdAt: last.createdAt, _id: last._id });
      } else if (sort === "rating_desc" || sort === "rating_asc") {
        nextCursor = encode({
          averageRating: last.averageRating ?? 0,
          createdAt: last.createdAt,
          _id: last._id,
        });
      } else if (sort === "likes_desc" || sort === "likes_asc") {
        nextCursor = encode({
          likesCount: last.likesCount ?? 0,
          createdAt: last.createdAt,
          _id: last._id,
        });
      } else if (sort === "distance") {
        nextCursor = encode({
          distanceMeters: last.distanceMeters ?? 0,
          averageRating: last.averageRating ?? 0,
          createdAt: last.createdAt,
          _id: last._id,
        });
      } else {
        // if unknown sort then treat like newest
        nextCursor = encode({ createdAt: last.createdAt, _id: last._id });
      }
    }


    res.json({ data, nextCursor, hasNextPage });
  } catch (err) {
    console.log(err)
    throw new ApiError(500, 'Failed to fetch listings');
  }
});

export { createListing, getListings, getListing, updateListing, deleteListing, getListingFiltered };