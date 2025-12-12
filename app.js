import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import passport from "passport";
import "./src/config/passport.js";



const app = express();

const defaultAllowed = [
    "https://zealous-desert-0541d1303.3.azurestaticapps.net",
    "http://localhost:5173",
    "https://unhidenepal.live",
];

const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(",").map((s) => s.trim()).filter(Boolean)
    : defaultAllowed;

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        } else {
            return callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
};


app.use(cors(corsOptions));

app.use(express.json({ limit: "16kb" }));

app.use(express.urlencoded({ extended: true, limit: "16kb" }));

app.use(express.static("public"));

app.use(cookieParser());

app.use(passport.initialize());

// routes
//import userRouter from "./routes/user.routes.js";
import listingRouter from "./src/routes/listing.routes.js";
import reviewRouter from "./src/routes/review.routes.js";
import userRouter from "./src/routes/user.routes.js";
import adminRouter from "./src/routes/admin.routes.js";
import contactRouter from "./src/routes/contact.routes.js";

app.get("/", (req, res) => {
    res.send("API is running...");
});
app.use("/api/v1/listing", listingRouter);
app.use("/api/v1/review", reviewRouter);
app.use("/api/v1/user", userRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/contact", contactRouter);

//routes decleration
//app.use("/api/v1/users", userRouter);

app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;

    res.status(statusCode).json({
        success: false,
        message: err.message || "Internal Server Error",
    });
});

export { app }