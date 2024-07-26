import jwt from 'jsonwebtoken';


const generateTokenAndSetCookie=(userId,res)=>{
 //1- first create a token
 const token= jwt.sign({userId},process.env.JWT_SECRET,{
    expiresIn:'30d',

 })
 res.cookie("Jwt",token,{
    httpOnly:true,//this cookie cannot be access by the browser (more secure)
    maxAge:30*24*60*60*1000,//30 days
    sameSite:'strict',//more protected(Cross-Site Request Forgery (CSRF) attacks.)
 })
  return token;
};

export default generateTokenAndSetCookie;