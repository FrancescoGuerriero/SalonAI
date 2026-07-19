import mongoose from "mongoose";


const stylistSchema = new mongoose.Schema({

    name: {

        type: String,

        required: true

    },


    speciality: {

        type: String,

        required: true

    },


    experience: {

        type: Number,

        required: true

    },


    image: {

        type: String

    },


    active: {

        type: Boolean,

        default: true

    }


});


export default mongoose.model(
    "Stylist",
    stylistSchema
);