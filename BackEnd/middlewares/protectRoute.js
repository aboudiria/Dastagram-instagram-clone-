import User from '../models/userModel.js';
import jwt from 'jsonwebtoken'; 
const protectRoute= async (req,res,next)=>{
  try {
    const token= req.cookies.Jwt;
       if(!token){ 
           res.status(401).json({message:"unauthorized"});
           }

        const decoded=jwt.verify(token,process.env.JWT_SECRET);

        const user = await User.findById(decoded.userId).select("-password");

        req.user=user;
 
        next();
  } catch (error) {
    res.status(500).json({message: error.message});
    console.log("Error in signup :",error.message);
    
  }
}
export default protectRoute;