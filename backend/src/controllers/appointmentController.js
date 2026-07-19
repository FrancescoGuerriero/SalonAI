import Appointment from "../models/Appointment.js";


// Create appointment

export const createAppointment = async(req,res)=>{


try{


const appointment =
await Appointment.create({

    customer:req.body.customer,

    service:req.body.service,

    stylist:req.body.stylist,

    date:req.body.date,

    time:req.body.time


});



res.status(201).json({

    message:"Appointment created",

    appointment

});


}

catch(error){

res.status(500).json({

message:error.message

});

}


};




// Get appointments

export const getAppointments = async(req,res)=>{


try{


const appointments =
await Appointment
.find()
.populate("customer")
.populate("service")
.populate("stylist");



res.json(appointments);



}

catch(error){

res.status(500).json({

message:error.message

});

}


};