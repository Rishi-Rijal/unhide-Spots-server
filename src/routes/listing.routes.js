import { Router } from "express";
import { createListing, getListings, getListing, updateListing, deleteListing, getListingFiltered } from "../controllers/listing.controller.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

//route for listings
router
    .route("/all")
    .get(getListings)
    .post(upload.fields([{ name: "images", maxCount: 50 }]), createListing);

router
    .route("/filter")
    .get(getListingFiltered);

router
    .route("/:id")
    .get(getListing)
    .patch(updateListing)
    .delete(deleteListing);




export default router;