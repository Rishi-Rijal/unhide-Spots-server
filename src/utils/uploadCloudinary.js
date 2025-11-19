import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config({ path: "./.env" });


cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;
        // upload the file
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        });
        fs.unlinkSync(localFilePath)
        return response;
    } catch (err) {
        fs.unlinkSync(localFilePath)
        return null;
    }
}

const removeFromCloudinary = async (publicId) => {
    try {
        if (!publicId) return;  
        await cloudinary.uploader.destroy(publicId, {
            resource_type: "image"
        });
    } catch (err) {
        console.error("Error removing from Cloudinary:", err);
    }   
}

export {uploadOnCloudinary, removeFromCloudinary};