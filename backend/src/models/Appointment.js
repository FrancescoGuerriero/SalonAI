import mongoose from "mongoose";


const appointmentSchema = new mongoose.Schema({

    customer: {

        type: mongoose.Schema.Types.ObjectId,

        ref: "User",

        required: true

    },


    service: {

        type: mongoose.Schema.Types.ObjectId,

        ref: "Service",

        required: true

    },


    stylist: {

        type: mongoose.Schema.Types.ObjectId,

        ref: "Stylist",

        required: true

    },


    date: {

        type: Date,

        required: true

    },


    time: {

        type: String,

        required: true

    },


    status: {

        type: String,

        enum:[
            "pending",
            "confirmed",
            "completed",
            "cancelled"
        ],

        default:"pending"

    },


    createdAt: {

        type: Date,

        default: Date.now

    }


});


export default mongoose.model(
    "Appointment",
    appointmentSchema
);