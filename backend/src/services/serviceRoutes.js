import express from "express";

import {

    getServices,
    createService,
    getService,
    deleteService

} from "../controllers/serviceController.js";


const router = express.Router();



router.get(
    "/",
    getServices
);



router.post(
    "/",
    createService
);



router.get(
    "/:id",
    getService
);



router.delete(
    "/:id",
    deleteService
);



export default router;