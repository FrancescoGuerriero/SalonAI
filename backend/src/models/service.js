import mongoose from "mongoose";


const serviceSchema = new mongoose.Schema({

    name:{
        type:String,
        required:true
    },


    category:{
        type:String,
        required:true
    },


    description:{
        type:String
    },


    price:{
        type:Number,
        required:true
    },


    duration:{
        type:Number,
        required:true
    },


    image:{
        type:String
    },


    active:{
        type:Boolean,
        default:true
    }


}

);

export default mongoose.models.Service ||
mongoose.model(
    "Service",
    serviceSchema
);

console.log("Using Service model from:", import.meta.url);
console.log("=== Service model loaded ===");
console.log(serviceSchema.obj);


