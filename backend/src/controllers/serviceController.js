import Service from "../models/Service.js";


// Get all services

export const getServices = async (req,res)=>{

    try {

        const services =
        await Service.find();


        res.json(services);


    } catch(error){

        res.status(500).json({
            message:error.message
        });

    }

};



// Create service (Admin)

export const createService = async(req,res)=>{

    try {

        const service =
        await Service.create(req.body);


        res.status(201).json({

            message:"Service created",

            service

        });


    } catch(error){

        res.status(500).json({
            message:error.message
        });

    }

};



// Get single service

export const getServiceById = async(req,res)=>{

    try {

        const service =
        await Service.findById(req.params.id);


        if(!service){

            return res.status(404).json({
                message:"Service not found"
            });

        }


        res.json(service);


    } catch(error){

        res.status(500).json({
            message:error.message
        });

    }

};