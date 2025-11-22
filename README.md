# Unhide Nepal — Server

Backend API for the Unhide Nepal project. Built with Express, MongoDB (Mongoose), and several supporting libraries for authentication, file uploads, and email.

**Quick summary**
- **Tech stack:** `Node.js`, `Express`, `MongoDB` (`mongoose`), `Passport` (Google OAuth), `cloudinary` for image storage.
- **Auth:** Cookie-based access tokens, refresh flow, password reset via email, Google OAuth.
- **File upload:** `multer` to a temporary `public/temp` folder + upload to Cloudinary via `src/utils/uploadCloudinary.js`.

**Getting started (local development)**
1. Install dependencies:

```bash
cd unhide-Nepal-server
npm install
```

2. Create a `.env` file in the server root with required environment variables (example below).

3. Start the server:

```bash
# Start server
npm start

# (optional) Use nodemon for development
# npx nodemon server.js
```

Server listens on `process.env.PORT` or `8000` by default.

**Scripts**
- `npm start` — Runs `node server.js` (starts the app).

**Important environment variables**
Create a `.env` file with values similar to the following. Adjust for your environment.

```
# Server
PORT=8000
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb://localhost:27017
MONGO_URI_PROD=<production-mongo-uri>
DB_NAME=unhide_nepal_db
ISPROD=false

# CORS / Frontend
FRONTEND_URL=http://localhost:5173

# JWT secrets
ACCESS_TOKEN_SECRET=your_access_secret
REFRESH_TOKEN_SECRET=your_refresh_secret

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Email (for password reset)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-pass
SENDER_EMAIL=no-reply@example.com

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:8000/api/v1/user/auth/google/callback
```

**CORS**
- Allowed origins are controlled by `FRONTEND_URL` (comma-separated). If not set, defaults include the production Azure static origin and `http://localhost:5173` (see `app.js`).

**Database**
- MongoDB connection is handled in `src/db/index.db.js`. The server selects `MONGO_URI` or `MONGO_URI_PROD` depending on `ISPROD`.
- For production, set `ISPROD=true` and provide `MONGO_URI_PROD`.

**Authentication & Sessions**
- Access tokens are stored in cookies (`accessToken`) and verified in `src/controllers/auth.controller.js`.
- On 401, the client can call `GET /api/v1/user/refresh-token` to refresh the access token.
- Google OAuth is configured in `src/config/passport.js` and registers users when they first sign in.

**File uploads**
- Files are initially uploaded to the server's `public/temp` directory using `multer` (`src/middlewares/multer.middleware.js`).
- `src/utils/uploadCloudinary.js` uploads temp files to Cloudinary and removes the local copy.

**Error handling**
- The app uses a custom `ApiError` class in `src/utils/ApiError.js` and a centralized error handler in `app.js` which returns JSON `{ success: false, message }` with the appropriate status code.

**API overview (routes)**
- Listings: `POST/GET/PATCH/DELETE` under `/api/v1/listing` (see `src/routes/listing.routes.js` and `src/controllers/listing.controller.js`).
- Reviews: `POST/GET/PATCH/DELETE` under `/api/v1/review` (see `src/routes/review.routes.js`).
- Users: auth and account endpoints under `/api/v1/user` (register, login, logout, me, refresh-token, change-password, forgot-password, reset-password, Google OAuth callback).
- Admin: protected admin endpoints under `/api/v1/admin` for managing users and listings.

Refer to the route files in `src/routes/` and controllers in `src/controllers/` for full request/response details.

**Notes & tips**
- The server requires proper CORS and cookie settings when working with the client. The client sends requests with `withCredentials: true`, so the server must set cookie attributes allowing cross-site cookies when needed (`SameSite`, `Secure`).
- Consider using HTTPS in production and secure cookie flags.
- Consider adding a `dev` script with `nodemon` for faster development restarts.

**Contributing**
- Run the server locally with the `.env` configured and ensure the client is pointed to the correct `VITE_API_BASE_URL` when testing end-to-end flows.

---

If you'd like, I can also:
- add a `dev` script and example `nodemon.json`,
- or generate a Postman collection / OpenAPI spec from the route files.

Tell me which follow-up you'd like. 
