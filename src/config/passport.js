import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import crypto from "crypto";
import { User } from "../models/user.model.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    // verify callback
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value?.toLowerCase();
        const fullName = profile.displayName || `${profile.name?.givenName || ""} ${profile.name?.familyName || ""}`.trim();

        if (!email) {
          return done(new Error("Google account has no email"), null);
        }

        let user = await User.findOne({ email });
        if (!user) {
          // create user with random password to satisfy schema
          const randomPassword = crypto.randomBytes(20).toString("hex");
          user = await User.create({
            email,
            fullName: fullName || email,
            password: randomPassword,
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

export default passport;