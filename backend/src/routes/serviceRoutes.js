import express from "express";

import {
    getServices,
    createService,
    getServiceById
} from "../controllers/serviceController.js";


const router = express.Router();


// GET all services

router.get(
    "/",
    getServices
);


// GET one service

router.get(
    "/:id",
    getServiceById
);


// CREATE service

router.post(
    "/",
    createService
);


export default router;