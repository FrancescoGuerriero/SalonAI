import Stylist from "../models/Stylist.js";



// Get all stylists

export const getStylists = async(req,res)=>{


try{


const stylists =
await Stylist.find({
    active:true
});


res.json(stylists);


}

catch(error){


res.status(500).json({

message:error.message

});


}


};




// Create stylist

export const createStylist = async(req,res)=>{


try{


const stylist =
await Stylist.create(req.body);


res.status(201).json({

message:"Stylist created",

stylist

});


}

catch(error){


res.status(500).json({

message:error.message

});


}


};