import mongoose from "mongoose";

const connectDB=async()=>{
    try {
        const conn=await mongoose.connect(process.env.MB_URI);
        console.log("MongoDB connected");
    } catch (error) {
        console.log(error);
        process.exit(1);
    }
}
export default connectDB;
