import { z } from "zod"

const booleanStringSchema = z.union([
    z.literal("true").transform(() => true),
    z.literal("false").transform(() => false),
]);

const stringToArray = z.preprocess((val) => {
    if (val === undefined || val === null) return [];
    if (Array.isArray(val)) return val;
    return [val];
}, z.array(z.string()));

const ObjectIdSchema = z.string({
    required_error: "Object ID is required",
    invalid_type_error: "Object ID must be a string",
})
    .min(1, "Object ID cannot be empty")
    .regex(
        /^[0-9a-fA-F]{24}$/,
        "Invalid ObjectId format (must be 24 hexadecimal characters)"
    );

const createListingSchema = z.object({
    author: ObjectIdSchema,
    name: z.string()
        .min(3, "Name must be at least 3 characters long")
        .max(100, "Name must be at most 100 characters long"),
    description: z.string()
        .min(10, "Description must be at least 10 characters long")
        .max(5000, "Description must be at most 5000 characters long"),
    categories: z.array(z.string())
        .min(1, "At least one category is required"),
    tags: z.array(z.string())
        .min(1, "At least one tag is required"),
    latitude: z.coerce.number()
        .min(-90, "Latitude must be between -90 and 90")
        .max(90, "Latitude must be between -90 and 90"),
    longitude: z.coerce.number()
        .min(-180, "Longitude must be between -180 and 180")
        .max(180, "Longitude must be between -180 and 180"),
    permitsRequired: booleanStringSchema.default(false),
    permitsDescription: z.string()
        .max(1000, "Permit description must be at most 1000 characters long").optional(),
    bestSeason: z.string()
        .max(100, "Best season must be at most 100 characters long").optional(),
    difficulty: z.enum(["Easy", "Moderate", "Challenging", "Extreme"]),
    extraAdvice: z.string()
        .max(2000, "Extra tips must be at most 2000 characters long").optional(),
    physicalAddress: z.string()
        .max(200, "Physical address must be at most 200 characters long").optional(),
})


const filterListingsSchema = z.object({
    categories: stringToArray.optional(),
    tags: stringToArray.optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
    difficulty: z.enum(["Easy", "Moderate", "Challenging", "Extreme"]).optional(),
    verifiedOnly: z.union([z.literal("true"), z.literal("false")]).optional()
        .transform((v) => (v === undefined ? undefined : v === "true")),
    lat: z.coerce.number().optional(),
    lng: z.coerce.number().optional(),
    distanceKm: z.coerce.number().min(0).max(250).default(0),
    sort: z.enum(["newest", "rating_desc", "rating_asc", "likes_desc", "likes_asc", "distance"])
        .default("rating_desc"),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().optional(),
}).refine((q) => (q.sort !== "distance") || (Number.isFinite(q.lat) && Number.isFinite(q.lng)), {
    path: ["sort"],
    message: "Distance sorting requires lat & lng",
});

const tipsSchema = z.object({
    permitsRequired: z.boolean().default(false),
    permitsDescription: z.string()
        .max(1000, "Permit description must be at most 1000 characters long").optional(),
    bestSeason: z.string().max(100, "Best season must be at most 100 characters long").optional(),
    difficulty: z.enum(["Easy", "Moderate", "Challenging", "Extreme"]),
    extraAdvice: z.string()
        .max(2000, "Extra tips must be at most 2000 characters long").optional(),
}
);

export {
    createListingSchema,
    filterListingsSchema,
    tipsSchema,
};
