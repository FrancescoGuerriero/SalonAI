import express from "express";


import {

getStylists,

createStylist

} from "../controllers/stylistController.js";


const router = express.Router();



router.get(
"/",
getStylists
);



router.post(
"/",
createStylist
);



export default router;